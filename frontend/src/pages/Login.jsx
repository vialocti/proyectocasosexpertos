import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Aviso, Boton, Campo, Input } from "../components/ui.jsx";

export default function Login() {
  const { usuario, ingresar } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e) {
    e.preventDefault();
    setError(""); setEnviando(true);
    try {
      const u = await ingresar(email.trim(), password);
      nav(u.debeCambiarPassword ? "/cuenta" : loc.state?.desde || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl text-[#8a4b14]">◆</div>
          <h1 className="mt-2 font-serif text-3xl tracking-tight">Mesa de Expertos</h1>
          <p className="mt-2 text-suave">Resolvé el caso. Convencé a la mesa.</p>
        </div>
        <form onSubmit={enviar} className="tarjeta flex flex-col gap-4 p-6">
          <Campo etiqueta="Email">
            <Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Campo>
          <Aviso>{error}</Aviso>
          <Boton variante="primario" type="submit" cargando={enviando}>Ingresar</Boton>
        </form>
        <p className="mt-4 text-center text-sm text-suave">¿No tenés usuario o te olvidaste la contraseña? Pedíselo a quien coordina la evaluación.</p>
      </div>
    </div>
  );
}
