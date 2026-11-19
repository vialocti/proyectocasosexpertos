// Capa de acceso a modelos de lenguaje. El resto del backend llama a `generar` y
// `generarConWeb` sin saber qué proveedor está detrás; se elige con AI_PROVIDER en el .env.
//
//   AI_PROVIDER=anthropic  → usa ANTHROPIC_API_KEY y ANTHROPIC_MODEL
//   AI_PROVIDER=openai     → usa OPENAI_API_KEY y OPENAI_MODEL
//
// Si falta la clave del proveedor elegido, el sistema queda en modo demo.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const PROVEEDORES = {
  anthropic: {
    nombre: "Anthropic (Claude)",
    clave: "ANTHROPIC_API_KEY",
    modelo: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    crear: () => new Anthropic(),
    generar: generarAnthropic,
    generarConWeb: generarConWebAnthropic
  },
  openai: {
    nombre: "OpenAI",
    clave: "OPENAI_API_KEY",
    modelo: process.env.OPENAI_MODEL || "gpt-5",
    crear: () => new OpenAI(),
    generar: generarOpenAI,
    generarConWeb: generarConWebOpenAI
  }
};

const idProveedor = (process.env.AI_PROVIDER || "anthropic").trim().toLowerCase();
const prov = PROVEEDORES[idProveedor];
if (!prov) throw new Error(`AI_PROVIDER="${idProveedor}" no es válido. Usá: ${Object.keys(PROVEEDORES).join(" | ")}`);

const client = process.env[prov.clave] ? prov.crear() : null;

export const PROVEEDOR = idProveedor;
export const MODELO = prov.modelo;
export const NOMBRE_PROVEEDOR = prov.nombre;
export const MODO_DEMO = !client;
export const CLAVE_REQUERIDA = prov.clave;

/**
 * Genera texto a partir de un system prompt y un historial.
 * @param {string} system
 * @param {{role: "user"|"assistant", content: string}[]} messages  (debe empezar con "user")
 * @param {number} maxTokens  tope para el texto de la respuesta
 * @param {{json?: boolean}} opciones  json: pedir al proveedor que devuelva JSON válido
 * @returns {Promise<string>}
 */
export function generar(system, messages, maxTokens = 4000, { json = false } = {}) {
  return prov.generar(system, messages, maxTokens, { json });
}

/**
 * Igual que `generar`, pero con búsqueda web opcional. Devuelve el texto y las fuentes citadas.
 * @returns {Promise<{texto: string, fuentes: {titulo: string, url: string}[]}>}
 */
export function generarConWeb(system, messages, { web = false, maxTokens = 16000 } = {}) {
  return prov.generarConWeb(system, messages, { web, maxTokens });
}

const avisarCorte = (maxTokens) => console.warn(`[llm:${idProveedor}] respuesta cortada por límite de tokens (${maxTokens})`);
const agregarFuente = (fuentes, url, titulo) => { if (url && !fuentes.some((f) => f.url === url)) fuentes.push({ titulo: titulo || url, url }); };

// ---------------------------------------------------------------- Anthropic
async function generarAnthropic(system, messages, maxTokens) {
  const resp = await client.messages.create({ model: MODELO, max_tokens: maxTokens, system, messages });
  if (resp.stop_reason === "max_tokens") avisarCorte(maxTokens);
  return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function generarConWebAnthropic(system, messages, { web, maxTokens }) {
  const tools = web ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] : undefined;
  const msgs = [...messages];
  // La búsqueda corre del lado de Anthropic; si el turno se pausa (pause_turn), se continúa.
  let resp;
  for (let i = 0; i < 4; i++) {
    resp = await client.messages.create({ model: MODELO, max_tokens: maxTokens, system, messages: msgs, ...(tools && { tools }) });
    if (resp.stop_reason !== "pause_turn") break;
    msgs.push({ role: "assistant", content: resp.content });
  }
  if (resp.stop_reason === "max_tokens") avisarCorte(maxTokens);

  const texto = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const fuentes = [];
  for (const b of resp.content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach((r) => agregarFuente(fuentes, r.url, r.title));
  }
  return { texto, fuentes };
}

// ---------------------------------------------------------------- OpenAI (Responses API)
// En los modelos de razonamiento (gpt-5, o-series) los tokens de razonamiento se descuentan de
// max_output_tokens. Sumamos un margen para que el razonamiento no se coma la respuesta.
const MARGEN_RAZONAMIENTO = Number(process.env.OPENAI_REASONING_MARGIN || 12000);
const ESFUERZO = process.env.OPENAI_REASONING_EFFORT; // opcional: minimal | low | medium | high
const opcionesOpenAI = (maxTokens) => ({
  max_output_tokens: maxTokens + MARGEN_RAZONAMIENTO,
  ...(ESFUERZO && { reasoning: { effort: ESFUERZO } })
});
function revisarCorteOpenAI(resp, maxTokens) {
  if (resp.status === "incomplete") {
    avisarCorte(maxTokens + MARGEN_RAZONAMIENTO);
    console.warn("[llm:openai] incomplete_details:", JSON.stringify(resp.incomplete_details), "usage:", JSON.stringify(resp.usage));
  }
}

async function generarOpenAI(system, messages, maxTokens, { json }) {
  const resp = await client.responses.create({
    model: MODELO,
    instructions: system,
    input: messages,
    ...opcionesOpenAI(maxTokens),
    ...(json && { text: { format: { type: "json_object" } } })
  });
  revisarCorteOpenAI(resp, maxTokens);
  return resp.output_text;
}

async function generarConWebOpenAI(system, messages, { web, maxTokens }) {
  const resp = await client.responses.create({
    model: MODELO,
    instructions: system,
    input: messages,
    ...opcionesOpenAI(maxTokens),
    ...(web && { tools: [{ type: "web_search" }], include: ["web_search_call.action.sources"] })
  });
  revisarCorteOpenAI(resp, maxTokens);

  const fuentes = [];
  for (const item of resp.output) {
    if (item.type !== "message") continue;
    for (const c of item.content) {
      if (c.type === "output_text") (c.annotations || []).filter((a) => a.type === "url_citation").forEach((a) => agregarFuente(fuentes, a.url, a.title));
    }
  }
  // Si el texto no trae citas, usamos las páginas que consultó la búsqueda.
  if (!fuentes.length) {
    for (const item of resp.output) {
      if (item.type === "web_search_call") (item.action?.sources || []).forEach((f) => agregarFuente(fuentes, f.url));
    }
  }
  return { texto: resp.output_text, fuentes };
}
