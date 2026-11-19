// Panel de administración: agentes, casos, personas y asignaciones. Todas las rutas exigen rol admin.
import { Router } from "express";
import { query, uno, transaccion } from "../db.js";
import { aAgente, aCaso, cargarCaso } from "../repo.js";
import { hashPassword, validarPassword } from "../auth.js";
import { ah } from "./trabajo.js";

const r = Router();
const POSTURAS = ["conservador", "moderado", "audaz"];
const TIPOS_SECCION = ["texto", "presupuesto", "flujo"];
const txt = (v, max = 5000) => String(v ?? "").trim().slice(0, max);
const esEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f);

class Invalido extends Error {}
const exigir = (cond, msg) => { if (!cond) throw new Invalido(msg); };
// Convierte errores de validación en 400 y violaciones de unicidad en 409.
const manejar = (fn) => ah(async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (e) {
    if (e instanceof Invalido) return res.status(400).json({ error: e.message });
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe un registro con esos datos." });
    throw e;
  }
});

// =============================================================== Resumen
r.get("/resumen", manejar(async (_req, res) => {
  const f = await uno(`SELECT
      (SELECT count(*)::int FROM usuarios WHERE rol = 'evaluado' AND activo) AS personas,
      (SELECT count(*)::int FROM casos WHERE publicado) AS casos,
      (SELECT count(*)::int FROM agentes WHERE activo) AS agentes,
      (SELECT count(*)::int FROM asignaciones WHERE estado IN ('pendiente', 'en_curso')) AS en_curso,
      (SELECT count(*)::int FROM asignaciones WHERE estado = 'aprobada') AS aprobadas`);
  res.json({ personas: f.personas, casos: f.casos, agentes: f.agentes, enCurso: f.en_curso, aprobadas: f.aprobadas });
}));

// =============================================================== Agentes
function leerAgente(b) {
  const a = {
    nombre: txt(b.nombre, 120), cargo: txt(b.cargo, 120), iniciales: txt(b.iniciales, 3).toUpperCase(),
    color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#1f5f8b", mirada: txt(b.mirada, 120),
    perfil: txt(b.perfil, 8000), instrucciones: txt(b.instrucciones, 8000),
    postura_defecto: POSTURAS.includes(b.posturaDefecto) ? b.posturaDefecto : "moderado", activo: b.activo !== false
  };
  exigir(a.nombre && a.cargo && a.mirada && a.perfil, "Nombre, cargo, mirada y perfil son obligatorios.");
  if (!a.iniciales) a.iniciales = a.nombre.replace(/^(Ing|Cr|Lic|Dr|Dra|Arq)\.?\s+/i, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return a;
}

r.get("/agentes", manejar(async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, (SELECT count(*)::int FROM caso_agentes ca WHERE ca.agente_id = a.id) AS casos
       FROM agentes a ORDER BY a.activo DESC, a.nombre`);
  res.json(rows.map((x) => ({ ...aAgente(x), casos: x.casos })));
}));

r.get("/agentes/:id", manejar(async (req, res) => {
  const a = await uno("SELECT * FROM agentes WHERE id = $1", [req.params.id]);
  a ? res.json(aAgente(a)) : res.status(404).json({ error: "Agente no encontrado." });
}));

r.post("/agentes", manejar(async (req, res) => {
  const a = leerAgente(req.body || {});
  const f = await uno(
    `INSERT INTO agentes (nombre, cargo, iniciales, color, mirada, perfil, instrucciones, postura_defecto, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [a.nombre, a.cargo, a.iniciales, a.color, a.mirada, a.perfil, a.instrucciones, a.postura_defecto, a.activo]);
  res.status(201).json(aAgente(f));
}));

r.put("/agentes/:id", manejar(async (req, res) => {
  const a = leerAgente(req.body || {});
  const f = await uno(
    `UPDATE agentes SET nombre = $2, cargo = $3, iniciales = $4, color = $5, mirada = $6, perfil = $7,
            instrucciones = $8, postura_defecto = $9, activo = $10, actualizado_en = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id, a.nombre, a.cargo, a.iniciales, a.color, a.mirada, a.perfil, a.instrucciones, a.postura_defecto, a.activo]);
  f ? res.json(aAgente(f)) : res.status(404).json({ error: "Agente no encontrado." });
}));

r.delete("/agentes/:id", manejar(async (req, res) => {
  const uso = await uno("SELECT count(*)::int AS n FROM caso_agentes WHERE agente_id = $1", [req.params.id]);
  if (uso.n) return res.status(409).json({ error: `Este agente evalúa ${uso.n} caso(s). Quitalo de esos casos o desactivalo.` });
  await query("DELETE FROM agentes WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// =============================================================== Casos
function leerCaso(b) {
  const lineas = (arr) => (Array.isArray(arr) ? arr.map((x) => txt(x, 500)).filter(Boolean) : []);
  const c = {
    titulo: txt(b.titulo, 200), area: txt(b.area, 100), dificultad: txt(b.dificultad, 50) || "Intermedia",
    enunciado: txt(b.enunciado, 10000), referencia: txt(b.referencia, 10000),
    datos: (Array.isArray(b.datos) ? b.datos : []).map((d) => ({ clave: txt(d.clave, 200), valor: txt(d.valor, 500) })).filter((d) => d.clave),
    objetivos: lineas(b.objetivos), restricciones: lineas(b.restricciones),
    tasa_descuento: Number.isFinite(Number(b.tasaDescuento)) ? Number(b.tasaDescuento) : 12,
    moneda: txt(b.moneda, 10) || "USD", publicado: !!b.publicado
  };
  exigir(c.titulo, "El título es obligatorio.");
  const ids = new Set();
  c.secciones = (Array.isArray(b.secciones) ? b.secciones : []).map((s) => {
    const sec = {
      id: txt(s.id, 40).replace(/[^a-zA-Z0-9_-]/g, ""), tipo: TIPOS_SECCION.includes(s.tipo) ? s.tipo : "texto",
      titulo: txt(s.titulo, 120), ayuda: txt(s.ayuda, 1000), placeholder: txt(s.placeholder, 500)
    };
    if (sec.tipo === "flujo") { sec.etiquetaIngreso = txt(s.etiquetaIngreso, 120); sec.etiquetaCosto = txt(s.etiquetaCosto, 120); }
    exigir(sec.id && sec.titulo, "Cada sección necesita un identificador y un título.");
    exigir(!ids.has(sec.id), `El identificador de sección "${sec.id}" está repetido.`);
    ids.add(sec.id);
    return sec;
  });
  for (const t of ["presupuesto", "flujo"]) exigir(c.secciones.filter((s) => s.tipo === t).length <= 1, `Solo puede haber una sección de tipo ${t}.`);
  const vistos = new Set();
  c.agentes = (Array.isArray(b.agentes) ? b.agentes : []).map((a, i) => ({
    agenteId: String(a.id || a.agenteId), orden: i,
    postura: POSTURAS.includes(a.postura) ? a.postura : "moderado", enfoque: txt(a.enfoque, 4000)
  })).filter((a) => !vistos.has(a.agenteId) && vistos.add(a.agenteId));
  if (c.publicado) {
    exigir(c.secciones.length, "Para publicar el caso, agregá al menos una sección.");
    exigir(c.agentes.length, "Para publicar el caso, asigná al menos un evaluador.");
  }
  return c;
}

async function guardarCaso(db, id, c) {
  const vals = [c.titulo, c.area, c.dificultad, c.enunciado, JSON.stringify(c.datos), JSON.stringify(c.objetivos),
    JSON.stringify(c.restricciones), c.referencia, JSON.stringify(c.secciones), c.tasa_descuento, c.moneda, c.publicado];
  const f = id
    ? await db.query(`UPDATE casos SET titulo = $2, area = $3, dificultad = $4, enunciado = $5, datos = $6, objetivos = $7,
          restricciones = $8, referencia = $9, secciones = $10, tasa_descuento = $11, moneda = $12, publicado = $13, actualizado_en = now()
        WHERE id = $1 RETURNING id`, [id, ...vals])
    : await db.query(`INSERT INTO casos (titulo, area, dificultad, enunciado, datos, objetivos, restricciones, referencia, secciones,
          tasa_descuento, moneda, publicado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, vals);
  if (!f.rowCount) return null;
  const casoId = f.rows[0].id;
  await db.query("DELETE FROM caso_agentes WHERE caso_id = $1", [casoId]);
  for (const a of c.agentes) {
    await db.query("INSERT INTO caso_agentes (caso_id, agente_id, orden, postura, enfoque) VALUES ($1, $2, $3, $4, $5)",
      [casoId, a.agenteId, a.orden, a.postura, a.enfoque]);
  }
  return casoId;
}

r.get("/casos", manejar(async (_req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            (SELECT count(*)::int FROM caso_agentes ca WHERE ca.caso_id = c.id) AS n_agentes,
            (SELECT count(*)::int FROM asignaciones a WHERE a.caso_id = c.id) AS n_asignaciones
       FROM casos c ORDER BY c.publicado DESC, c.actualizado_en DESC`);
  res.json(rows.map((x) => ({ ...aCaso(x), agentes: x.n_agentes, asignaciones: x.n_asignaciones })));
}));

r.get("/casos/:id", manejar(async (req, res) => {
  const c = await cargarCaso(req.params.id, { conReferencia: true });
  c ? res.json(c) : res.status(404).json({ error: "Caso no encontrado." });
}));

r.post("/casos", manejar(async (req, res) => {
  const c = leerCaso(req.body || {});
  const id = await transaccion((db) => guardarCaso(db, null, c));
  res.status(201).json(await cargarCaso(id, { conReferencia: true }));
}));

r.put("/casos/:id", manejar(async (req, res) => {
  const c = leerCaso(req.body || {});
  const id = await transaccion((db) => guardarCaso(db, req.params.id, c));
  id ? res.json(await cargarCaso(id, { conReferencia: true })) : res.status(404).json({ error: "Caso no encontrado." });
}));

r.post("/casos/:id/duplicar", manejar(async (req, res) => {
  const orig = await cargarCaso(req.params.id, { conReferencia: true });
  if (!orig) return res.status(404).json({ error: "Caso no encontrado." });
  const c = leerCaso({ ...orig, titulo: `${orig.titulo} (copia)`, publicado: false });
  const id = await transaccion((db) => guardarCaso(db, null, c));
  res.status(201).json(await cargarCaso(id, { conReferencia: true }));
}));

r.delete("/casos/:id", manejar(async (req, res) => {
  const uso = await uno("SELECT count(*)::int AS n FROM asignaciones WHERE caso_id = $1", [req.params.id]);
  if (uso.n) return res.status(409).json({ error: `El caso tiene ${uso.n} asignación(es). Despublicalo en lugar de borrarlo.` });
  await query("DELETE FROM casos WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// =============================================================== Personas
const aUsuario = (x) => ({
  id: x.id, email: x.email, nombre: x.nombre, rol: x.rol, activo: x.activo, debeCambiarPassword: x.debe_cambiar_password,
  ultimoAcceso: x.ultimo_acceso, creadoEn: x.creado_en, asignaciones: x.asignaciones, aprobadas: x.aprobadas
});

r.get("/usuarios", manejar(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.*,
            (SELECT count(*)::int FROM asignaciones a WHERE a.usuario_id = u.id) AS asignaciones,
            (SELECT count(*)::int FROM asignaciones a WHERE a.usuario_id = u.id AND a.estado = 'aprobada') AS aprobadas
       FROM usuarios u ORDER BY u.activo DESC, u.rol, u.nombre`);
  res.json(rows.map(aUsuario));
}));

r.post("/usuarios", manejar(async (req, res) => {
  const b = req.body || {};
  const email = txt(b.email, 200).toLowerCase(), nombre = txt(b.nombre, 200), rol = b.rol === "admin" ? "admin" : "evaluado";
  exigir(nombre, "El nombre es obligatorio.");
  exigir(esEmail(email), "El email no es válido.");
  const err = validarPassword(b.password); exigir(!err, err);
  const f = await uno(
    `INSERT INTO usuarios (email, nombre, password_hash, rol, debe_cambiar_password)
     VALUES ($1, $2, $3, $4, true) RETURNING *, 0 AS asignaciones, 0 AS aprobadas`,
    [email, nombre, await hashPassword(b.password), rol]);
  res.status(201).json(aUsuario(f));
}));

r.put("/usuarios/:id", manejar(async (req, res) => {
  const b = req.body || {};
  const email = txt(b.email, 200).toLowerCase(), nombre = txt(b.nombre, 200), rol = b.rol === "admin" ? "admin" : "evaluado";
  exigir(nombre && esEmail(email), "Nombre y email válidos son obligatorios.");
  if (req.params.id === req.usuario.id) exigir(rol === "admin" && b.activo !== false, "No podés quitarte el rol de admin ni desactivarte.");
  const f = await uno(
    `UPDATE usuarios SET email = $2, nombre = $3, rol = $4, activo = $5, actualizado_en = now() WHERE id = $1
     RETURNING *, (SELECT count(*)::int FROM asignaciones a WHERE a.usuario_id = usuarios.id) AS asignaciones,
               (SELECT count(*)::int FROM asignaciones a WHERE a.usuario_id = usuarios.id AND a.estado = 'aprobada') AS aprobadas`,
    [req.params.id, email, nombre, rol, b.activo !== false]);
  f ? res.json(aUsuario(f)) : res.status(404).json({ error: "Persona no encontrada." });
}));

// Restablece la contraseña; la persona deberá cambiarla en su próximo ingreso.
r.post("/usuarios/:id/password", manejar(async (req, res) => {
  const err = validarPassword(req.body?.password); exigir(!err, err);
  const f = await uno("UPDATE usuarios SET password_hash = $2, debe_cambiar_password = true, actualizado_en = now() WHERE id = $1 RETURNING id",
    [req.params.id, await hashPassword(req.body.password)]);
  f ? res.json({ ok: true }) : res.status(404).json({ error: "Persona no encontrada." });
}));

r.delete("/usuarios/:id", manejar(async (req, res) => {
  exigir(req.params.id !== req.usuario.id, "No podés borrar tu propio usuario.");
  await query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// =============================================================== Asignaciones (seguimiento)
r.get("/asignaciones", manejar(async (req, res) => {
  const filtros = [], vals = [];
  if (req.query.casoId) { vals.push(req.query.casoId); filtros.push(`a.caso_id = $${vals.length}`); }
  if (req.query.usuarioId) { vals.push(req.query.usuarioId); filtros.push(`a.usuario_id = $${vals.length}`); }
  if (req.query.estado) { vals.push(req.query.estado); filtros.push(`a.estado = $${vals.length}`); }
  const { rows } = await query(
    `SELECT a.id, a.estado, a.fecha_limite, a.iniciado_en, a.actualizado_en, a.creado_en,
            u.id AS usuario_id, u.nombre AS usuario_nombre, u.email AS usuario_email,
            c.id AS caso_id, c.titulo AS caso_titulo,
            (SELECT count(*)::int FROM revisiones rv WHERE rv.asignacion_id = a.id) AS revisiones,
            (SELECT rv.puntaje_promedio FROM revisiones rv WHERE rv.asignacion_id = a.id ORDER BY rv.numero DESC LIMIT 1) AS ultimo_puntaje
       FROM asignaciones a JOIN usuarios u ON u.id = a.usuario_id JOIN casos c ON c.id = a.caso_id
      ${filtros.length ? "WHERE " + filtros.join(" AND ") : ""}
      ORDER BY a.actualizado_en DESC`, vals);
  res.json(rows.map((x) => ({
    id: x.id, estado: x.estado, fechaLimite: x.fecha_limite, iniciadoEn: x.iniciado_en, actualizadoEn: x.actualizado_en,
    creadoEn: x.creado_en, revisiones: x.revisiones, ultimoPuntaje: x.ultimo_puntaje,
    usuario: { id: x.usuario_id, nombre: x.usuario_nombre, email: x.usuario_email },
    caso: { id: x.caso_id, titulo: x.caso_titulo }
  })));
}));

// Asigna un caso a una o varias personas. Las que ya lo tenían se omiten.
r.post("/asignaciones", manejar(async (req, res) => {
  const { casoId, usuarioIds, fechaLimite } = req.body || {};
  exigir(casoId && Array.isArray(usuarioIds) && usuarioIds.length, "Elegí un caso y al menos una persona.");
  exigir(!fechaLimite || esFecha(fechaLimite), "La fecha límite no es válida.");
  const caso = await uno("SELECT publicado FROM casos WHERE id = $1", [casoId]);
  exigir(caso, "El caso no existe.");
  exigir(caso.publicado, "Publicá el caso antes de asignarlo.");
  const { rows } = await query(
    `INSERT INTO asignaciones (usuario_id, caso_id, fecha_limite)
     SELECT u, $1, $3 FROM unnest($2::uuid[]) AS u
     ON CONFLICT (usuario_id, caso_id) DO NOTHING RETURNING id`, [casoId, usuarioIds, fechaLimite || null]);
  res.status(201).json({ creadas: rows.length, omitidas: usuarioIds.length - rows.length });
}));

r.patch("/asignaciones/:id", manejar(async (req, res) => {
  const b = req.body || {};
  const sets = [], vals = [req.params.id];
  if (b.estado !== undefined) {
    exigir(["pendiente", "en_curso", "aprobada", "cerrada"].includes(b.estado), "Estado inválido.");
    vals.push(b.estado); sets.push(`estado = $${vals.length}`);
  }
  if (b.fechaLimite !== undefined) {
    exigir(b.fechaLimite === null || b.fechaLimite === "" || esFecha(b.fechaLimite), "La fecha límite no es válida.");
    vals.push(b.fechaLimite || null); sets.push(`fecha_limite = $${vals.length}`);
  }
  exigir(sets.length, "No hay cambios.");
  const f = await uno(`UPDATE asignaciones SET ${sets.join(", ")}, actualizado_en = now() WHERE id = $1 RETURNING id, estado, fecha_limite`, vals);
  f ? res.json({ id: f.id, estado: f.estado, fechaLimite: f.fecha_limite }) : res.status(404).json({ error: "Asignación no encontrada." });
}));

r.delete("/asignaciones/:id", manejar(async (req, res) => {
  await query("DELETE FROM asignaciones WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

export default r;
