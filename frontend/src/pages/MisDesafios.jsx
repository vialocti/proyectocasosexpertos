import { Link } from "react-router-dom";
import { get } from "../lib/api.js";
import { fecha, haceCuanto, numero } from "../lib/formato.js";
import { Aviso, Cargando, Encabezado, EstadoAsignacion, Tag, Vacio, useDatos } from "../components/ui.jsx";

export default function MisDesafios() {
  const { datos, error, cargando } = useDatos(() => get("/mis-asignaciones"));
  if (cargando) return <Cargando />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Encabezado titulo="Mis desafíos" subtitulo="Tu trabajo se guarda solo. Podés dejarlo y retomarlo cuando quieras." />
      <Aviso>{error?.message}</Aviso>
      {datos?.length === 0 && <Vacio titulo="Todavía no tenés desafíos asignados.">Cuando te asignen uno, aparecerá acá.</Vacio>}
      <div className="grid gap-4 sm:grid-cols-2">
        {datos?.map((a) => {
          const vencida = a.fechaLimite && a.estado !== "aprobada" && a.estado !== "cerrada" && new Date(a.fechaLimite + "T23:59:59") < new Date();
          return (
            <Link key={a.id} to={`/desafios/${a.id}`}
              className="tarjeta group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-tinta">
              <div className="flex flex-wrap items-center gap-2">
                <EstadoAsignacion estado={a.estado} />
                <Tag>{a.caso.area}</Tag><Tag>{a.caso.dificultad}</Tag>
              </div>
              <h3 className="text-lg font-semibold leading-snug">{a.caso.titulo}</h3>
              <p className="line-clamp-3 text-sm leading-relaxed text-suave">{a.caso.enunciado}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-linea pt-3 text-xs text-suave">
                <span>{a.agentes} evaluador{a.agentes === 1 ? "" : "es"}</span>
                <span>{a.revisiones} revisi{a.revisiones === 1 ? "ón" : "ones"}{a.ultimoPuntaje != null && ` · último puntaje ${numero(a.ultimoPuntaje, 1)}`}</span>
                {a.fechaLimite && <span className={vencida ? "font-medium text-error" : ""}>Entrega: {fecha(a.fechaLimite)}</span>}
                {a.iniciadoEn && <span>Editado {haceCuanto(a.actualizadoEn)}</span>}
              </div>
              <span className="text-sm font-medium group-hover:underline">{a.estado === "pendiente" ? "Empezar →" : a.estado === "cerrada" ? "Ver →" : "Continuar →"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
