import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { get, post, alErrorDeSesion } from "../lib/api.js";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando, null = sin sesión

  useEffect(() => {
    get("/auth/yo").then(setUsuario).catch(() => setUsuario(null));
    // Si el servidor dice que la sesión venció o que hay que cambiar la clave, se refleja al instante.
    return alErrorDeSesion((err) => {
      if (err.status === 401) setUsuario(null);
      else if (err.codigo === "cambiar_password") setUsuario((u) => (u ? { ...u, debeCambiarPassword: true } : u));
    });
  }, []);

  const ingresar = useCallback(async (email, password) => {
    const u = await post("/auth/login", { email, password });
    setUsuario(u);
    return u;
  }, []);

  const salir = useCallback(async () => {
    await post("/auth/logout").catch(() => {});
    setUsuario(null);
  }, []);

  const cambiarPassword = useCallback(async (actual, nueva) => {
    await post("/auth/password", { actual, nueva });
    setUsuario((u) => ({ ...u, debeCambiarPassword: false }));
  }, []);

  return <Ctx.Provider value={{ usuario, ingresar, salir, cambiarPassword }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
