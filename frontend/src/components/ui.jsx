// Componentes de interfaz reutilizables.
import { useEffect, useState } from "react";
import { ESTADOS, VEREDICTOS } from "../lib/formato.js";

const cx = (...c) => c.filter(Boolean).join(" ");

export function Boton({ variante = "normal", tamano = "md", className, cargando, disabled, children, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium transition disabled:opacity-50 disabled:cursor-default cursor-pointer";
  const v = {
    primario: "bg-tinta text-white border-tinta hover:opacity-90",
    normal: "bg-panel border-linea hover:border-tinta",
    fantasma: "bg-transparent border-transparent hover:bg-black/5",
    peligro: "bg-panel border-error/40 text-error hover:bg-error-suave"
  }[variante];
  const t = { sm: "px-2.5 py-1 text-sm", md: "px-3.5 py-2 text-[15px]" }[tamano];
  return (
    <button className={cx(base, v, t, className)} {...props} disabled={cargando || disabled}>
      {cargando && <Spinner chico />}
      {children}
    </button>
  );
}

export const Spinner = ({ chico }) => (
  <span className={cx("inline-block animate-spin rounded-full border-2 border-linea border-t-tinta", chico ? "h-4 w-4" : "h-8 w-8")} />
);

export function Campo({ etiqueta, ayuda, error, className, children }) {
  return (
    <label className={cx("etiqueta", className)}>
      {etiqueta && <span>{etiqueta}</span>}
      {children}
      {ayuda && !error && <span className="text-xs text-suave">{ayuda}</span>}
      {error && <span className="text-xs text-error">{error}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }) => <input className={cx("campo", className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx("campo resize-y leading-relaxed", className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx("campo", className)} {...p}>{children}</select>;

export function Avatar({ agente, chico }) {
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", chico ? "h-6 w-6 text-[10px]" : "h-11 w-11 text-sm")}
      style={{ background: agente?.color || "#6c675c" }}
      title={agente?.nombre}
    >
      {agente?.iniciales || "?"}
    </span>
  );
}

export const Etiqueta = ({ className, children }) => (
  <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>{children}</span>
);
export const EstadoAsignacion = ({ estado }) => {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return <Etiqueta className={e.clase}>{e.texto}</Etiqueta>;
};
export const Veredicto = ({ veredicto }) => {
  const v = VEREDICTOS[veredicto];
  return v ? <Etiqueta className={v.clase}>{v.texto}</Etiqueta> : <Etiqueta className="border-linea text-suave">Sin revisar</Etiqueta>;
};
export const Tag = ({ children }) => (
  <span className="rounded-full border border-linea px-2 py-0.5 font-mono text-[11px] text-suave">{children}</span>
);

export function Modal({ abierto, titulo, onCerrar, children, ancho = "max-w-lg" }) {
  useEffect(() => {
    if (!abierto) return;
    const f = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[8vh]" onMouseDown={onCerrar}>
      <div className={cx("tarjeta aparecer w-full p-5 shadow-xl", ancho)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="text-2xl leading-none text-suave hover:text-tinta" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Aviso = ({ tipo = "error", children }) => {
  if (!children) return null;
  const c = { error: "border-error/40 bg-error-suave text-error", ok: "border-ok/40 bg-ok-suave text-ok", info: "border-linea bg-fondo text-suave" }[tipo];
  return <div className={cx("rounded-lg border px-3 py-2 text-sm", c)}>{children}</div>;
};

export const Vacio = ({ titulo, children }) => (
  <div className="rounded-xl border border-dashed border-linea px-6 py-10 text-center text-suave">
    {titulo && <p className="mb-1 font-medium text-tinta">{titulo}</p>}
    {children}
  </div>
);

export const Cargando = ({ texto = "Cargando…" }) => (
  <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-suave"><Spinner />{texto}</div>
);

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-suave">{subtitulo}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** Carga datos de la API con estado de carga y error. */
export function useDatos(cargar, deps = []) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado((s) => ({ ...s, cargando: true }));
    cargar()
      .then((datos) => vivo && setEstado({ datos, error: null, cargando: false }))
      .catch((error) => vivo && setEstado({ datos: null, error, cargando: false }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { ...estado, recargar: () => setVersion((v) => v + 1), setDatos: (fn) => setEstado((s) => ({ ...s, datos: typeof fn === "function" ? fn(s.datos) : fn })) };
}
