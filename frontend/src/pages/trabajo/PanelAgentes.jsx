// Panel derecho: una pestaña por evaluador del caso (chat + evaluaciones) y la mesa de debate.
import { useEffect, useRef, useState } from "react";
import { fechaHora } from "../../lib/formato.js";
import { Avatar, Boton, Vacio } from "../../components/ui.jsx";
import { TarjetaEvaluacion } from "./piezas.jsx";

export default function PanelAgentes({ caso, mensajes, revisiones, debates, soloLectura, ocupado, onChat, onDebate }) {
  const conMesa = caso.agentes.length >= 2;
  const [tab, setTab] = useState(caso.agentes[0]?.id || "mesa");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  const input = useRef(null);
  const agente = caso.agentes.find((a) => a.id === tab);

  const delAgente = mensajes.filter((m) => m.canal === "agente" && m.agenteId === tab);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [tab, delAgente.length, debates.length]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || !agente) return;
    setEnviando(true);
    try { await onChat(agente.id, t); setTexto(""); } finally { setEnviando(false); }
  }

  const resultadoDe = (m) => revisiones.find((r) => r.numero === m.revisionNumero)?.resultados.find((r) => r.agenteId === m.agenteId);
  const ultimoDebate = debates.at(-1);

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex overflow-x-auto border-b border-linea">
        {caso.agentes.map((a) => (
          <button key={a.id} onClick={() => setTab(a.id)} title={a.nombre}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-[13px] whitespace-nowrap transition ${tab === a.id ? "border-tinta font-medium" : "border-transparent text-suave hover:text-tinta"}`}>
            <Avatar agente={a} chico /><span className="truncate">{a.mirada.split(" ")[0]}</span>
          </button>
        ))}
        {conMesa && (
          <button onClick={() => setTab("mesa")}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-[13px] transition ${tab === "mesa" ? "border-tinta font-medium" : "border-transparent text-suave hover:text-tinta"}`}>
            ⚖ Mesa
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {agente && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-suave"><span className="font-medium text-tinta">{agente.nombre}</span> · {agente.cargo}</div>
            {delAgente.length === 0 && (
              <Vacio>Todavía no hay conversación. Enviá tu propuesta a revisión o hacele una pregunta a {agente.nombre.split(" ").slice(-2).join(" ")}.</Vacio>
            )}
            {delAgente.map((m) => {
              const res = m.revisionNumero ? resultadoDe(m) : null;
              if (res) return <TarjetaEvaluacion key={m.id} resultado={res} numero={m.revisionNumero} secciones={caso.secciones}
                onPregunta={soloLectura ? null : (p) => { setTexto(`Sobre "${p}": `); input.current?.focus(); }} />;
              return (
                <div key={m.id} className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${m.autor === "alumno" ? "self-end rounded-br-sm bg-tinta text-white" : "rounded-bl-sm"}`}
                  style={m.autor === "alumno" ? undefined : { background: `${agente.color}1a` }}>
                  {m.texto}
                  <div className={`mt-1 text-[10px] ${m.autor === "alumno" ? "text-white/60" : "text-suave"}`}>{fechaHora(m.creadoEn)}</div>
                </div>
              );
            })}
            {enviando && <div className="rounded-xl px-3.5 py-2.5 text-[13px] text-suave" style={{ background: `${agente.color}1a` }}>{agente.nombre} está escribiendo…</div>}
          </div>
        )}

        {tab === "mesa" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-suave">Los evaluadores debaten tu propuesta entre sí y un moderador sintetiza el consenso hacia la solución más favorable.</p>
            {!soloLectura && <Boton variante="primario" onClick={onDebate} cargando={ocupado === "debate"} disabled={!!ocupado}>Convocar debate</Boton>}
            {!ultimoDebate && <Vacio>Todavía no hubo debates.</Vacio>}
            {ultimoDebate && <Debate debate={ultimoDebate} caso={caso} total={debates.length} />}
          </div>
        )}
        <div ref={fin} />
      </div>

      {agente && !soloLectura && (
        <form onSubmit={enviar} className="flex gap-2 border-t border-linea p-3">
          <input ref={input} className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={enviando || !!ocupado}
            placeholder={`Respondé o preguntale a ${agente.nombre.split(" ").slice(-2).join(" ")}…`} />
          <Boton variante="primario" type="submit" disabled={!texto.trim() || enviando || !!ocupado}>Enviar</Boton>
        </form>
      )}
    </div>
  );
}

function Debate({ debate, caso, total }) {
  const c = debate.consenso || {};
  const ag = (id) => caso.agentes.find((a) => a.id === id);
  const lista = (t, arr) => arr?.length > 0 && (
    <><h5 className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-suave">{t}</h5>
      <ul className="list-disc space-y-0.5 pl-4">{arr.map((x, i) => <li key={i}>{x}</li>)}</ul></>
  );
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-suave">Debate {total > 1 ? `#${total} · ` : ""}{fechaHora(debate.creadoEn)}</p>
      {debate.intervenciones.map((i, k) => {
        const a = ag(i.agenteId);
        return (
          <div key={k} className="rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ background: `${a?.color || "#999"}1a` }}>
            <span className="mb-0.5 block text-[11px] font-semibold" style={{ color: a?.color }}>{a?.nombre || "Evaluador"}</span>{i.texto}
          </div>
        );
      })}
      <div className="rounded-xl border-2 border-tinta bg-white p-4 text-[13.5px]">
        <h4 className="font-serif text-lg">Consenso de la mesa</h4>
        <p className="mt-1 leading-relaxed">{c.solucionRecomendada}</p>
        {lista("Acuerdos", c.acuerdos)}
        {lista("Desacuerdos", c.desacuerdos)}
        {c.etapas?.length > 0 && (
          <>
            <h5 className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-suave">Implementación por etapas</h5>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="text-left text-suave">{["Etapa", "Medidas", "Inversión", "Repago"].map((h) => <th key={h} className="border-b border-linea p-1.5 font-medium">{h}</th>)}</tr></thead>
                <tbody>{c.etapas.map((e, i) => (
                  <tr key={i} className="align-top">{[e.etapa, e.medidas, e.inversionEstimada, e.repagoEstimado].map((v, j) => <td key={j} className="border-b border-linea p-1.5">{v}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
        {lista("Tus próximos pasos", c.proximosPasosAlumno)}
      </div>
    </div>
  );
}
