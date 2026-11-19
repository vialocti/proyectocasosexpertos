// Espacio de trabajo de un desafío. La persona evaluada lo edita; un admin lo ve en solo lectura.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get, post, put } from "../../lib/api.js";
import { analizarFinanzas } from "../../lib/finanzas.js";
import { fecha, haceCuanto, numero } from "../../lib/formato.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { Aviso, Avatar, Boton, Cargando, EstadoAsignacion, Spinner, Veredicto } from "../../components/ui.jsx";
import Constructor from "./Constructor.jsx";
import PanelAgentes from "./PanelAgentes.jsx";
import Herramientas from "./Herramientas.jsx";
import { Kpis, PanelCaso } from "./piezas.jsx";

const ESPERA_GUARDADO = 900;

export default function Trabajo() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [d, setD] = useState(null);           // respuesta de GET /asignaciones/:id
  const [sol, setSolLocal] = useState(null);  // propuesta editada localmente
  const [error, setError] = useState(null);
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState({ estado: "ok", en: null }); // ok | pendiente | guardando | error
  const [ocupado, setOcupado] = useState("");  // "revision" | "debate" | ""
  const [aviso, setAviso] = useState("");
  const [herramientas, setHerramientas] = useState(false);
  const timer = useRef(null);
  const solRef = useRef(null);
  const sucio = useRef(false);

  useEffect(() => {
    get(`/asignaciones/${id}`)
      .then((x) => { setD(x); setSolLocal(x.asignacion.solucion); solRef.current = x.asignacion.solucion; setGuardado({ estado: "ok", en: x.asignacion.actualizadoEn }); })
      .catch(setError);
  }, [id]);

  const guardar = useCallback(async () => {
    clearTimeout(timer.current);
    if (!sucio.current) return true;
    sucio.current = false;
    setGuardado((g) => ({ ...g, estado: "guardando" }));
    try {
      const r = await put(`/asignaciones/${id}/solucion`, solRef.current);
      setD((x) => ({ ...x, asignacion: { ...x.asignacion, estado: r.estado } }));
      setGuardado({ estado: sucio.current ? "pendiente" : "ok", en: r.actualizadoEn });
      return true;
    } catch (e) {
      sucio.current = true;
      setGuardado((g) => ({ ...g, estado: "error" }));
      setAviso(`No se pudo guardar: ${e.message}`);
      return false;
    }
  }, [id]);

  const setSol = (nueva) => {
    setSolLocal(nueva);
    solRef.current = nueva;
    sucio.current = true;
    setGuardado((g) => ({ ...g, estado: "pendiente" }));
    clearTimeout(timer.current);
    timer.current = setTimeout(guardar, ESPERA_GUARDADO);
  };

  // Guarda al salir de la página o cerrar la pestaña.
  useEffect(() => {
    const antesDeSalir = (e) => { if (sucio.current) { guardar(); e.preventDefault(); } };
    window.addEventListener("beforeunload", antesDeSalir);
    return () => { window.removeEventListener("beforeunload", antesDeSalir); guardar(); };
  }, [guardar]);

  const fin = useMemo(() => (d && sol ? analizarFinanzas(sol, d.caso.tasaDescuento) : null), [d, sol]);

  if (error) return <div className="mx-auto max-w-xl p-8"><Aviso>{error.message}</Aviso><Link to="/" className="mt-4 inline-block underline">Volver</Link></div>;
  if (!d || !sol) return <Cargando texto="Abriendo el desafío…" />;

  const { caso, soloLectura } = d;
  const tieneFin = caso.secciones.some((s) => s.tipo === "presupuesto") && caso.secciones.some((s) => s.tipo === "flujo");
  const ultimaRevision = d.revisiones.at(-1);
  const volver = usuario.rol === "admin" ? "/admin" : "/desafios";

  async function accion(tipo, fn) {
    setAviso("");
    if (!(await guardar())) return;
    setOcupado(tipo);
    try { await fn(); } catch (e) { setAviso(e.message); } finally { setOcupado(""); }
  }

  const enviarRevision = () => accion("revision", async () => {
    const r = await post(`/asignaciones/${id}/revision`);
    setD((x) => ({ ...x, asignacion: { ...x.asignacion, estado: r.estado }, revisiones: [...x.revisiones, r.revision], mensajes: [...x.mensajes, ...r.mensajes] }));
  });
  const convocarDebate = () => accion("debate", async () => {
    const deb = await post(`/asignaciones/${id}/debate`);
    setD((x) => ({ ...x, debates: [...x.debates, deb] }));
  });
  async function chat(agenteId, mensaje) {
    setAviso("");
    try {
      await guardar();
      const r = await post(`/asignaciones/${id}/chat`, { agenteId, mensaje });
      setD((x) => ({ ...x, mensajes: [...x.mensajes, ...r.mensajes] }));
    } catch (e) { setAviso(e.message); throw e; }
  }
  async function asistente(mensaje, web) {
    setAviso("");
    try {
      const r = await post(`/asignaciones/${id}/asistente`, { mensaje, web });
      setD((x) => ({ ...x, mensajes: [...x.mensajes, ...r.mensajes] }));
    } catch (e) { setAviso(e.message); throw e; }
  }

  const textoGuardado = {
    ok: guardado.en ? `Guardado ${haceCuanto(guardado.en)}` : "Sin cambios",
    pendiente: "Cambios sin guardar…", guardando: "Guardando…", error: "Error al guardar"
  }[guardado.estado];

  return (
    <div className="flex flex-col lg:h-[calc(100vh-49px)]">
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-linea bg-panel px-4 py-2.5 sm:px-6">
        <Link to={volver} className="text-sm text-suave hover:text-tinta">← Volver</Link>
        <EstadoAsignacion estado={d.asignacion.estado} />
        {d.asignacion.fechaLimite && <span className="text-xs text-suave">Entrega: {fecha(d.asignacion.fechaLimite)}</span>}
        {soloLectura
          ? <span className="text-xs text-suave">{d.usuario.nombre !== usuario.nombre ? `Trabajo de ${d.usuario.nombre} · ` : ""}solo lectura</span>
          : <span className={`text-xs ${guardado.estado === "error" ? "text-error" : "text-suave"}`}>{textoGuardado}</span>}
        {tieneFin && fin && <div className="order-last w-full xl:order-none xl:w-auto"><Kpis fin={fin} moneda={caso.moneda} /></div>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {caso.agentes.map((a) => {
            const r = ultimaRevision?.resultados.find((x) => x.agenteId === a.id);
            return (
              <span key={a.id} className="flex items-center gap-1.5" title={`${a.nombre}${r ? ` · ${numero(r.puntaje, 1)}/10` : ""}`}>
                <Avatar agente={a} chico /><Veredicto veredicto={r?.veredicto} />
              </span>
            );
          })}
          <Boton tamano="sm" onClick={() => setHerramientas((x) => !x)}>🧮 Herramientas</Boton>
        </div>
      </div>

      {aviso && <div className="px-4 pt-3 sm:px-6"><Aviso>{aviso}</Aviso></div>}
      {d.asignacion.estado === "aprobada" && !soloLectura && (
        <div className="px-4 pt-3 sm:px-6"><Aviso tipo="ok">✔ Todos los evaluadores aprobaron tu propuesta. Podés convocar a la mesa para ver si se puede optimizar todavía más.</Aviso></div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        <aside className="overflow-y-auto border-b border-linea bg-panel p-5 lg:border-r lg:border-b-0"><PanelCaso caso={caso} /></aside>
        <section className="overflow-y-auto p-4 sm:p-5">
          <Constructor caso={caso} sol={sol} setSol={setSol} fin={fin} paso={paso} setPaso={setPaso} ultimaRevision={ultimaRevision}
            soloLectura={soloLectura} onRevision={enviarRevision} revisando={ocupado === "revision"} />
          {soloLectura && d.revisiones.length > 0 && <HistorialRevisiones revisiones={d.revisiones} />}
        </section>
        <aside className="min-h-0 border-t border-linea bg-panel lg:border-t-0 lg:border-l">
          <PanelAgentes caso={caso} mensajes={d.mensajes} revisiones={d.revisiones} debates={d.debates}
            soloLectura={soloLectura} ocupado={ocupado} onChat={chat} onDebate={convocarDebate} />
        </aside>
      </div>

      <Herramientas abierto={herramientas} onCerrar={() => setHerramientas(false)} soloLectura={soloLectura}
        mensajes={d.mensajes.filter((m) => m.canal === "asistente")} onAsistente={asistente} />

      {ocupado && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-fondo/80 text-center">
          <Spinner />
          <p className="font-medium">{ocupado === "revision" ? "Los evaluadores están leyendo tu propuesta…" : "La mesa está debatiendo tu propuesta…"}</p>
          <p className="text-sm text-suave">Puede tardar hasta {ocupado === "revision" ? "un minuto" : "dos minutos"}.</p>
        </div>
      )}
    </div>
  );
}

/** Para el seguimiento del admin: evolución de puntajes entre revisiones. */
function HistorialRevisiones({ revisiones }) {
  return (
    <div className="tarjeta mt-6 p-5">
      <h3 className="mb-3 font-semibold">Historial de revisiones</h3>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-suave"><th className="p-1.5 font-medium">#</th><th className="p-1.5 font-medium">Fecha</th><th className="p-1.5 font-medium">Promedio</th><th className="p-1.5 font-medium">Resultado</th></tr></thead>
        <tbody>
          {revisiones.map((r) => (
            <tr key={r.id} className="border-t border-linea">
              <td className="p-1.5">{r.numero}</td><td className="p-1.5">{fecha(r.creadoEn)}</td>
              <td className="p-1.5 font-mono">{numero(r.puntajePromedio, 1)}</td>
              <td className="p-1.5">{r.aprobada ? <span className="text-ok">Aprobada</span> : <span className="text-suave">No aprobada</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
