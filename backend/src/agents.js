// Motor de evaluación. Los agentes, los casos y sus secciones vienen de la base de datos,
// así que todo lo que sigue es genérico: sirve para cualquier caso y cualquier cantidad de agentes.
//
// Forma de los objetos que recibe:
//   caso:    { titulo, enunciado, datos[], objetivos[], restricciones[], referencia, secciones[], tasa_descuento, moneda }
//   agente:  { id, nombre, cargo, mirada, perfil, instrucciones, postura, enfoque }   (postura y enfoque: de caso_agentes)
//   sol:     { secciones: { [idSeccion]: texto }, items[], ahorroAnual, costoOperativoAnual, vidaUtil }

import { generar, generarConWeb, MODO_DEMO, CLAVE_REQUERIDA } from "./llm.js";

export { MODO_DEMO };

const POSTURAS = {
  conservador:
    "Postura CONSERVADORA: priorizás bajo riesgo, soluciones probadas y supuestos prudentes. " +
    "Preferís avanzar por etapas y empezar por lo de menor riesgo.",
  moderado:
    "Postura MODERADA: buscás equilibrio entre riesgo y beneficio; aceptás propuestas ambiciosas si están bien justificadas.",
  audaz:
    "Postura AUDAZ: valorás soluciones innovadoras y de mayor impacto aunque impliquen más inversión o riesgo, " +
    "siempre que estén bien fundamentadas. Empujás a la persona a pensar en grande."
};

const lista = (arr) => (Array.isArray(arr) && arr.length ? arr.join("; ") : "(ninguno)");

function systemPrompt(agente, caso) {
  return `Sos ${agente.nombre}, ${agente.cargo}, en un simulador educativo de resolución de casos.
${agente.perfil}
${POSTURAS[agente.postura] || POSTURAS.moderado}
${agente.instrucciones ? `\nInstrucciones adicionales:\n${agente.instrucciones}` : ""}${agente.enfoque ? `\nEn este caso en particular:\n${agente.enfoque}` : ""}

Una persona está construyendo la solución a este caso. Tu tarea es evaluar, corregir y guiar, en tu personaje,
para que llegue a la solución más favorable. Hablás en español rioplatense, en segunda persona ("vos"),
profesional y cálido. No resolvés el caso: señalás errores, pedís justificaciones y sugerís direcciones.
Si un número es incorrecto, decilo y mostrá por qué. Concentrate en tu mirada (${agente.mirada}),
aunque podés mencionar brevemente otros aspectos.

CASO: ${caso.titulo}
${caso.enunciado}
Datos:
${(caso.datos || []).map((d) => `- ${d.clave}: ${d.valor}`).join("\n") || "(sin datos)"}
Objetivos: ${lista(caso.objetivos)}
Restricciones: ${lista(caso.restricciones)}
${caso.referencia ? `\nNotas de referencia para verificar (no se las muestres a la persona tal cual):\n${caso.referencia}` : ""}`;
}

export const tieneFinanzas = (caso) =>
  (caso.secciones || []).some((s) => s.tipo === "presupuesto") && (caso.secciones || []).some((s) => s.tipo === "flujo");

function formatearSolucion(caso, sol = {}, fin) {
  const m = caso.moneda || "USD";
  const textos = sol.secciones || {};
  const partes = (caso.secciones || []).map((s, i) => {
    const titulo = `${i + 1}. ${s.titulo} [${s.id}]`;
    if (s.tipo === "presupuesto") {
      const items = (sol.items || [])
        .map((it) => `  - ${it.concepto || "(sin concepto)"}: ${it.cantidad} x ${it.costoUnitario} ${m} = ${(Number(it.cantidad) || 0) * (Number(it.costoUnitario) || 0)} ${m}`)
        .join("\n");
      return `${titulo}:\n${items || "  (sin ítems)"}`;
    }
    if (s.tipo === "flujo") {
      return `${titulo}:
${s.etiquetaIngreso || "Ahorro anual estimado"}: ${sol.ahorroAnual || 0} ${m}/año · ${s.etiquetaCosto || "Costo operativo adicional"}: ${sol.costoOperativoAnual || 0} ${m}/año · Vida útil / horizonte: ${sol.vidaUtil || "?"} años
Justificación:
${textos[s.id] || "(vacío)"}`;
    }
    return `${titulo}:\n${textos[s.id] || "(vacío)"}`;
  });

  const finanzas = fin && tieneFinanzas(caso) ? `

RESULTADOS FINANCIEROS (calculados por el sistema con lo que cargó la persona):
Inversión total: ${fin.inversion} ${m} · Flujo neto anual: ${fin.flujoNetoAnual} ${m}
Repago simple: ${fin.repagoSimpleAnios ?? "no se recupera"} años · Repago descontado: ${fin.repagoDescontadoAnios ?? "no se recupera"} años
VAN (${fin.tasaDescuento}%): ${fin.van} ${m} · TIR: ${fin.tir ?? "n/d"}%` : "";

  return `PROPUESTA DE LA PERSONA EVALUADA\n${partes.join("\n\n")}${finanzas}`;
}

function formatoRevision(caso) {
  const ids = [...(caso.secciones || []).map((s) => s.id), "general"].join("|");
  return `Respondé SOLO con un JSON válido (sin texto fuera del JSON) con esta forma:
{
  "veredicto": "aprobado" | "aprobado_con_cambios" | "rechazado",
  "puntaje": número de 0 a 10,
  "mensaje": "tu devolución en personaje, 3 a 6 oraciones",
  "fortalezas": ["..."],
  "observaciones": [{"seccion": "${ids}", "gravedad": "alta|media|baja", "detalle": "..."}],
  "preguntas": ["preguntas concretas para que mejore"]
}
Sólo das "aprobado" si la propuesta es sólida desde tu mirada y cumple los objetivos del caso.`;
}

// Pide JSON al modelo y lo parsea; si llega cortado o mal formado, reintenta una vez.
async function llamarJSON(system, messages, maxTokens = 4000) {
  let error;
  for (let intento = 1; intento <= 2; intento++) {
    const texto = await generar(system, messages, maxTokens, { json: true });
    try { return parsearJSON(texto); }
    catch (e) { error = e; console.warn(`[llamarJSON] intento ${intento} falló${intento < 2 ? ", reintentando" : ""}`); }
  }
  throw error;
}

function parsearJSON(texto) {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("El agente no devolvió JSON");
  try {
    return JSON.parse(m[0]);
  } catch {
    console.error("[parsearJSON] JSON inválido:\n", texto);
    throw new Error("La respuesta del agente vino incompleta o mal formada. Probá enviar de nuevo.");
  }
}

// La API requiere alternancia user/assistant comenzando por user.
function normalizar(msgs) {
  const out = [];
  for (const m of msgs) {
    if (out.length === 0 && m.role !== "user") continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n\n" + m.content;
    else out.push({ ...m });
  }
  return out;
}

const aMensajes = (historial) =>
  historial.map((m) => ({ role: m.autor === "alumno" ? "user" : "assistant", content: m.texto }));

function normalizarRevision(r) {
  const veredictos = ["aprobado", "aprobado_con_cambios", "rechazado"];
  return {
    veredicto: veredictos.includes(r.veredicto) ? r.veredicto : "aprobado_con_cambios",
    puntaje: Math.max(0, Math.min(10, Number(r.puntaje) || 0)),
    mensaje: String(r.mensaje || ""),
    fortalezas: Array.isArray(r.fortalezas) ? r.fortalezas.map(String) : [],
    observaciones: Array.isArray(r.observaciones) ? r.observaciones : [],
    preguntas: Array.isArray(r.preguntas) ? r.preguntas.map(String) : []
  };
}

// ---------- Revisión de un agente ----------
export async function revisar(agente, caso, sol, fin, historial, numeroRevision) {
  if (MODO_DEMO) return revisarDemo(agente, caso, sol, fin);
  const messages = [
    ...aMensajes(historial.slice(-10)),
    { role: "user", content: `${formatearSolucion(caso, sol, fin)}\n\nRevisión #${numeroRevision}.\n${formatoRevision(caso)}` }
  ];
  return normalizarRevision(await llamarJSON(systemPrompt(agente, caso), normalizar(messages)));
}

// ---------- Chat con un agente ----------
export async function conversar(agente, caso, sol, fin, historial, mensaje) {
  if (MODO_DEMO) return `[MODO DEMO] ${agente.nombre}: recibí tu mensaje. Configurá ${CLAVE_REQUERIDA} para respuestas reales.`;
  const messages = [
    ...aMensajes(historial.slice(-16)),
    {
      role: "user",
      content: `[Estado actual de la propuesta, como contexto]\n${formatearSolucion(caso, sol, fin)}\n\n[Mensaje de la persona]\n${mensaje}\n\nRespondé en personaje, breve (máx. 150 palabras), sin JSON.`
    }
  ];
  return generar(systemPrompt(agente, caso), normalizar(messages), 2000);
}

// ---------- Mesa de debate entre todos los agentes del caso ----------
export async function debatir(agentes, caso, sol, fin) {
  if (MODO_DEMO) return debateDemo(agentes);
  const propuesta = formatearSolucion(caso, sol, fin);
  const otros = (a) => agentes.filter((x) => x.id !== a.id).map((x) => `${x.nombre} (${x.mirada})`).join(", ");
  const intervenciones = [];
  const transcripcion = () => intervenciones.map((i) => `${agentes.find((a) => a.id === i.agenteId).nombre}: ${i.texto}`).join("\n\n");

  // Ronda: cada agente habla una vez, viendo lo que dijeron los anteriores.
  for (const [i, a] of agentes.entries()) {
    const consigna = i === 0
      ? `Estás en una mesa de evaluación con ${otros(a)}. Abrí el debate: en máx. 120 palabras, decí qué cambiarías para llegar a la solución más favorable y qué priorizarías.`
      : `Debate hasta ahora:\n${transcripcion()}\n\nRespondé en máx. 120 palabras: en qué coincidís, en qué no y qué propondrías vos.`;
    intervenciones.push({ agenteId: a.id, texto: await generar(systemPrompt(a, caso), [{ role: "user", content: `${propuesta}\n\n${consigna}` }], 2000) });
  }
  // Cierre: quien abrió busca un acuerdo.
  const a0 = agentes[0];
  intervenciones.push({
    agenteId: a0.id,
    texto: await generar(systemPrompt(a0, caso), [{
      role: "user",
      content: `${propuesta}\n\nDebate hasta ahora:\n${transcripcion()}\n\nCerrá en máx. 100 palabras buscando un acuerdo.`
    }], 2000)
  });

  const consenso = await llamarJSON(
    "Sos un moderador académico neutral. Sintetizás el debate entre evaluadores para orientar a la persona hacia la solución más favorable, equilibrando todas las miradas. Español rioplatense.",
    [{
      role: "user",
      content: `CASO: ${caso.titulo}\n${propuesta}\n\nDEBATE:\n${transcripcion()}\n\nDevolvé SOLO JSON:
{"acuerdos": ["..."], "desacuerdos": ["..."], "solucionRecomendada": "párrafo con la combinación de medidas más favorable y por qué", "etapas": [{"etapa": "...", "medidas": "...", "inversionEstimada": "...", "repagoEstimado": "..."}], "proximosPasosAlumno": ["..."]}`
    }],
    5000
  );
  return { intervenciones, consenso };
}

// ---------- Asistente de consulta ----------
const SYSTEM_ASISTENTE = `Sos un asistente de consulta para personas que resuelven casos de ingeniería y ciencias económicas.
Respondés en español rioplatense, claro y conciso.
Podés: explicar conceptos y fórmulas (VAN, TIR, repago, punto de equilibrio, potencia, eficiencia, etc.), dar órdenes
de magnitud, precios y datos de referencia, normativa, y ayudar a verificar cálculos mostrando el procedimiento.
No escribas la solución completa del caso ni redactes las secciones de la propuesta: si te lo piden, orientá con pasos,
preguntas y datos para que la persona la arme.
Cuando uses información de la web, indicá la fuente y aclará que verifique precios y fechas.`;

export async function asistir(caso, historial, { web = false } = {}) {
  if (MODO_DEMO) return { texto: `Modo demo: el asistente necesita ${CLAVE_REQUERIDA} en el .env. Mientras tanto podés usar la calculadora.`, fuentes: [] };
  const system = `${SYSTEM_ASISTENTE}\n\nContexto: la persona trabaja el caso "${caso.titulo}".\n${caso.enunciado}`;
  const messages = normalizar(historial.slice(-20).map((m) => ({ role: m.autor === "alumno" ? "user" : "assistant", content: m.texto })));
  const { texto, fuentes } = await generarConWeb(system, messages, { web });
  return { texto: texto || "(sin respuesta)", fuentes: fuentes.slice(0, 8) };
}

// ======================================================================
// MODO DEMO: respuestas por reglas para probar sin API key
// ======================================================================
function revisarDemo(agente, caso, sol, fin) {
  const obs = [], fort = [], preg = [];
  const textos = sol.secciones || {};
  for (const s of caso.secciones || []) {
    if (s.tipo === "texto" || s.tipo === "flujo") {
      const largo = (textos[s.id] || "").trim().length;
      if (largo < 60) obs.push({ seccion: s.id, gravedad: largo ? "media" : "alta", detalle: `"${s.titulo}" está ${largo ? "muy breve" : "vacía"}. Desarrollala con datos del caso.` });
      else fort.push(`Desarrollaste "${s.titulo}".`);
    }
  }
  if (tieneFinanzas(caso) && /econ|financ/i.test(agente.mirada)) {
    if (fin.inversion <= 0) obs.push({ seccion: "presupuesto", gravedad: "alta", detalle: "No cargaste ítems de inversión." });
    if (fin.repagoSimpleAnios == null) obs.push({ seccion: "general", gravedad: "alta", detalle: "Con estos números la inversión no se recupera." });
    else fort.push(`Repago simple de ${fin.repagoSimpleAnios} años.`);
    preg.push("¿Qué pasa con tus resultados si los ingresos o ahorros son un 20% menores?");
  }
  preg.push(`¿Qué supuestos usaste desde la mirada ${agente.mirada}?`);
  const altas = obs.filter((o) => o.gravedad === "alta").length;
  const veredicto = altas ? "rechazado" : obs.length > 1 ? "aprobado_con_cambios" : "aprobado";
  return {
    veredicto,
    puntaje: Math.max(1, Math.min(10, Math.round((9 - altas * 2.5 - (obs.length - altas)) * 10) / 10)),
    mensaje: `[MODO DEMO] Soy ${agente.nombre}. ${veredicto === "aprobado" ? "La propuesta está bien encaminada desde mi mirada." : "Hay puntos que tenés que reforzar antes de que pueda aprobarla."} Revisá las observaciones.`,
    fortalezas: fort, observaciones: obs, preguntas: preg
  };
}

function debateDemo(agentes) {
  return {
    intervenciones: [
      ...agentes.map((a) => ({ agenteId: a.id, texto: `[MODO DEMO] ${a.nombre}: desde mi mirada ${a.mirada}, priorizaría lo de mayor impacto con menor riesgo.` })),
      { agenteId: agentes[0].id, texto: "[MODO DEMO] Propongo avanzar por etapas y validar los supuestos con datos reales." }
    ],
    consenso: {
      acuerdos: ["Avanzar por etapas", "Explicitar y validar los supuestos"],
      desacuerdos: ["El nivel de riesgo aceptable"],
      solucionRecomendada: "[MODO DEMO] Implementar por etapas, empezando por las medidas de menor riesgo.",
      etapas: [{ etapa: "1", medidas: "Medidas rápidas y de bajo costo", inversionEstimada: "—", repagoEstimado: "corto" }],
      proximosPasosAlumno: ["Revisar los supuestos de cada sección", "Configurar una API key para respuestas reales"]
    }
  };
}
