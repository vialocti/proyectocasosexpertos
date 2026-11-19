// Prueba de humo de la API: recorre el flujo de admin y de una persona evaluada.
// Uso (con el servidor corriendo, idealmente en modo demo):
//   BASE=http://localhost:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... node db/prueba-api.mjs
import "../src/env.js";

const BASE = (process.env.BASE || "http://localhost:3000") + "/api";
let fallos = 0;

function cliente() {
  let cookie = "";
  return async (metodo, ruta, cuerpo) => {
    const r = await fetch(BASE + ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const datos = await r.json().catch(() => null);
    return { status: r.status, datos };
  };
}

function check(nombre, cond, extra = "") {
  console.log(`${cond ? "✔" : "✘"} ${nombre}${extra ? " — " + extra : ""}`);
  if (!cond) fallos++;
}

const admin = cliente(), ana = cliente();
const email = `prueba-${Date.now()}@test.com`;

let r = await admin("GET", "/admin/casos");
check("sin sesión → 401", r.status === 401);
r = await admin("POST", "/auth/login", { email: process.env.ADMIN_EMAIL, password: "incorrecta" });
check("login con clave incorrecta → 401", r.status === 401);
r = await admin("POST", "/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
check("login admin", r.status === 200 && r.datos.rol === "admin");
r = await admin("GET", "/admin/resumen");
check("resumen", r.status === 200, JSON.stringify(r.datos));

r = await admin("POST", "/admin/usuarios", { nombre: "Ana Prueba", email, password: "provisoria1" });
check("crear persona", r.status === 201, r.datos?.error);
const anaId = r.datos.id;
r = await admin("POST", "/admin/usuarios", { nombre: "Repetida", email: email.toUpperCase(), password: "provisoria1" });
check("email repetido → 409", r.status === 409);

r = await admin("GET", "/admin/casos");
const cafe = r.datos.find((c) => c.titulo.includes("cafetería"));
check("listar casos", r.status === 200 && cafe, `${r.datos.length} casos`);
r = await admin("POST", "/admin/asignaciones", { casoId: cafe.id, usuarioIds: [anaId], fechaLimite: "2026-12-15" });
check("asignar caso", r.status === 201 && r.datos.creadas === 1);
r = await admin("POST", "/admin/asignaciones", { casoId: cafe.id, usuarioIds: [anaId] });
check("asignar repetido se omite", r.datos.omitidas === 1);

r = await ana("POST", "/auth/login", { email: email.toUpperCase(), password: "provisoria1" });
check("login evaluada (email sin distinguir mayúsculas)", r.status === 200 && r.datos.debeCambiarPassword);
r = await ana("GET", "/mis-asignaciones");
check("antes de cambiar la clave → 403", r.status === 403 && r.datos.codigo === "cambiar_password");
r = await ana("POST", "/auth/password", { actual: "provisoria1", nueva: "corta" });
check("clave corta rechazada", r.status === 400);
r = await ana("POST", "/auth/password", { actual: "provisoria1", nueva: "MiClaveNueva9" });
check("cambiar clave", r.status === 200);

r = await ana("GET", "/mis-asignaciones");
check("mis asignaciones", r.status === 200 && r.datos.length === 1, r.datos[0]?.caso.titulo);
const asig = r.datos[0].id;
r = await ana("GET", `/asignaciones/${asig}`);
check("espacio de trabajo", r.status === 200 && r.datos.caso.secciones.length === 5 && r.datos.caso.agentes.length === 2,
  r.datos.caso.agentes.map((a) => `${a.nombre} (${a.postura})`).join(", "));
check("la referencia no se expone", !("referencia" in r.datos.caso) && !("instrucciones" in r.datos.caso.agentes[0]));
const agenteId = r.datos.caso.agentes[0].id;

r = await ana("PUT", `/asignaciones/${asig}/solucion`, {
  secciones: { mercado: "Oficinistas y turistas de la peatonal que buscan café de especialidad." },
  items: [{ concepto: "Máquina espresso", cantidad: 1, costoUnitario: 9000 }, { concepto: "Obra", cantidad: 1, costoUnitario: 25000 }],
  ahorroAnual: 112000, costoOperativoAnual: 87600, vidaUtil: 5
});
check("guardar propuesta", r.status === 200 && r.datos.estado === "en_curso",
  `inversión ${r.datos.finanzas?.inversion}, repago ${r.datos.finanzas?.repagoSimpleAnios} años`);

r = await ana("POST", `/asignaciones/${asig}/revision`);
check("revisión", r.status === 200 && r.datos.revision.resultados.length === 2,
  r.datos.error || `#${r.datos.revision.numero}, promedio ${r.datos.revision.puntajePromedio}, estado ${r.datos.estado}`);
r = await ana("POST", `/asignaciones/${asig}/chat`, { agenteId, mensaje: "¿Está bien mi cliente objetivo?" });
check("chat con un agente", r.status === 200 && r.datos.mensajes.length === 2, r.datos.error);
r = await ana("POST", `/asignaciones/${asig}/debate`);
check("mesa de debate", r.status === 200 && r.datos.consenso, r.datos.error);
r = await ana("POST", `/asignaciones/${asig}/asistente`, { mensaje: "¿Qué es el punto de equilibrio?" });
check("asistente", r.status === 200 && r.datos.mensajes.length === 2, r.datos.error);

r = await ana("GET", "/admin/casos");
check("evaluada no entra al panel → 403", r.status === 403);
r = await ana("GET", "/asignaciones/no-es-un-uuid");
check("id inválido → 404", r.status === 404);

r = await admin("GET", `/asignaciones/${asig}`);
check("admin ve el trabajo en solo lectura", r.status === 200 && r.datos.soloLectura,
  `${r.datos.revisiones.length} revisiones, ${r.datos.mensajes.length} mensajes, ${r.datos.debates.length} debates`);
r = await admin("POST", `/asignaciones/${asig}/revision`);
check("admin no puede escribir → 403", r.status === 403);
r = await admin("GET", "/admin/asignaciones");
check("seguimiento", r.status === 200 && r.datos.some((x) => x.id === asig));

r = await admin("PATCH", `/admin/asignaciones/${asig}`, { estado: "cerrada" });
check("cerrar asignación", r.status === 200);
r = await ana("PUT", `/asignaciones/${asig}/solucion`, { secciones: {} });
check("cerrada no admite cambios → 409", r.status === 409);

r = await admin("DELETE", `/admin/usuarios/${anaId}`);
check("borrar persona de prueba", r.status === 200);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(fallos ? 1 : 0);
