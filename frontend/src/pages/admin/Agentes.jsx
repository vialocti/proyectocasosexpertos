import { useState } from "react";
import { del, get, post, put } from "../../lib/api.js";
import { POSTURAS } from "../../lib/formato.js";
import { Aviso, Avatar, Boton, Campo, Cargando, Encabezado, Etiqueta, Input, Modal, Select, Textarea, Vacio, useDatos } from "../../components/ui.jsx";

const VACIO = { nombre: "", cargo: "", iniciales: "", color: "#1f5f8b", mirada: "", perfil: "", instrucciones: "", posturaDefecto: "moderado", activo: true };

export default function Agentes() {
  const lista = useDatos(() => get("/admin/agentes"));
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState("");

  async function borrar(a) {
    if (!confirm(`¿Borrar a ${a.nombre}?`)) return;
    try { await del(`/admin/agentes/${a.id}`); lista.recargar(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Encabezado titulo="Agentes evaluadores" subtitulo="Biblioteca de evaluadores. Cada caso elige cuáles participan y con qué postura.">
        <Boton variante="primario" onClick={() => setEditando({ ...VACIO })}>+ Nuevo agente</Boton>
      </Encabezado>
      <Aviso>{error || lista.error?.message}</Aviso>
      {lista.cargando ? <Cargando /> : !lista.datos?.length ? <Vacio titulo="Todavía no hay agentes." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.datos.map((a) => (
            <div key={a.id} className={`tarjeta flex flex-col gap-3 p-5 ${a.activo ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <Avatar agente={a} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{a.nombre}</h3>
                  <p className="text-sm text-suave">{a.cargo}</p>
                </div>
                {!a.activo && <Etiqueta className="border-linea text-suave">inactivo</Etiqueta>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Etiqueta className="border-linea">Mirada {a.mirada}</Etiqueta>
                <Etiqueta className="border-linea">Postura {POSTURAS[a.posturaDefecto]?.toLowerCase()} por defecto</Etiqueta>
                <Etiqueta className="border-linea">{a.casos} caso{a.casos === 1 ? "" : "s"}</Etiqueta>
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed text-suave">{a.perfil}</p>
              <div className="mt-auto flex justify-end gap-1">
                <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(a)}>Editar</Boton>
                <Boton tamano="sm" variante="fantasma" className="text-error" onClick={() => borrar(a)}>Borrar</Boton>
              </div>
            </div>
          ))}
        </div>
      )}
      <EditorAgente agente={editando} onCerrar={() => setEditando(null)} onGuardado={lista.recargar} />
    </div>
  );
}

function EditorAgente({ agente, onCerrar, onGuardado }) {
  const [f, setF] = useState(VACIO);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (agente !== abierto) { setAbierto(agente); setF({ ...VACIO, ...agente }); setError(""); }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError("");
    try {
      if (agente.id) await put(`/admin/agentes/${agente.id}`, f); else await post("/admin/agentes", f);
      onGuardado(); onCerrar();
    } catch (err) { setError(err.message); }
    finally { setEnviando(false); }
  }

  return (
    <Modal abierto={!!agente} titulo={agente?.id ? "Editar agente" : "Nuevo agente"} onCerrar={onCerrar} ancho="max-w-2xl">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre"><Input required placeholder="Ing. Laura Benítez" value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Cargo"><Input required placeholder="Evaluadora técnica" value={f.cargo} onChange={set("cargo")} /></Campo>
          <Campo etiqueta="Mirada" ayuda="Desde qué punto de vista evalúa. Ej.: técnica, económica, ambiental, legal.">
            <Input required value={f.mirada} onChange={set("mirada")} />
          </Campo>
          <Campo etiqueta="Postura por defecto" ayuda="Cada caso puede cambiarla.">
            <Select value={f.posturaDefecto} onChange={set("posturaDefecto")}>{Object.entries(POSTURAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          </Campo>
          <Campo etiqueta="Iniciales (avatar)" ayuda="Vacío = se calculan del nombre."><Input maxLength={3} value={f.iniciales} onChange={set("iniciales")} /></Campo>
          <Campo etiqueta="Color">
            <div className="flex items-center gap-3"><input type="color" className="h-10 w-14 cursor-pointer rounded border border-linea" value={f.color} onChange={set("color")} />
              <Avatar agente={{ ...f, iniciales: f.iniciales || "?" }} /></div>
          </Campo>
        </div>
        <Campo etiqueta="Perfil y personalidad" ayuda="Formación, experiencia, qué mira, qué le preocupa y cómo se expresa. Es la base de su comportamiento.">
          <Textarea required rows={6} value={f.perfil} onChange={set("perfil")} />
        </Campo>
        <Campo etiqueta="Instrucciones adicionales (opcional)" ayuda="Reglas que aplica en todos los casos. Ej.: exigir fuentes para los precios, citar normativa.">
          <Textarea rows={3} value={f.instrucciones} onChange={set("instrucciones")} />
        </Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={set("activo")} /> Activo (se puede elegir en los casos)</label>
        <Aviso>{error}</Aviso>
        <div className="flex justify-end gap-2"><Boton type="button" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" type="submit" cargando={enviando}>Guardar</Boton></div>
      </form>
    </Modal>
  );
}
