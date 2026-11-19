// Frontend del simulador. Vanilla JS, sin build.
// En producción (o servido por el backend en :3000) la API está en el mismo origen.
// Solo en desarrollo, si se abre como archivo o con Live Server, apuntamos al backend local.
const esDesarrolloLocal = location.protocol === "file:" ||
  (["localhost", "127.0.0.1"].includes(location.hostname) && location.port !== "3000");
const API = esDesarrolloLocal ? "http://localhost:3000/api" : "/api";
const PASOS = [
  { id: "diagnostico", nombre: "Diagnóstico" },
  { id: "cambiosTecnicos", nombre: "Cambios técnicos" },
  { id: "automatizacion", nombre: "Automatización" },
  { id: "presupuesto", nombre: "Presupuesto" },
  { id: "ahorro", nombre: "Ahorro y repago" }
];
const NOMBRES = { tecnico: "Ing. Laura Benítez", economico: "Cr. Ricardo Ferraro" };
const VEREDICTO_TXT = { aprobado: "Aprobado", aprobado_con_cambios: "Aprobado con cambios", rechazado: "Rechazado" };

const st = { sesion: null, caso: null, paso: 0, tab: "tecnico", finanzas: null, ultimaRevision: null };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const usd = (n) => n == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function api(path, opts = {}) {
  const r = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Error de servidor");
  return data;
}
function cargando(on, txt) {
  $("#cargando").classList.toggle("hidden", !on);
  if (txt) $("#cargandoTxt").textContent = txt;
}

// ================= PANTALLA CASOS =================
async function init() {
  const info = await api("/info");
  $("#demoBadge").classList.toggle("hidden", !info.modoDemo);
  const casos = await api("/casos");
  $("#listaCasos").innerHTML = casos.map((c) => `
    <article class="card-caso" data-id="${c.id}">
      <div class="tags"><span class="tag">${esc(c.area)}</span><span class="tag">${esc(c.dificultad)}</span></div>
      <h3>${esc(c.titulo)}</h3>
      <p>${esc(c.enunciado)}</p>
      <button class="btn primary">Empezar caso →</button>
    </article>`).join("");
  $$(".card-caso").forEach((el) => el.addEventListener("click", () => iniciarCaso(el.dataset.id)));
  $("#btnVolver").addEventListener("click", () => mostrarPantalla("casos"));
}

function mostrarPantalla(p) {
  $("#pantallaCasos").classList.toggle("hidden", p !== "casos");
  $("#pantallaTrabajo").classList.toggle("hidden", p !== "trabajo");
  $("#btnVolver").classList.toggle("hidden", p !== "trabajo");
}

async function iniciarCaso(casoId) {
  const posturas = { tecnico: $("#posturaTecnico").value, economico: $("#posturaEconomico").value };
  st.sesion = await api("/sesiones", { method: "POST", body: { casoId, posturas } });
  st.caso = await api("/casos/" + casoId);
  st.paso = 0; st.ultimaRevision = null;
  renderCaso();
  cargarSolucionEnFormulario();
  renderPasos();
  renderChats();
  $("#debate").innerHTML = "";
  ["tecnico", "economico"].forEach((a) => setVeredicto(a, null));
  await guardar();
  mostrarPantalla("trabajo");
}

// ================= CASO =================
function renderCaso() {
  const c = st.caso;
  $("#panelCaso").innerHTML = `
    <div class="tags"><span class="tag">${esc(c.area)}</span><span class="tag">${esc(c.dificultad)}</span></div>
    <h3 style="margin-top:.6rem">${esc(c.titulo)}</h3>
    <p>${esc(c.enunciado)}</p>
    <h4>Datos</h4>
    <dl>${c.datos.map((d) => `<div><dt>${esc(d.clave)}</dt><dd>${esc(d.valor)}</dd></div>`).join("")}</dl>
    <h4>Objetivos</h4><ul>${c.objetivos.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    <h4>Restricciones</h4><ul>${c.restricciones.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    <h4>Posturas de la mesa</h4>
    <p class="muted">Técnica: ${st.sesion.posturas.tecnico} · Económica: ${st.sesion.posturas.economico}</p>`;
}

// ================= CONSTRUCTOR =================
function renderPasos() {
  const obsPorSeccion = {};
  if (st.ultimaRevision) {
    for (const a of ["tecnico", "economico"]) {
      for (const o of st.ultimaRevision[a].observaciones || []) {
        const sec = o.seccion === "ahorro" ? "ahorro" : o.seccion;
        const prev = obsPorSeccion[sec];
        if (!prev || o.gravedad === "alta") obsPorSeccion[sec] = o.gravedad;
      }
    }
  }
  const sol = st.sesion.solucion;
  $("#pasos").innerHTML = PASOS.map((p, i) => {
    const lleno = p.id === "presupuesto" ? sol.items.length > 0 : p.id === "ahorro" ? sol.ahorroAnual > 0 : (sol[p.id] || "").trim().length > 30;
    const g = obsPorSeccion[p.id];
    const dot = g === "alta" ? "alta" : g === "media" ? "media" : lleno ? "done" : "";
    return `<button class="${i === st.paso ? "active" : ""}" data-i="${i}"><span class="dot ${dot}"></span>${i + 1}. ${p.nombre}</button>`;
  }).join("");
  $$("#pasos button").forEach((b) => b.addEventListener("click", () => irAPaso(+b.dataset.i)));
  PASOS.forEach((p, i) => $("#paso-" + p.id).classList.toggle("hidden", i !== st.paso));
  $("#btnPrev").disabled = st.paso === 0;
  $("#btnNext").disabled = st.paso === PASOS.length - 1;
  renderObsInline();
}
function irAPaso(i) { st.paso = Math.max(0, Math.min(PASOS.length - 1, i)); renderPasos(); }

// Muestra las observaciones de la última revisión debajo de cada sección
function renderObsInline() {
  $$(".obs-inline").forEach((e) => e.remove());
  if (!st.ultimaRevision) return;
  for (const p of PASOS) {
    const obs = ["tecnico", "economico"].flatMap((a) =>
      (st.ultimaRevision[a].observaciones || []).filter((o) => o.seccion === p.id).map((o) => ({ ...o, a })));
    if (!obs.length) continue;
    const div = document.createElement("div");
    div.className = "obs-inline";
    div.innerHTML = obs.map((o) => `<div class="o ${o.a}"><span class="grav ${o.gravedad}">${o.gravedad}</span><strong>${NOMBRES[o.a].split(" ").slice(-1)}:</strong> ${esc(o.detalle)}</div>`).join("");
    $("#paso-" + p.id).appendChild(div);
  }
}

function cargarSolucionEnFormulario() {
  const sol = st.sesion.solucion;
  $$("[data-campo]").forEach((el) => { el.value = sol[el.dataset.campo] ?? ""; });
  renderItems();
}

function renderItems() {
  const items = st.sesion.solucion.items;
  $("#itemsBody").innerHTML = items.map((it, i) => `
    <tr data-i="${i}">
      <td><input data-k="concepto" value="${esc(it.concepto)}" placeholder="Ej.: Variador 30 kW" /></td>
      <td><input data-k="cantidad" type="number" min="0" value="${it.cantidad}" /></td>
      <td><input data-k="costoUnitario" type="number" min="0" step="10" value="${it.costoUnitario}" /></td>
      <td class="num-cell">${usd((+it.cantidad || 0) * (+it.costoUnitario || 0))}</td>
      <td><button class="btn-x" title="Quitar">×</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted" style="padding:1rem">Sin ítems todavía.</td></tr>`;
  $$("#itemsBody tr[data-i]").forEach((tr) => {
    const i = +tr.dataset.i;
    tr.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
      const k = inp.dataset.k;
      items[i][k] = k === "concepto" ? inp.value : Number(inp.value);
      tr.children[3].textContent = usd((+items[i].cantidad || 0) * (+items[i].costoUnitario || 0));
      programarGuardado();
    }));
    tr.querySelector(".btn-x").addEventListener("click", () => { items.splice(i, 1); renderItems(); programarGuardado(); });
  });
  $("#totalItems").textContent = usd(items.reduce((a, it) => a + (+it.cantidad || 0) * (+it.costoUnitario || 0), 0));
}

let timer;
function programarGuardado() { clearTimeout(timer); timer = setTimeout(guardar, 400); }
async function guardar() {
  const r = await api(`/sesiones/${st.sesion.id}/solucion`, { method: "PUT", body: st.sesion.solucion });
  st.finanzas = r.finanzas;
  renderKPIs();
  renderGrafico();
  $("#totalItems").textContent = usd(r.finanzas.inversion);
  renderPasos();
}

function renderKPIs() {
  const f = st.finanzas;
  const k = (label, v, cls = "") => `<div class="kpi"><span class="k">${label}</span><span class="v ${cls}">${v}</span></div>`;
  $("#kpis").innerHTML =
    k("Inversión", usd(f.inversion)) +
    k("Flujo neto/año", usd(f.flujoNetoAnual), f.flujoNetoAnual > 0 ? "pos" : "") +
    k("Repago simple", f.repagoSimpleAnios == null ? "—" : f.repagoSimpleAnios + " años") +
    k("Repago desc.", f.repagoDescontadoAnios == null ? "—" : f.repagoDescontadoAnios + " años") +
    k(`VAN (${f.tasaDescuento}%)`, usd(f.van), f.van > 0 ? "pos" : f.van < 0 ? "neg" : "") +
    k("TIR", f.tir == null ? "—" : f.tir + "%");
}

function renderGrafico() {
  const pts = st.finanzas.flujoAcumulado;
  const svg = $("#grafico");
  if (!pts.length || st.finanzas.inversion === 0) { svg.innerHTML = `<text x="300" y="100" text-anchor="middle" fill="#6c675c" font-size="13">Cargá presupuesto y ahorro para ver el gráfico</text>`; return; }
  const W = 600, H = 200, P = 28;
  const vals = pts.map((p) => p.acumulado);
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const x = (i) => P + (i * (W - 2 * P)) / (pts.length - 1 || 1);
  const y = (v) => H - P - ((v - min) * (H - 2 * P)) / (max - min || 1);
  const bw = Math.max(4, (W - 2 * P) / pts.length * 0.6);
  const barras = pts.map((p, i) => {
    const y0 = y(0), y1 = y(p.acumulado);
    return `<rect x="${x(i) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.abs(y1 - y0)}" fill="${p.acumulado >= 0 ? "#2f7a45" : "#b23a2e"}" opacity=".8"><title>Año ${p.anio}: ${usd(p.acumulado)}</title></rect>`;
  }).join("");
  const labels = pts.map((p, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6c675c">${p.anio}</text>`).join("");
  svg.innerHTML = `<line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" stroke="#1d1b16" stroke-width="1"/>${barras}${labels}`;
}

// ================= AGENTES =================
function setVeredicto(agente, rev) {
  const el = $(agente === "tecnico" ? "#verTecnico" : "#verEconomico");
  el.className = "veredicto " + (rev ? rev.veredicto : "");
  el.querySelector(".v-label").textContent = rev ? `${VEREDICTO_TXT[rev.veredicto] || rev.veredicto} · ${rev.puntaje}/10` : "Sin revisar";
}

function renderChats() {
  for (const a of ["tecnico", "economico"]) {
    const cont = $("#chat-" + a);
    const msgs = st.sesion.chats[a];
    const evals = st.sesion.revisiones || [];
    if (!msgs.length) {
      cont.innerHTML = `<div class="vacio">Cuando envíes tu propuesta a revisión, ${NOMBRES[a]} te va a devolver su evaluación acá.<br><br>También podés preguntarle lo que quieras mientras armás la solución.</div>`;
      continue;
    }
    cont.innerHTML = msgs.map((m) => {
      if (m.de === "agente" && m.revision) {
        const r = evals.find((x) => x.n === m.revision)?.[a];
        if (r) return renderEval(a, r, m.revision);
      }
      return `<div class="msg ${m.de} ${a}">${m.de === "agente" ? `<span class="autor">${NOMBRES[a]}</span>` : ""}${esc(m.texto)}</div>`;
    }).join("");
    cont.querySelectorAll(".pregunta").forEach((p) => p.addEventListener("click", () => { $("#chatMsg").value = "Sobre tu pregunta \"" + p.textContent + "\": "; $("#chatMsg").focus(); }));
    cont.parentElement.scrollTop = cont.parentElement.scrollHeight;
  }
}

function renderEval(a, r, n) {
  const lista = (arr, fn) => arr?.length ? `<ul>${arr.map(fn).join("")}</ul>` : "";
  return `<div class="eval">
    <div class="cab"><span class="autor ${a}" style="color:var(--${a === "tecnico" ? "tec" : "eco"});font-weight:600">${NOMBRES[a]} · Revisión #${n}</span><span class="puntaje">${r.puntaje}/10</span></div>
    <div class="veredicto ${r.veredicto}" style="display:inline-flex;margin-bottom:.5rem">${VEREDICTO_TXT[r.veredicto] || r.veredicto}</div>
    <div class="msg agente ${a}" style="max-width:100%">${esc(r.mensaje)}</div>
    ${r.fortalezas?.length ? `<h5>Fortalezas</h5>${lista(r.fortalezas, (f) => `<li>${esc(f)}</li>`)}` : ""}
    ${r.observaciones?.length ? `<h5>Observaciones</h5>${lista(r.observaciones, (o) => `<li><span class="grav ${o.gravedad}">${o.gravedad}</span><em>${esc(o.seccion)}</em> — ${esc(o.detalle)}</li>`)}` : ""}
    ${r.preguntas?.length ? `<h5>Preguntas (clic para responder)</h5>${lista(r.preguntas, (p) => `<li class="pregunta">${esc(p)}</li>`)}` : ""}
  </div>`;
}

async function enviarRevision() {
  await guardar();
  cargando(true, "Los evaluadores están leyendo tu propuesta…");
  try {
    const rev = await api(`/sesiones/${st.sesion.id}/revision`, { method: "POST" });
    st.sesion = await api(`/sesiones/${st.sesion.id}`);
    st.ultimaRevision = rev;
    setVeredicto("tecnico", rev.tecnico);
    setVeredicto("economico", rev.economico);
    renderChats();
    renderPasos();
    if (rev.consensoAprobado) {
      $("#debate").insertAdjacentHTML("afterbegin", `<div class="banner-ok">✔ ¡Ambos evaluadores aprobaron tu propuesta! Convocá el debate para ver si se puede optimizar aún más.</div>`);
      cambiarTab("debate");
    }
  } catch (e) { alert(e.message); }
  cargando(false);
}

async function enviarChat(ev) {
  ev.preventDefault();
  const msg = $("#chatMsg").value.trim();
  if (!msg) return;
  if (st.tab === "debate") cambiarTab("tecnico");
  const a = st.tab;
  st.sesion.chats[a].push({ de: "alumno", texto: msg });
  $("#chatMsg").value = "";
  renderChats();
  $("#chat-" + a).insertAdjacentHTML("beforeend", `<div class="msg agente ${a} escribiendo"><span class="autor">${NOMBRES[a]}</span>escribiendo…</div>`);
  try {
    await guardar();
    await api(`/sesiones/${st.sesion.id}/chat`, { method: "POST", body: { agente: a, mensaje: msg } });
    st.sesion = await api(`/sesiones/${st.sesion.id}`);
  } catch (e) {
    st.sesion.chats[a].pop();
    alert(e.message);
  }
  renderChats();
}

async function convocarDebate() {
  await guardar();
  cargando(true, "La mesa está debatiendo tu propuesta…");
  try {
    const d = await api(`/sesiones/${st.sesion.id}/debate`, { method: "POST" });
    const c = d.consenso || {};
    $("#debate").innerHTML =
      d.intervenciones.map((i) => `<div class="msg agente ${i.agente}" style="max-width:100%"><span class="autor">${NOMBRES[i.agente]}</span>${esc(i.texto)}</div>`).join("") +
      `<div class="consenso">
        <h4>Consenso de la mesa</h4>
        <p>${esc(c.solucionRecomendada)}</p>
        ${c.acuerdos?.length ? `<h5>Acuerdos</h5><ul>${c.acuerdos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${c.desacuerdos?.length ? `<h5>Desacuerdos</h5><ul>${c.desacuerdos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${c.etapas?.length ? `<h5>Implementación por etapas</h5><table><tr><th>Etapa</th><th>Medidas</th><th>Inversión</th><th>Repago</th></tr>${c.etapas.map((e) => `<tr><td>${esc(e.etapa)}</td><td>${esc(e.medidas)}</td><td>${esc(e.inversionEstimada)}</td><td>${esc(e.repagoEstimado)}</td></tr>`).join("")}</table>` : ""}
        ${c.proximosPasosAlumno?.length ? `<h5>Tus próximos pasos</h5><ul>${c.proximosPasosAlumno.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>`;
  } catch (e) { alert(e.message); }
  cargando(false);
}

function cambiarTab(t) {
  st.tab = t;
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + t));
  $("#chatMsg").placeholder = t === "debate" ? "Escribile a la evaluadora técnica…" : `Respondé o preguntale a ${NOMBRES[t]}…`;
}

// ================= EVENTOS =================
$$("[data-campo]").forEach((el) => el.addEventListener("input", () => {
  const k = el.dataset.campo;
  st.sesion.solucion[k] = el.type === "number" ? Number(el.value) : el.value;
  programarGuardado();
}));
$("#btnAddItem").addEventListener("click", () => { st.sesion.solucion.items.push({ concepto: "", cantidad: 1, costoUnitario: 0 }); renderItems(); });
$("#btnPrev").addEventListener("click", () => irAPaso(st.paso - 1));
$("#btnNext").addEventListener("click", () => irAPaso(st.paso + 1));
$("#btnRevision").addEventListener("click", enviarRevision);
$("#btnDebate").addEventListener("click", convocarDebate);
$("#chatForm").addEventListener("submit", enviarChat);
$$(".tab").forEach((b) => b.addEventListener("click", () => cambiarTab(b.dataset.tab)));

// ================= HERRAMIENTAS: CALCULADORA =================
// Evaluador propio (sin eval): números, + - * / ^, %, paréntesis, funciones y constantes.
const CALC_FUN = {
  raiz: Math.sqrt, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
  sen: Math.sin, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a), suma: (...a) => a.reduce((s, x) => s + x, 0),
  redondear: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, round: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n,
  van: (t, ...f) => f.reduce((s, x, i) => s + x / (1 + t) ** i, 0),
  npv: (t, ...f) => f.reduce((s, x, i) => s + x / (1 + t) ** i, 0),
  tir: (...f) => calcTIR(f), irr: (...f) => calcTIR(f),
  repago: (inv, flujo) => Math.abs(inv) / flujo,
  cuota: (t, n, p) => (t === 0 ? p / n : (p * t) / (1 - (1 + t) ** -n)),
  va: (t, n, f) => (t === 0 ? f * n : (f * (1 - (1 + t) ** -n)) / t)
};
function calcTIR(f) {
  const van = (r) => f.reduce((s, x, i) => s + x / (1 + r) ** i, 0);
  let lo = -0.99, hi = 10;
  if (van(lo) * van(hi) > 0) throw new Error("La TIR no está definida para esos flujos");
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (van(lo) * van(m) <= 0) ? (hi = m) : (lo = m); }
  return (lo + hi) / 2;
}
function evaluar(expr, ans) {
  const toks = expr.replace(/\s+/g, "").match(/\d+(?:[.,]\d+)?|[a-záéíóúñ_]+|[-+*/^%();]|./gi) || [];
  let i = 0;
  const ver = () => toks[i], tomar = (t) => { if (toks[i] !== t) throw new Error(`Se esperaba "${t}"`); i++; };
  const suma = () => { let v = prod(); while (ver() === "+" || ver() === "-") v = toks[i++] === "+" ? v + prod() : v - prod(); return v; };
  const prod = () => { let v = unario(); while (ver() === "*" || ver() === "/") v = toks[i++] === "*" ? v * unario() : v / unario(); return v; };
  const unario = () => (ver() === "-" ? (i++, -unario()) : ver() === "+" ? (i++, unario()) : pot());
  const pot = () => { const b = postfijo(); return ver() === "^" ? (i++, b ** unario()) : b; };
  const postfijo = () => { let v = atomo(); while (ver() === "%") { i++; v /= 100; } return v; };
  const atomo = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error("Expresión incompleta");
    if (/^\d/.test(t)) return parseFloat(t.replace(",", "."));
    if (t === "(") { const v = suma(); tomar(")"); return v; }
    const n = t.toLowerCase();
    if (n === "pi") return Math.PI;
    if (n === "e") return Math.E;
    if (n === "ans") return ans ?? 0;
    if (CALC_FUN[n]) {
      tomar("(");
      const args = [];
      if (ver() !== ")") { args.push(suma()); while (ver() === ";") { i++; args.push(suma()); } }
      tomar(")");
      return CALC_FUN[n](...args);
    }
    throw new Error(`No reconozco "${t}"`);
  };
  const v = suma();
  if (i < toks.length) throw new Error(`Sobra "${toks[i]}"`);
  if (!Number.isFinite(v)) throw new Error("El resultado no es un número finito");
  return v;
}
const fmtNum = (v) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 }).format(v);
const calcHist = [];
function calcular(ev) {
  ev?.preventDefault();
  const expr = $("#calcExpr").value.trim();
  if (!expr) return;
  try {
    const v = evaluar(expr, calcHist[0]?.v);
    calcHist.unshift({ expr, v });
    $("#calcError").textContent = "";
    $("#calcExpr").value = "";
    renderCalcHist();
  } catch (e) { $("#calcError").textContent = e.message; }
}
function renderCalcHist() {
  $("#calcHist").innerHTML = calcHist.slice(0, 30).map((h, k) =>
    `<li data-k="${k}" title="Copiar"><span class="ex">${esc(h.expr)}</span><span class="res">= ${fmtNum(h.v)}</span></li>`).join("");
  $$("#calcHist li").forEach((li) => li.addEventListener("click", () => {
    const v = String(calcHist[li.dataset.k].v);
    navigator.clipboard?.writeText(v).catch(() => {});
    $("#calcExpr").value += v; $("#calcExpr").focus();
  }));
}
$("#calcTeclas").innerHTML = ["(", ")", "^", "%", ";", "ans", "raiz(", "ln(", "van(", "tir(", "repago(", "cuota("]
  .map((k) => `<button type="button">${k}</button>`).join("");
$$("#calcTeclas button").forEach((b) => b.addEventListener("click", () => { $("#calcExpr").value += b.textContent; $("#calcExpr").focus(); }));
$("#calcForm").addEventListener("submit", calcular);

// ================= HERRAMIENTAS: ASISTENTE IA =================
const chatIA = [];
function renderChatIA() {
  $("#chatIA").innerHTML = chatIA.length ? chatIA.map((m) => m.role === "user"
    ? `<div class="msg alumno">${esc(m.content)}</div>`
    : `<div class="msg ia"><span class="autor">Asistente${m.web ? " · web" : ""}</span>${esc(m.content).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^#+\s*/gm, "")}${m.fuentes?.length
      ? `<div class="fuentes"><strong>Fuentes:</strong>${m.fuentes.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo || f.url)}</a>`).join("")}</div>` : ""}</div>`
  ).join("") : `<div class="vacio">Preguntá lo que necesites para armar tu propuesta: fórmulas, precios de referencia, normativa, datos técnicos…</div>`;
  const p = $("#htab-ia"); p.scrollTop = p.scrollHeight;
}
async function enviarIA(ev) {
  ev.preventDefault();
  const msg = $("#iaMsg").value.trim();
  if (!msg) return;
  const web = $("#iaWeb").checked;
  chatIA.push({ role: "user", content: msg });
  $("#iaMsg").value = "";
  renderChatIA();
  $("#chatIA").insertAdjacentHTML("beforeend", `<div class="msg ia escribiendo"><span class="autor">Asistente</span>${web ? "buscando en la web…" : "pensando…"}</div>`);
  const btn = $("#iaForm button"); btn.disabled = true;
  try {
    const r = await api("/asistente", { method: "POST", body: {
      mensajes: chatIA.map(({ role, content }) => ({ role, content })), web, sesionId: st.sesion?.id } });
    chatIA.push({ role: "assistant", content: r.texto, fuentes: r.fuentes, web });
  } catch (e) {
    chatIA.pop();
    $("#iaMsg").value = msg;
    alert(e.message);
  }
  btn.disabled = false;
  renderChatIA();
}
$("#iaForm").addEventListener("submit", enviarIA);

// ================= HERRAMIENTAS: PANEL =================
function cambiarHTab(t) {
  $$("[data-htab]").forEach((b) => b.classList.toggle("active", b.dataset.htab === t));
  $$(".hpanel").forEach((p) => p.classList.toggle("hidden", p.id !== "htab-" + t));
  (t === "calc" ? $("#calcExpr") : $("#iaMsg")).focus();
}
$$("[data-htab]").forEach((b) => b.addEventListener("click", () => cambiarHTab(b.dataset.htab)));
$("#btnHerramientas").addEventListener("click", () => {
  const abrir = $("#herramientas").classList.toggle("hidden") === false;
  if (abrir) $("#calcExpr").focus();
});
$("#btnCerrarHerr").addEventListener("click", () => $("#herramientas").classList.add("hidden"));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#herramientas").classList.add("hidden"); });
renderChatIA();

init().catch((e) => { document.body.insertAdjacentHTML("beforeend", `<p style="padding:2rem;color:#b23a2e">No se pudo conectar con el servidor: ${esc(e.message)}</p>`); });
