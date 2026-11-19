import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { del, get, post } from "../../lib/api.js";
import { fecha } from "../../lib/formato.js";
import { Aviso, Boton, Cargando, Encabezado, Etiqueta, Tag, Vacio, useDatos } from "../../components/ui.jsx";

export default function Casos() {
  const lista = useDatos(() => get("/admin/casos"));
  const nav = useNavigate();
  const [error, setError] = useState("");

  async function duplicar(c) {
    try { const n = await post(`/admin/casos/${c.id}/duplicar`); nav(`/admin/casos/${n.id}`); } catch (e) { setError(e.message); }
  }
  async function borrar(c) {
    if (!confirm(`¿Borrar el caso "${c.titulo}"?`)) return;
    try { await del(`/admin/casos/${c.id}`); lista.recargar(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Encabezado titulo="Casos" subtitulo="Problemas a resolver: enunciado, datos, secciones de la propuesta y evaluadores.">
        <Boton variante="primario" onClick={() => nav("/admin/casos/nuevo")}>+ Nuevo caso</Boton>
      </Encabezado>
      <Aviso>{error || lista.error?.message}</Aviso>
      {lista.cargando ? <Cargando /> : !lista.datos?.length ? <Vacio titulo="Todavía no hay casos." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.datos.map((c) => (
            <div key={c.id} className="tarjeta flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {c.publicado ? <Etiqueta className="border-ok/40 bg-ok-suave text-ok">Publicado</Etiqueta> : <Etiqueta className="border-linea text-suave">Borrador</Etiqueta>}
                <Tag>{c.area || "Sin área"}</Tag><Tag>{c.dificultad}</Tag>
              </div>
              <Link to={`/admin/casos/${c.id}`} className="text-lg font-semibold leading-snug hover:underline">{c.titulo}</Link>
              <p className="line-clamp-2 text-sm text-suave">{c.enunciado}</p>
              <div className="flex flex-wrap gap-x-4 text-xs text-suave">
                <span>{c.secciones.length} secciones</span><span>{c.agentes} evaluador{c.agentes === 1 ? "" : "es"}</span>
                <span>{c.asignaciones} asignación{c.asignaciones === 1 ? "" : "es"}</span><span>Editado {fecha(c.actualizadoEn)}</span>
              </div>
              <div className="mt-auto flex justify-end gap-1">
                <Boton tamano="sm" variante="fantasma" onClick={() => nav(`/admin/casos/${c.id}`)}>Editar</Boton>
                <Boton tamano="sm" variante="fantasma" onClick={() => duplicar(c)}>Duplicar</Boton>
                {!c.asignaciones && <Boton tamano="sm" variante="fantasma" className="text-error" onClick={() => borrar(c)}>Borrar</Boton>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
