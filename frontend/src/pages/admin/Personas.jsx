import { useState } from "react";
import { del, get, post, put } from "../../lib/api.js";
import { haceCuanto } from "../../lib/formato.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { Aviso, Boton, Campo, Cargando, Encabezado, Etiqueta, Input, Modal, Select, Vacio, useDatos } from "../../components/ui.jsx";

const generarClave = () => {
  const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => c[n % c.length]).join("");
};

export default function Personas() {
  const { usuario: yo } = useAuth();
  const lista = useDatos(() => get("/admin/usuarios"));
  const [editando, setEditando] = useState(null); // null | {} (nueva) | persona
  const [clave, setClave] = useState(null);       // persona a la que se le restablece la clave
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");

  const filtradas = (lista.datos || []).filter((p) => `${p.nombre} ${p.email}`.toLowerCase().includes(busca.toLowerCase()));

  async function borrar(p) {
    if (!confirm(`¿Borrar a ${p.nombre}? Se borran también sus ${p.asignaciones} asignación(es) y todo su trabajo. Si solo querés impedir el acceso, desactivala.`)) return;
    try { await del(`/admin/usuarios/${p.id}`); lista.recargar(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Encabezado titulo="Personas" subtitulo="Personas evaluadas y administradores. Cada una ingresa con su email y contraseña.">
        <Boton variante="primario" onClick={() => setEditando({})}>+ Nueva persona</Boton>
      </Encabezado>
      <Input className="mb-3 max-w-xs" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Aviso>{error || lista.error?.message}</Aviso>
      {lista.cargando ? <Cargando /> : filtradas.length === 0 ? <Vacio titulo="No hay personas para mostrar." /> : (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-linea text-left text-xs text-suave">
              {["Nombre", "Email", "Rol", "Asignaciones", "Último acceso", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} className={`border-b border-linea last:border-0 ${p.activo ? "" : "opacity-55"}`}>
                  <td className="p-3 font-medium">
                    {p.nombre}
                    {!p.activo && <Etiqueta className="ml-2 border-linea text-suave">inactiva</Etiqueta>}
                    {p.debeCambiarPassword && p.activo && <Etiqueta className="ml-2 border-aviso/40 text-aviso">clave provisoria</Etiqueta>}
                  </td>
                  <td className="p-3">{p.email}</td>
                  <td className="p-3">{p.rol === "admin" ? "Administrador" : "Evaluada"}</td>
                  <td className="p-3 font-mono">{p.asignaciones}{p.aprobadas ? <span className="text-ok"> · {p.aprobadas} ✔</span> : ""}</td>
                  <td className="p-3 text-suave">{haceCuanto(p.ultimoAcceso)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(p)}>Editar</Boton>
                      <Boton tamano="sm" variante="fantasma" onClick={() => setClave(p)}>Restablecer clave</Boton>
                      {p.id !== yo.id && <Boton tamano="sm" variante="fantasma" className="text-error" onClick={() => borrar(p)}>Borrar</Boton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EditorPersona persona={editando} onCerrar={() => setEditando(null)} onGuardada={lista.recargar} />
      <RestablecerClave persona={clave} onCerrar={() => setClave(null)} onListo={lista.recargar} />
    </div>
  );
}

function EditorPersona({ persona, onCerrar, onGuardada }) {
  const nueva = persona && !persona.id;
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  const [creada, setCreada] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  if (persona !== abierta) { // reinicia el formulario al abrir otra persona
    setAbierta(persona);
    setF(persona ? { nombre: persona.nombre || "", email: persona.email || "", rol: persona.rol || "evaluado", activo: persona.activo !== false, password: nueva ? generarClave() : "" } : {});
    setError(""); setCreada(null);
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError("");
    try {
      if (nueva) { await post("/admin/usuarios", f); setCreada({ email: f.email, password: f.password }); }
      else { await put(`/admin/usuarios/${persona.id}`, f); onCerrar(); }
      onGuardada();
    } catch (err) { setError(err.message); }
    finally { setEnviando(false); }
  }

  return (
    <Modal abierto={!!persona} titulo={nueva ? "Nueva persona" : "Editar persona"} onCerrar={onCerrar}>
      {creada ? (
        <div className="flex flex-col gap-4">
          <Aviso tipo="ok">Persona creada. Pasale estos datos de acceso; en su primer ingreso va a tener que elegir una contraseña propia.</Aviso>
          <div className="rounded-lg border border-linea bg-white p-3 font-mono text-sm">
            <div>Email: {creada.email}</div><div>Contraseña provisoria: {creada.password}</div>
          </div>
          <div className="flex justify-end gap-2">
            <Boton onClick={() => navigator.clipboard?.writeText(`Email: ${creada.email}\nContraseña provisoria: ${creada.password}`)}>Copiar</Boton>
            <Boton variante="primario" onClick={onCerrar}>Listo</Boton>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo etiqueta="Nombre y apellido"><Input required value={f.nombre || ""} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Email"><Input type="email" required value={f.email || ""} onChange={set("email")} /></Campo>
          <Campo etiqueta="Rol">
            <Select value={f.rol} onChange={set("rol")}><option value="evaluado">Persona evaluada</option><option value="admin">Administrador</option></Select>
          </Campo>
          {nueva ? (
            <Campo etiqueta="Contraseña provisoria" ayuda="La persona la cambia en su primer ingreso.">
              <div className="flex gap-2"><Input required minLength={8} className="font-mono" value={f.password} onChange={set("password")} />
                <Boton type="button" onClick={() => setF({ ...f, password: generarClave() })}>Generar</Boton></div>
            </Campo>
          ) : (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.activo} onChange={set("activo")} /> Activa (puede ingresar)</label>
          )}
          <Aviso>{error}</Aviso>
          <div className="flex justify-end gap-2"><Boton type="button" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" type="submit" cargando={enviando}>Guardar</Boton></div>
        </form>
      )}
    </Modal>
  );
}

function RestablecerClave({ persona, onCerrar, onListo }) {
  const [password, setPassword] = useState("");
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(null);
  if (persona !== abierta) { setAbierta(persona); setPassword(generarClave()); setHecho(false); setError(""); }

  async function enviar(e) {
    e.preventDefault();
    try { await post(`/admin/usuarios/${persona.id}/password`, { password }); setHecho(true); onListo(); }
    catch (err) { setError(err.message); }
  }
  return (
    <Modal abierto={!!persona} titulo={`Restablecer contraseña de ${persona?.nombre || ""}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo etiqueta="Nueva contraseña provisoria" ayuda="La persona va a tener que cambiarla al ingresar.">
          <Input required minLength={8} className="font-mono" value={password} disabled={hecho} onChange={(e) => setPassword(e.target.value)} />
        </Campo>
        <Aviso>{error}</Aviso>
        {hecho && <Aviso tipo="ok">Listo. Pasale la contraseña provisoria a {persona?.nombre}.</Aviso>}
        <div className="flex justify-end gap-2">
          {hecho ? <Boton variante="primario" type="button" onClick={onCerrar}>Listo</Boton>
            : <><Boton type="button" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" type="submit">Restablecer</Boton></>}
        </div>
      </form>
    </Modal>
  );
}
