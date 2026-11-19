// Rutas del trabajo de una persona evaluada sobre una asignación (un caso asignado).
// La dueña de la asignación puede leer y escribir; un admin solo puede leer (para hacer seguimiento).
import { Router } from "express";
import { query, uno, transaccion } from "../db.js";
import {
  SOLUCION_VACIA, cargarCaso, finanzasDe, aAsignacion, aRevision, aMensaje, aDebate
} from "../repo.js";
import { revisar, conversar, debatir, asistir } from "../agents.js";

export const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const r = Router();

// Evita que la misma asignación dispare dos llamadas largas a la IA a la vez (doble clic, dos pestañas).
const enCurso = new Set();
async function conBloqueo(id, res, fn) {
  if (enCurso.has(id)) return res.status(409).json({ error: "Ya hay una consulta en curso para este caso. Esperá a que termine." });
  enCurso.add(id);
  try { await fn(); } finally { enCurso.delete(id); }
}

/** Carga la asignación y verifica el acceso. modo: "leer" (dueña o admin) | "escribir" (solo dueña, no cerrada). */
async function cargar(req, res, modo = "leer") {
  const fila = await uno("SELECT * FROM asignaciones WHERE id = $1", [req.params.id]);
  const esDuena = fila && fila.usuario_id === req.usuario.id;
  if (!fila || (!esDuena && req.usuario.rol !== "admin")) { res.status(404).json({ error: "No encontramos ese desafío." }); return null; }
  if (modo === "escribir") {
    if (!esDuena) { res.status(403).json({ error: "Solo la persona asignada puede trabajar en este desafío." }); return null; }
    if (fila.estado === "cerrada") { res.status(409).json({ error: "Este desafío está cerrado y ya no admite cambios." }); return null; }
  }
  return aAsignacion(fila);
}

async function historialAgente(asignacionId, agenteId) {
  const { rows } = await query(
    "SELECT autor, texto FROM mensajes WHERE asignacion_id = $1 AND canal = 'agente' AND agente_id = $2 ORDER BY id", [asignacionId, agenteId]);
  return rows;
}

// ---------- Mis desafíos ----------
r.get("/mis-asignaciones", ah(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.estado, a.fecha_limite, a.iniciado_en, a.actualizado_en,
            c.id AS caso_id, c.titulo, c.area, c.dificultad, c.enunciado,
            (SELECT count(*)::int FROM revisiones rv WHERE rv.asignacion_id = a.id) AS revisiones,
            (SELECT rv.puntaje_promedio FROM revisiones rv WHERE rv.asignacion_id = a.id ORDER BY rv.numero DESC LIMIT 1) AS ultimo_puntaje,
            (SELECT count(*)::int FROM caso_agentes ca WHERE ca.caso_id = c.id) AS agentes
       FROM asignaciones a JOIN casos c ON c.id = a.caso_id
      WHERE a.usuario_id = $1
      ORDER BY (a.estado = 'cerrada'), a.fecha_limite NULLS LAST, a.creado_en`, [req.usuario.id]);
  res.json(rows.map((x) => ({
    id: x.id, estado: x.estado, fechaLimite: x.fecha_limite, iniciadoEn: x.iniciado_en, actualizadoEn: x.actualizado_en,
    revisiones: x.revisiones, ultimoPuntaje: x.ultimo_puntaje, agentes: x.agentes,
    caso: { id: x.caso_id, titulo: x.titulo, area: x.area, dificultad: x.dificultad, enunciado: x.enunciado }
  })));
}));

// ---------- Espacio de trabajo completo ----------
r.get("/asignaciones/:id", ah(async (req, res) => {
  const a = await cargar(req, res); if (!a) return;
  const caso = await cargarCaso(a.casoId);
  // La persona evaluada no ve las instrucciones internas de los agentes.
  caso.agentes = caso.agentes.map(({ instrucciones, enfoque, ...ag }) => ag);
  const [mensajes, revisiones, debates, usuario] = await Promise.all([
    query("SELECT * FROM mensajes WHERE asignacion_id = $1 ORDER BY id", [a.id]),
    query("SELECT * FROM revisiones WHERE asignacion_id = $1 ORDER BY numero", [a.id]),
    query("SELECT * FROM debates WHERE asignacion_id = $1 ORDER BY creado_en", [a.id]),
    uno("SELECT id, nombre, email FROM usuarios WHERE id = $1", [a.usuarioId])
  ]);
  res.json({
    asignacion: a,
    caso,
    usuario,
    soloLectura: a.usuarioId !== req.usuario.id || a.estado === "cerrada",
    finanzas: finanzasDe(caso, a.solucion),
    mensajes: mensajes.rows.map(aMensaje),
    revisiones: revisiones.rows.map(aRevision),
    debates: debates.rows.map(aDebate)
  });
}));

// ---------- Guardar la propuesta (autoguardado) ----------
const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
function limpiarSolucion(s = {}) {
  const secciones = {};
  for (const [k, v] of Object.entries(s.secciones || {})) if (typeof v === "string") secciones[k.slice(0, 64)] = v.slice(0, 20000);
  return {
    secciones,
    items: (Array.isArray(s.items) ? s.items : []).slice(0, 200).map((it) => ({
      concepto: String(it.concepto ?? "").slice(0, 300), cantidad: num(it.cantidad, 1), costoUnitario: num(it.costoUnitario)
    })),
    ahorroAnual: num(s.ahorroAnual),
    costoOperativoAnual: num(s.costoOperativoAnual),
    vidaUtil: Math.min(50, Math.max(1, Math.round(num(s.vidaUtil, 10))))
  };
}

r.put("/asignaciones/:id/solucion", ah(async (req, res) => {
  const a = await cargar(req, res, "escribir"); if (!a) return;
  const solucion = limpiarSolucion({ ...SOLUCION_VACIA, ...req.body });
  const fila = await uno(
    `UPDATE asignaciones SET solucion = $2, actualizado_en = now(),
            estado = CASE WHEN estado = 'pendiente' THEN 'en_curso' ELSE estado END,
            iniciado_en = COALESCE(iniciado_en, now())
      WHERE id = $1 RETURNING estado, actualizado_en`, [a.id, solucion]);
  const caso = await cargarCaso(a.casoId);
  res.json({ estado: fila.estado, actualizadoEn: fila.actualizado_en, finanzas: finanzasDe(caso, solucion) });
}));

// ---------- Enviar a revisión: todos los agentes del caso evalúan en paralelo ----------
r.post("/asignaciones/:id/revision", ah(async (req, res) => {
  const a = await cargar(req, res, "escribir"); if (!a) return;
  await conBloqueo(a.id, res, async () => {
    const caso = await cargarCaso(a.casoId, { conReferencia: true });
    if (!caso.agentes.length) return res.status(409).json({ error: "Este caso todavía no tiene evaluadores asignados." });
    const fin = finanzasDe(caso, a.solucion);
    const { n } = await uno("SELECT count(*)::int + 1 AS n FROM revisiones WHERE asignacion_id = $1", [a.id]);

    let resultados;
    try {
      resultados = await Promise.all(caso.agentes.map(async (ag) => ({
        agenteId: ag.id,
        ...(await revisar(ag, caso, a.solucion, fin, await historialAgente(a.id, ag.id), n))
      })));
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "Error al consultar a los evaluadores: " + e.message });
    }

    const aprobada = resultados.every((x) => x.veredicto === "aprobado");
    const promedio = Math.round((resultados.reduce((s, x) => s + x.puntaje, 0) / resultados.length) * 100) / 100;
    const salida = await transaccion(async (db) => {
      const rev = await db.query(
        `INSERT INTO revisiones (asignacion_id, numero, finanzas, resultados, aprobada, puntaje_promedio)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [a.id, n, fin, JSON.stringify(resultados), aprobada, promedio]);
      const msgs = [];
      for (const x of resultados) {
        const m = await db.query(
          `INSERT INTO mensajes (asignacion_id, canal, agente_id, autor, texto, revision_numero)
           VALUES ($1, 'agente', $2, 'agente', $3, $4) RETURNING *`, [a.id, x.agenteId, x.mensaje, n]);
        msgs.push(aMensaje(m.rows[0]));
      }
      const est = await db.query(
        `UPDATE asignaciones SET estado = CASE WHEN $2 THEN 'aprobada' WHEN estado = 'aprobada' THEN 'en_curso' ELSE estado END,
                iniciado_en = COALESCE(iniciado_en, now()), actualizado_en = now()
          WHERE id = $1 RETURNING estado`, [a.id, aprobada]);
      return { revision: aRevision(rev.rows[0]), mensajes: msgs, estado: est.rows[0].estado };
    });
    res.json(salida);
  });
}));

// ---------- Chat con un agente ----------
r.post("/asignaciones/:id/chat", ah(async (req, res) => {
  const a = await cargar(req, res, "escribir"); if (!a) return;
  const { agenteId, mensaje } = req.body || {};
  const texto = String(mensaje || "").trim().slice(0, 4000);
  if (!texto) return res.status(400).json({ error: "Escribí un mensaje." });
  await conBloqueo(a.id, res, async () => {
    const caso = await cargarCaso(a.casoId, { conReferencia: true });
    const agente = caso.agentes.find((x) => x.id === agenteId);
    if (!agente) return res.status(400).json({ error: "Ese evaluador no participa de este caso." });
    let respuesta;
    try {
      respuesta = await conversar(agente, caso, a.solucion, finanzasDe(caso, a.solucion), await historialAgente(a.id, agente.id), texto);
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "El evaluador no pudo responder: " + e.message });
    }
    const { rows } = await query(
      `INSERT INTO mensajes (asignacion_id, canal, agente_id, autor, texto)
       VALUES ($1, 'agente', $2, 'alumno', $3), ($1, 'agente', $2, 'agente', $4) RETURNING *`, [a.id, agente.id, texto, respuesta]);
    res.json({ mensajes: rows.map(aMensaje) });
  });
}));

// ---------- Mesa de debate ----------
r.post("/asignaciones/:id/debate", ah(async (req, res) => {
  const a = await cargar(req, res, "escribir"); if (!a) return;
  await conBloqueo(a.id, res, async () => {
    const caso = await cargarCaso(a.casoId, { conReferencia: true });
    if (caso.agentes.length < 2) return res.status(409).json({ error: "La mesa de debate necesita al menos dos evaluadores." });
    let d;
    try {
      d = await debatir(caso.agentes, caso, a.solucion, finanzasDe(caso, a.solucion));
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "La mesa no pudo completar el debate: " + e.message });
    }
    const fila = await uno("INSERT INTO debates (asignacion_id, intervenciones, consenso) VALUES ($1, $2, $3) RETURNING *",
      [a.id, JSON.stringify(d.intervenciones), d.consenso]);
    res.json(aDebate(fila));
  });
}));

// ---------- Asistente de consulta ----------
r.post("/asignaciones/:id/asistente", ah(async (req, res) => {
  const a = await cargar(req, res, "escribir"); if (!a) return;
  const texto = String(req.body?.mensaje || "").trim().slice(0, 4000);
  if (!texto) return res.status(400).json({ error: "Escribí una consulta." });
  const caso = await cargarCaso(a.casoId);
  const { rows: previos } = await query(
    "SELECT autor, texto FROM mensajes WHERE asignacion_id = $1 AND canal = 'asistente' ORDER BY id", [a.id]);
  let resp;
  try {
    resp = await asistir(caso, [...previos, { autor: "alumno", texto }], { web: !!req.body?.web });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "El asistente no pudo responder: " + e.message });
  }
  const { rows } = await query(
    `INSERT INTO mensajes (asignacion_id, canal, autor, texto, fuentes)
     VALUES ($1, 'asistente', 'alumno', $2, NULL), ($1, 'asistente', 'asistente', $3, $4) RETURNING *`,
    [a.id, texto, resp.texto, JSON.stringify(resp.fuentes)]);
  res.json({ mensajes: rows.map(aMensaje) });
}));

export default r;
