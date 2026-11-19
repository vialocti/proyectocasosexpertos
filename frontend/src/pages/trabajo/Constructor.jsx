// Constructor de la propuesta: una sección a la vez, según la configuración del caso.
import { dinero } from "../../lib/formato.js";
import { Boton, Campo, Input, Textarea } from "../../components/ui.jsx";
import { GraficoFlujo } from "./piezas.jsx";

const ORDEN_GRAV = { alta: 3, media: 2, baja: 1 };

export function seccionCompleta(s, sol) {
  if (s.tipo === "presupuesto") return (sol.items || []).some((it) => it.concepto && Number(it.costoUnitario) > 0);
  if (s.tipo === "flujo") return Number(sol.ahorroAnual) > 0 && (sol.secciones?.[s.id] || "").trim().length > 20;
  return (sol.secciones?.[s.id] || "").trim().length > 20;
}

export default function Constructor({ caso, sol, setSol, fin, paso, setPaso, ultimaRevision, soloLectura, onRevision, revisando }) {
  const secciones = caso.secciones;
  const s = secciones[paso];
  const moneda = caso.moneda || "USD";

  // Observaciones de la última revisión, agrupadas por sección.
  const obsPorSeccion = {};
  for (const r of ultimaRevision?.resultados || []) {
    const ag = caso.agentes.find((a) => a.id === r.agenteId);
    for (const o of r.observaciones || []) (obsPorSeccion[o.seccion] ||= []).push({ ...o, agente: ag });
  }
  const peor = (id) => (obsPorSeccion[id] || []).reduce((m, o) => (ORDEN_GRAV[o.gravedad] > ORDEN_GRAV[m] ? o.gravedad : m), "");

  const setTexto = (id, v) => setSol({ ...sol, secciones: { ...sol.secciones, [id]: v } });
  const setCampo = (k, v) => setSol({ ...sol, [k]: v });

  if (!s) return <p className="text-suave">Este caso todavía no tiene secciones configuradas.</p>;

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1.5">
        {secciones.map((x, i) => {
          const g = peor(x.id);
          const punto = g === "alta" ? "bg-error" : g === "media" ? "bg-aviso" : seccionCompleta(x, sol) ? "bg-ok" : "bg-linea";
          return (
            <button key={x.id} onClick={() => setPaso(i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition ${i === paso ? "border-tinta bg-tinta text-white" : "border-linea hover:border-tinta"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${punto}`} />{x.titulo}
            </button>
          );
        })}
      </nav>

      <section key={s.id} className="tarjeta aparecer p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-tinta text-sm text-white">{paso + 1}</span>{s.titulo}
        </h2>
        {s.ayuda && <p className="mb-4 text-sm text-suave">{s.ayuda}</p>}

        {s.tipo === "texto" && (
          <Textarea rows={11} value={sol.secciones?.[s.id] || ""} placeholder={s.placeholder} disabled={soloLectura}
            onChange={(e) => setTexto(s.id, e.target.value)} />
        )}

        {s.tipo === "presupuesto" && <TablaPresupuesto items={sol.items || []} moneda={moneda} soloLectura={soloLectura}
          onChange={(items) => setCampo("items", items)} />}

        {s.tipo === "flujo" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo etiqueta={`${s.etiquetaIngreso || "Ahorro anual estimado"} (${moneda})`}>
                <Input type="number" min="0" step="100" value={sol.ahorroAnual || ""} disabled={soloLectura} onChange={(e) => setCampo("ahorroAnual", Number(e.target.value))} />
              </Campo>
              <Campo etiqueta={`${s.etiquetaCosto || "Costo operativo adicional"} (${moneda}/año)`}>
                <Input type="number" min="0" step="100" value={sol.costoOperativoAnual || ""} disabled={soloLectura} onChange={(e) => setCampo("costoOperativoAnual", Number(e.target.value))} />
              </Campo>
              <Campo etiqueta="Horizonte / vida útil (años)">
                <Input type="number" min="1" max="50" value={sol.vidaUtil || ""} disabled={soloLectura} onChange={(e) => setCampo("vidaUtil", Number(e.target.value))} />
              </Campo>
            </div>
            <Campo etiqueta="Justificación">
              <Textarea rows={6} value={sol.secciones?.[s.id] || ""} placeholder={s.placeholder} disabled={soloLectura} onChange={(e) => setTexto(s.id, e.target.value)} />
            </Campo>
            <div>
              <h4 className="mb-1.5 text-sm text-suave">Flujo de fondos acumulado</h4>
              <GraficoFlujo fin={fin} moneda={moneda} />
            </div>
          </div>
        )}

        {(obsPorSeccion[s.id] || []).length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {obsPorSeccion[s.id].map((o, i) => (
              <div key={i} className="rounded-r border-l-[3px] bg-white px-3 py-2 text-[13px]" style={{ borderColor: o.agente?.color }}>
                <span className="font-semibold" style={{ color: o.agente?.color }}>{o.agente?.nombre}</span>
                <span className="text-suave"> · {o.gravedad}</span>: {o.detalle}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={() => setPaso(paso - 1)} disabled={paso === 0}>← Anterior</Boton>
        <Boton onClick={() => setPaso(paso + 1)} disabled={paso === secciones.length - 1}>Siguiente →</Boton>
        <span className="flex-1" />
        {!soloLectura && <Boton variante="primario" onClick={onRevision} cargando={revisando}>Enviar a revisión de la mesa</Boton>}
      </div>
    </div>
  );
}

function TablaPresupuesto({ items, moneda, soloLectura, onChange }) {
  const set = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const total = items.reduce((a, it) => a + (Number(it.cantidad) || 0) * (Number(it.costoUnitario) || 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-suave">
            <th className="p-1 font-medium">Concepto</th><th className="w-20 p-1 font-medium">Cant.</th>
            <th className="w-36 p-1 font-medium">Costo unit. ({moneda})</th><th className="w-32 p-1 text-right font-medium">Subtotal</th><th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="p-1"><Input value={it.concepto} disabled={soloLectura} placeholder="Ej.: Variador 30 kW" onChange={(e) => set(i, "concepto", e.target.value)} /></td>
              <td className="p-1"><Input type="number" min="0" value={it.cantidad} disabled={soloLectura} onChange={(e) => set(i, "cantidad", Number(e.target.value))} /></td>
              <td className="p-1"><Input type="number" min="0" step="10" value={it.costoUnitario} disabled={soloLectura} onChange={(e) => set(i, "costoUnitario", Number(e.target.value))} /></td>
              <td className="p-1 text-right font-mono whitespace-nowrap">{dinero((Number(it.cantidad) || 0) * (Number(it.costoUnitario) || 0), moneda)}</td>
              <td className="p-1">{!soloLectura && <button className="text-lg text-suave hover:text-error" title="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="p-1 pt-2">
              {!soloLectura && <Boton tamano="sm" variante="fantasma" onClick={() => onChange([...items, { concepto: "", cantidad: 1, costoUnitario: 0 }])}>+ Agregar ítem</Boton>}
            </td>
            <td className="p-1 pt-2 text-right font-mono font-semibold whitespace-nowrap">{dinero(total, moneda)}</td><td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
