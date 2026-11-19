// Cliente de la API. La sesión viaja en una cookie httpOnly; acá solo se manejan errores y JSON.

export class ErrorApi extends Error {
  constructor(mensaje, status, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

// Avisos globales que el AuthProvider escucha (sesión vencida, contraseña provisoria).
const oyentes = new Set();
export const alErrorDeSesion = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };

export async function api(ruta, { metodo = "GET", cuerpo, senal } = {}) {
  let r;
  try {
    r = await fetch("/api" + ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      credentials: "same-origin",
      signal: senal
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ErrorApi("No se pudo conectar con el servidor. Revisá tu conexión.", 0);
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new ErrorApi(datos?.error || `Error ${r.status}`, r.status, datos?.codigo);
    if (r.status === 401 || datos?.codigo === "cambiar_password") oyentes.forEach((fn) => fn(err));
    throw err;
  }
  return datos;
}

export const get = (ruta, op) => api(ruta, op);
export const post = (ruta, cuerpo) => api(ruta, { metodo: "POST", cuerpo: cuerpo ?? {} });
export const put = (ruta, cuerpo) => api(ruta, { metodo: "PUT", cuerpo });
export const patch = (ruta, cuerpo) => api(ruta, { metodo: "PATCH", cuerpo });
export const del = (ruta) => api(ruta, { metodo: "DELETE" });
