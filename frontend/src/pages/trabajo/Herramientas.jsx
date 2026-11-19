// Panel lateral de herramientas: calculadora y asistente de IA (con búsqueda web opcional).
import { useEffect, useRef, useState } from "react";
import { evaluar } from "../../lib/calculadora.js";
import { markdownSimple, numero } from "../../lib/formato.js";
import { Boton, Vacio } from "../../components/ui.jsx";

export default function Herramientas({ abierto, onCerrar, mensajes, soloLectura, onAsistente }) {
  const [tab, setTab] = useState("calc");
  useEffect(() => {
    const f = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onCerrar]);
  if (!abierto) return null;
  const pestana = (id, txt) => (
    <button onClick={() => setTab(id)} className={`flex-1 border-b-2 py-3 text-sm transition ${tab === id ? "border-tinta font-medium" : "border-transparent text-suave hover:text-tinta"}`}>{txt}</button>
  );
  return (
    <aside className="aparecer fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-[440px] flex-col border-l border-linea bg-panel shadow-2xl">
      <div className="flex items-center border-b border-linea">
        {pestana("calc", "🧮 Calculadora")}{pestana("ia", "✦ Asistente IA")}
        <button className="px-4 text-2xl text-suave hover:text-tinta" onClick={onCerrar} aria-label="Cerrar">×</button>
      </div>
      {tab === "calc" ? <Calculadora /> : <Asistente mensajes={mensajes} soloLectura={soloLectura} onEnviar={onAsistente} />}
    </aside>
  );
}

const TECLAS = ["(", ")", "^", "%", ";", "ans", "raiz(", "ln(", "van(", "tir(", "repago(", "cuota("];

function Calculadora() {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState("");
  const [hist, setHist] = useState([]);
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);

  function calcular(e) {
    e.preventDefault();
    if (!expr.trim()) return;
    try {
      const v = evaluar(expr, hist[0]?.v);
      setHist([{ expr, v }, ...hist].slice(0, 30));
      setExpr(""); setError("");
    } catch (err) { setError(err.message); }
  }
  const agregar = (t) => { setExpr((x) => x + t); ref.current?.focus(); };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <form onSubmit={calcular} className="flex gap-2">
        <input ref={ref} className="campo font-mono" value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false}
          placeholder="Ej.: 620000 * 0,13 · van(12%; -50000; 18000; 18000)" />
        <Boton variante="primario" type="submit">=</Boton>
      </form>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="grid grid-cols-6 gap-1.5">
        {TECLAS.map((t) => (
          <button key={t} type="button" onClick={() => agregar(t)} className="rounded-md border border-linea bg-white py-1.5 font-mono text-xs hover:border-tinta">{t}</button>
        ))}
      </div>
      <h5 className="mt-1 text-[11px] font-medium uppercase tracking-wider text-suave">Historial <span className="normal-case tracking-normal">(clic para usar el resultado)</span></h5>
      <ul className="flex flex-col gap-1.5">
        {hist.map((h, i) => (
          <li key={i}>
            <button onClick={() => { navigator.clipboard?.writeText(String(h.v)).catch(() => {}); agregar(String(h.v)); }}
              className="flex w-full justify-between gap-3 rounded-md border border-linea bg-white px-3 py-2 text-left font-mono text-[13px] hover:border-tinta">
              <span className="truncate text-suave">{h.expr}</span><span className="font-medium whitespace-nowrap">= {numero(h.v, 6)}</span>
            </button>
          </li>
        ))}
      </ul>
      <details className="text-[13px] text-suave">
        <summary className="cursor-pointer">Funciones disponibles</summary>
        <p className="mt-2">Operadores <code className="font-mono text-tinta">+ - * / ^ ( )</code> y <code className="font-mono text-tinta">%</code> (12% = 0,12). Decimales con coma o punto; separá argumentos con <code className="font-mono text-tinta">;</code>.</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li><code className="font-mono text-tinta">raiz ln log exp abs redondear(x; n) min max suma pi e ans</code></li>
          <li><code className="font-mono text-tinta">van(tasa; f0; f1; …)</code> — f0 es la inversión, negativa</li>
          <li><code className="font-mono text-tinta">tir(f0; f1; …)</code> · <code className="font-mono text-tinta">repago(inversión; flujo)</code></li>
          <li><code className="font-mono text-tinta">cuota(tasa; n; préstamo)</code> · <code className="font-mono text-tinta">va(tasa; n; flujo)</code></li>
          <li><code className="font-mono text-tinta">equilibrio(costos fijos; precio; costo variable unitario)</code></li>
        </ul>
      </details>
    </div>
  );
}

function Asistente({ mensajes, soloLectura, onEnviar }) {
  const [texto, setTexto] = useState("");
  const [web, setWeb] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes.length, enviando]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try { await onEnviar(t, web); setTexto(""); } finally { setEnviando(false); }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <p className="text-sm text-suave">Consultá conceptos, fórmulas, precios o datos de referencia. El asistente orienta, pero no resuelve el caso por vos.</p>
        {mensajes.length === 0 && <Vacio>Ej.: “¿Cuánto cuesta un variador de 30 kW?” o “¿Cómo calculo el punto de equilibrio?”</Vacio>}
        {mensajes.map((m) => m.autor === "alumno" ? (
          <div key={m.id} className="max-w-[92%] self-end rounded-xl rounded-br-sm bg-tinta px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap text-white">{m.texto}</div>
        ) : (
          <div key={m.id} className="max-w-[96%] rounded-xl rounded-bl-sm border border-linea bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed">
            <span className="mb-0.5 block text-[11px] font-semibold text-suave">Asistente</span>
            <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: markdownSimple(m.texto) }} />
            {m.fuentes?.length > 0 && (
              <div className="mt-2 border-t border-linea pt-2 text-xs">
                <strong>Fuentes:</strong>
                {m.fuentes.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[#1f5f8b] hover:underline">{f.titulo || f.url}</a>)}
              </div>
            )}
          </div>
        ))}
        {enviando && <div className="rounded-xl border border-linea bg-white px-3.5 py-2.5 text-[13px] text-suave">{web ? "Buscando en la web…" : "Pensando…"}</div>}
        <div ref={fin} />
      </div>
      {!soloLectura && (
        <form onSubmit={enviar} className="flex flex-col gap-2 border-t border-linea p-3">
          <label className="flex items-center gap-2 text-sm text-suave"><input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} /> Buscar en la web</label>
          <div className="flex gap-2">
            <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={enviando} placeholder="Escribí tu consulta…" />
            <Boton variante="primario" type="submit" disabled={!texto.trim() || enviando}>Enviar</Boton>
          </div>
        </form>
      )}
    </>
  );
}
