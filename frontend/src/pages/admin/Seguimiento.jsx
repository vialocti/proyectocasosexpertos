import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { del, get, patch, post } from "../../lib/api.js";
import { ESTADOS, fecha, haceCuanto, numero } from "../../lib/formato.js";
import { Aviso, Boton, Campo, Cargando, Encabezado, EstadoAsignacion, Input, Modal, Select, Vacio, useDatos } from "../../components/ui.jsx";

export default function Seguimiento() {
  const resumen = useDatos(() => get("/admin/resumen"));
  const lista = useDatos(() => get("/admin/asignaciones"));
  const [filtro, setFiltro] = useState({ texto: "", estado: "", caso: "" });
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState("");

  const casos = useMemo(() => [...new Map((lista.datos || []).map((a) => [a.caso.id, a.caso])).values()], [lista.datos]);
  const filtradas = (lista.datos || []).filter((a) =>
    (!filtro.estado || a.estado === filtro.estado) && (!filtro.caso || a.caso.id === filtro.caso) &&
    (!filtro.texto || `${a.usuario.nombre} ${a.usuario.email}`.toLowerCase().includes(filtro.texto.toLowerCase())));

  async function cambiarEstado(a, estado) {
    setError("");
    try { await patch(`/admin/asignaciones/${a.id}`, { estado }); lista.setDatos((l) => l.map((x) => (x.id === a.id ? { ...x, estado } : x))); resumen.recargar(); }
    catch (e) { setError(e.message); }
  }
  async function quitar(a) {
    if (!confirm(`¿Quitar "${a.caso.titulo}" a ${a.usuario.nombre}? Se borra todo su trabajo en ese caso.`)) return;
    try { await del(`/admin/asignaciones/${a.id}`); lista.recargar(); resumen.recargar(); } catch (e) { setError(e.message); }
  }

  const r = resumen.datos;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Encabezado titulo="Seguimiento" subtitulo="Avance de cada persona en los casos asignados.">
        <Boton variante="primario" onClick={() => setNueva(true)}>+ Asignar caso</Boton>
      </Encabezado>

      {r && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["Personas activas", r.personas], ["Casos publicados", r.casos], ["Agentes activos", r.agentes], ["Asignaciones en curso", r.enCurso], ["Aprobadas", r.aprobadas]].map(([k, v]) => (
            <div key={k} className="tarjeta p-4"><div className="font-mono text-2xl">{v}</div><div className="text-xs text-suave">{k}</div></div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Buscar persona…" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
        <Select className="max-w-[220px]" value={filtro.caso} onChange={(e) => setFiltro({ ...filtro, caso: e.target.value })}>
          <option value="">Todos los casos</option>{casos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </Select>
        <Select className="max-w-[180px]" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
          <option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </Select>
      </div>
      <Aviso>{error || lista.error?.message}</Aviso>

      {lista.cargando ? <Cargando /> : filtradas.length === 0 ? (
        <Vacio titulo={lista.datos?.length ? "Ninguna asignación coincide con el filtro." : "Todavía no asignaste casos."}>
          {!lista.datos?.length && "Creá personas en la sección Personas y asignales un caso publicado."}
        </Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-linea text-left text-xs text-suave">
              {["Persona", "Caso", "Estado", "Revisiones", "Último puntaje", "Entrega", "Actividad", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtradas.map((a) => (
                <tr key={a.id} className="border-b border-linea last:border-0 hover:bg-fondo/50">
                  <td className="p-3"><div className="font-medium">{a.usuario.nombre}</div><div className="text-xs text-suave">{a.usuario.email}</div></td>
                  <td className="max-w-[240px] p-3">{a.caso.titulo}</td>
                  <td className="p-3"><EstadoAsignacion estado={a.estado} /></td>
                  <td className="p-3 font-mono">{a.revisiones}</td>
                  <td className="p-3 font-mono">{a.ultimoPuntaje == null ? "—" : numero(a.ultimoPuntaje, 1)}</td>
                  <td className="p-3 whitespace-nowrap">{fecha(a.fechaLimite)}</td>
                  <td className="p-3 whitespace-nowrap text-suave">{a.iniciadoEn ? haceCuanto(a.actualizadoEn) : "sin empezar"}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/asignaciones/${a.id}`} className="rounded-lg px-2.5 py-1 text-sm whitespace-nowrap hover:bg-black/5">Ver trabajo</Link>
                      {a.estado === "cerrada"
                        ? <Boton tamano="sm" variante="fantasma" onClick={() => cambiarEstado(a, "en_curso")}>Reabrir</Boton>
                        : <Boton tamano="sm" variante="fantasma" title="La persona ya no podrá modificar su trabajo" onClick={() => cambiarEstado(a, "cerrada")}>Cerrar entrega</Boton>}
                      <Boton tamano="sm" variante="fantasma" className="text-error" onClick={() => quitar(a)}>Quitar</Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NuevaAsignacion abierto={nueva} onCerrar={() => setNueva(false)} onCreada={() => { lista.recargar(); resumen.recargar(); }} />
    </div>
  );
}

function NuevaAsignacion({ abierto, onCerrar, onCreada }) {
  const casos = useDatos(() => (abierto ? get("/admin/casos") : Promise.resolve(null)), [abierto]);
  const personas = useDatos(() => (abierto ? get("/admin/usuarios") : Promise.resolve(null)), [abierto]);
  const [casoId, setCasoId] = useState("");
  const [elegidas, setElegidas] = useState(new Set());
  const [fechaLimite, setFechaLimite] = useState("");
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState({});
  const [enviando, setEnviando] = useState(false);

  const publicados = (casos.datos || []).filter((c) => c.publicado);
  const evaluados = (personas.datos || []).filter((p) => p.rol === "evaluado" && p.activo &&
    `${p.nombre} ${p.email}`.toLowerCase().includes(busca.toLowerCase()));
  const alternar = (id) => setElegidas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function cerrar() { setCasoId(""); setElegidas(new Set()); setFechaLimite(""); setMsg({}); onCerrar(); }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setMsg({});
    try {
      const r = await post("/admin/asignaciones", { casoId, usuarioIds: [...elegidas], fechaLimite: fechaLimite || null });
      onCreada();
      setMsg({ tipo: "ok", texto: `Listo: ${r.creadas} asignación(es) nueva(s)${r.omitidas ? `, ${r.omitidas} ya tenían este caso` : ""}.` });
      setElegidas(new Set());
    } catch (err) { setMsg({ tipo: "error", texto: err.message }); }
    finally { setEnviando(false); }
  }

  return (
    <Modal abierto={abierto} titulo="Asignar un caso" onCerrar={cerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo etiqueta="Caso">
          <Select required value={casoId} onChange={(e) => setCasoId(e.target.value)}>
            <option value="">Elegí un caso publicado…</option>
            {publicados.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </Select>
        </Campo>
        <Campo etiqueta="Fecha límite (opcional)"><Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} /></Campo>
        <div className="etiqueta">
          <span>Personas ({elegidas.size} elegida{elegidas.size === 1 ? "" : "s"})</span>
          <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-linea bg-white">
            {evaluados.length === 0 && <p className="p-3 text-sm">No hay personas activas{busca && " que coincidan"}. Crealas en la sección Personas.</p>}
            {evaluados.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-linea px-3 py-2 text-sm text-tinta last:border-0 hover:bg-fondo">
                <input type="checkbox" checked={elegidas.has(p.id)} onChange={() => alternar(p.id)} />
                <span className="flex-1">{p.nombre}</span><span className="text-xs text-suave">{p.email}</span>
              </label>
            ))}
          </div>
          {evaluados.length > 1 && (
            <button type="button" className="self-start text-xs underline" onClick={() => setElegidas(new Set(evaluados.map((p) => p.id)))}>Elegir todas las de la lista</button>
          )}
        </div>
        <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        <div className="flex justify-end gap-2">
          <Boton type="button" onClick={cerrar}>Cerrar</Boton>
          <Boton variante="primario" type="submit" cargando={enviando} disabled={!casoId || !elegidas.size}>Asignar</Boton>
        </div>
      </form>
    </Modal>
  );
}
