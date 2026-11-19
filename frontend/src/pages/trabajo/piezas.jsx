// Piezas del espacio de trabajo: panel del caso, indicadores, gráfico de flujo y tarjeta de evaluación.
import { dinero, numero, POSTURAS } from "../../lib/formato.js";
import { Avatar, Tag, Veredicto } from "../../components/ui.jsx";

export function PanelCaso({ caso }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap gap-1.5"><Tag>{caso.area}</Tag><Tag>{caso.dificultad}</Tag></div>
      <h2 className="text-base font-semibold leading-snug">{caso.titulo}</h2>
      <p className="whitespace-pre-line leading-relaxed">{caso.enunciado}</p>
      {caso.datos?.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-suave">Datos</h4>
          <dl className="flex flex-col gap-2">
            {caso.datos.map((d, i) => (
              <div key={i}><dt className="text-xs text-suave">{d.clave}</dt><dd className="font-mono text-[13px]">{d.valor}</dd></div>
            ))}
          </dl>
        </section>
      )}
      {[["Objetivos", caso.objetivos], ["Restricciones", caso.restricciones]].map(([t, arr]) => arr?.length > 0 && (
        <section key={t}>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-suave">{t}</h4>
          <ul className="list-disc space-y-1 pl-4">{arr.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      ))}
      <section>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-suave">Evaluadores</h4>
        <div className="flex flex-col gap-3">
          {caso.agentes.map((a) => (
            <div key={a.id} className="flex gap-3">
              <Avatar agente={a} />
              <div className="min-w-0">
                <p className="font-medium">{a.nombre}</p>
                <p className="text-xs text-suave">{a.cargo} · postura {POSTURAS[a.postura]?.toLowerCase()}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Kpis({ fin, moneda }) {
  const kpi = (k, v, signo) => (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-suave">{k}</span>
      <span className={`font-mono text-[15px] font-medium ${signo > 0 ? "text-ok" : signo < 0 ? "text-error" : ""}`}>{v}</span>
    </div>
  );
  const anios = (x) => (x == null ? "no recupera" : `${numero(x, 1)} años`);
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {kpi("Inversión", dinero(fin.inversion, moneda))}
      {kpi("Flujo neto anual", dinero(fin.flujoNetoAnual, moneda), Math.sign(fin.flujoNetoAnual))}
      {kpi("Repago simple", anios(fin.repagoSimpleAnios))}
      {kpi("Repago descontado", anios(fin.repagoDescontadoAnios))}
      {kpi(`VAN (${numero(fin.tasaDescuento, 1)}%)`, dinero(fin.van, moneda), Math.sign(Math.round(fin.van)))}
      {kpi("TIR", fin.tir == null ? "—" : `${numero(fin.tir, 1)}%`)}
    </div>
  );
}

/** Flujo de fondos acumulado: barras por año, en verde cuando ya se recuperó la inversión. */
export function GraficoFlujo({ fin, moneda }) {
  const datos = fin.flujoAcumulado;
  const W = 600, H = 200, pad = { l: 64, r: 12, t: 12, b: 26 };
  const vals = datos.map((d) => d.acumulado);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const rango = max - min || 1;
  const y = (v) => pad.t + ((max - v) / rango) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / datos.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full rounded-lg border border-linea bg-white" role="img" aria-label="Flujo de fondos acumulado por año">
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#1d1b16" strokeWidth="1" />
      {[max, min].filter((v, i, a) => a.indexOf(v) === i && v !== 0 && Math.abs(y(v) - y(0)) > 14).map((v) => (
        <text key={v} x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#6c675c">{dinero(v, moneda)}</text>
      ))}
      <text x={pad.l - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="#6c675c">0</text>
      {datos.map((d, i) => {
        const x = pad.l + i * bw + bw * 0.15, top = Math.min(y(d.acumulado), y(0));
        return (
          <g key={d.anio}>
            <rect x={x} y={top} width={bw * 0.7} height={Math.max(1, Math.abs(y(d.acumulado) - y(0)))} rx="2"
              fill={d.acumulado >= 0 ? "#2f7a45" : "#b23a2e"} opacity={d.acumulado >= 0 ? 0.85 : 0.7}>
              <title>Año {d.anio}: {dinero(d.acumulado, moneda)}</title>
            </rect>
            <text x={x + bw * 0.35} y={H - 8} textAnchor="middle" fontSize="10" fill="#6c675c">{d.anio}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Resultado de un agente en una revisión. `onPregunta` permite responder una pregunta desde el chat. */
export function TarjetaEvaluacion({ resultado, numero: nro, secciones, onPregunta }) {
  const tituloSeccion = (id) => secciones.find((s) => s.id === id)?.titulo || (id === "general" ? "General" : id);
  const grav = { alta: "bg-error-suave text-error", media: "bg-aviso-suave text-aviso", baja: "bg-[#eee] text-suave" };
  return (
    <div className="rounded-xl border border-linea bg-white p-3 text-[13px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-suave">Revisión #{nro}</span>
        <div className="flex items-center gap-2"><Veredicto veredicto={resultado.veredicto} /><span className="font-mono text-lg">{numero(resultado.puntaje, 1)}<span className="text-xs text-suave">/10</span></span></div>
      </div>
      <p className="leading-relaxed">{resultado.mensaje}</p>
      {resultado.fortalezas?.length > 0 && (
        <>
          <h5 className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-suave">Fortalezas</h5>
          <ul className="list-disc space-y-0.5 pl-4">{resultado.fortalezas.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      )}
      {resultado.observaciones?.length > 0 && (
        <>
          <h5 className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-suave">Observaciones</h5>
          <ul className="space-y-1.5">
            {resultado.observaciones.map((o, i) => (
              <li key={i}>
                <span className={`mr-1.5 rounded px-1.5 py-px font-mono text-[10px] ${grav[o.gravedad] || grav.baja}`}>{o.gravedad}</span>
                <span className="font-medium">{tituloSeccion(o.seccion)}:</span> {o.detalle}
              </li>
            ))}
          </ul>
        </>
      )}
      {resultado.preguntas?.length > 0 && (
        <>
          <h5 className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-suave">Preguntas</h5>
          <ul className="list-disc space-y-0.5 pl-4">
            {resultado.preguntas.map((p, i) => (
              <li key={i}>
                {onPregunta
                  ? <button className="text-left underline decoration-dotted underline-offset-2 hover:text-suave" onClick={() => onPregunta(p)}>{p}</button>
                  : p}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
