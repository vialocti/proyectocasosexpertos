export const dinero = (n, moneda = "USD") =>
  n == null || Number.isNaN(n) ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);

export const numero = (n, dec = 0) =>
  n == null || Number.isNaN(n) ? "—" : new Intl.NumberFormat("es-AR", { maximumFractionDigits: dec }).format(n);

export const fecha = (iso) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—");

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function haceCuanto(iso) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : fecha(iso);
}

export const ESTADOS = {
  pendiente: { texto: "Sin empezar", clase: "bg-fondo text-suave border-linea" },
  en_curso: { texto: "En curso", clase: "bg-aviso-suave text-aviso border-aviso/40" },
  aprobada: { texto: "Aprobada", clase: "bg-ok-suave text-ok border-ok/40" },
  cerrada: { texto: "Cerrada", clase: "bg-[#eee] text-suave border-linea" }
};

export const VEREDICTOS = {
  aprobado: { texto: "Aprobado", clase: "bg-ok-suave text-ok border-ok" },
  aprobado_con_cambios: { texto: "Con cambios", clase: "bg-aviso-suave text-aviso border-aviso" },
  rechazado: { texto: "Rechazado", clase: "bg-error-suave text-error border-error" }
};

export const POSTURAS = { conservador: "Conservadora", moderado: "Moderada", audaz: "Audaz" };

/** Negrita **así** y encabezados markdown simples, sobre texto ya escapado por React (se usa con dangerouslySetInnerHTML solo tras escapar). */
export function markdownSimple(texto) {
  const esc = String(texto ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^#+\s*/gm, "");
}
