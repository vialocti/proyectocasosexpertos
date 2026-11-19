import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Aviso, Boton, Campo, Input } from "../components/ui.jsx";

export default function Cuenta() {
  const { usuario, cambiarPassword } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ actual: "", nueva: "", repetir: "" });
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  const obligatorio = usuario.debeCambiarPassword;

  async function enviar(e) {
    e.preventDefault();
    if (f.nueva !== f.repetir) return setMsg({ tipo: "error", texto: "Las contraseñas nuevas no coinciden." });
    setEnviando(true); setMsg({});
    try {
      await cambiarPassword(f.actual, f.nueva);
      setF({ actual: "", nueva: "", repetir: "" });
      if (obligatorio) nav("/", { replace: true });
      else setMsg({ tipo: "ok", texto: "Listo, tu contraseña quedó actualizada." });
    } catch (err) {
      setMsg({ tipo: "error", texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-serif text-3xl tracking-tight">Mi cuenta</h1>
      <p className="mt-1 text-suave">{usuario.nombre} · {usuario.email}</p>
      {obligatorio && (
        <div className="mt-6"><Aviso tipo="info">Estás usando una contraseña provisoria. Elegí una propia para continuar.</Aviso></div>
      )}
      <form onSubmit={enviar} className="tarjeta mt-6 flex flex-col gap-4 p-6">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <Campo etiqueta={obligatorio ? "Contraseña provisoria" : "Contraseña actual"}>
          <Input type="password" autoComplete="current-password" required value={f.actual} onChange={set("actual")} />
        </Campo>
        <Campo etiqueta="Contraseña nueva" ayuda="Al menos 8 caracteres.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={f.nueva} onChange={set("nueva")} />
        </Campo>
        <Campo etiqueta="Repetí la contraseña nueva">
          <Input type="password" autoComplete="new-password" required value={f.repetir} onChange={set("repetir")} />
        </Campo>
        <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        <Boton variante="primario" type="submit" cargando={enviando}>Guardar contraseña</Boton>
      </form>
    </div>
  );
}
