// Editor de un caso: enunciado y datos, secciones de la propuesta y evaluadores con su postura y enfoque.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { get, post, put } from "../../lib/api.js";
import { POSTURAS } from "../../lib/formato.js";
import { Aviso, Avatar, Boton, Campo, Cargando, Input, Select, Textarea } from "../../components/ui.jsx";

const NUEVO = {
  titulo: "", area: "", dificultad: "Intermedia", enunciado: "", datos: [], objetivos: [], restricciones: [],
  referencia: "", secciones: [], tasaDescuento: 12, moneda: "USD", publicado: false, agentes: []
};
const TIPOS = {
  texto: "Texto libre",
  presupuesto: "Presupuesto (tabla de ítems)",
  flujo: "Flujo de fondos (ingreso/ahorro anual, costos, horizonte)"
};
const PLANTILLAS = {
  texto: { tipo: "texto", titulo: "", ayuda: "", placeholder: "" },
  presupuesto: { tipo: "presupuesto", id: "presupuesto", titulo: "Presupuesto de la inversión", ayuda: "Cargá todos los ítems de la inversión." },
  flujo: { tipo: "flujo", id: "flujo", titulo: "Flujo de fondos", ayuda: "", etiquetaIngreso: "Ahorro anual estimado", etiquetaCosto: "Costo operativo adicional" }
};
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  .split(" ").map((p, i) => (i ? p[0]?.toUpperCase() + p.slice(1) : p)).join("").slice(0, 40);

export default function CasoEditor() {
  const { id } = useParams();
  const nuevo = id === "nuevo";
  const nav = useNavigate();
  const [c, setC] = useState(nuevo ? NUEVO : null);
  const [agentes, setAgentes] = useState([]);
  const [msg, setMsg] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    get("/admin/agentes").then(setAgentes).catch((e) => setMsg({ tipo: "error", texto: e.message }));
    if (!nuevo) get(`/admin/casos/${id}`).then(setC).catch((e) => setMsg({ tipo: "error", texto: e.message }));
  }, [id, nuevo]);

  if (!c) return msg.texto ? <div className="mx-auto max-w-xl p-8"><Aviso>{msg.texto}</Aviso></div> : <Cargando />;
  const set = (k, v) => setC({ ...c, [k]: v });

  async function guardar(publicar) {
    setGuardando(true); setMsg({});
    const cuerpo = { ...c, publicado: publicar ?? c.publicado };
    try {
      const r = nuevo ? await post("/admin/casos", cuerpo) : await put(`/admin/casos/${id}`, cuerpo);
      setC(r);
      setMsg({ tipo: "ok", texto: "Cambios guardados." });
      if (nuevo) nav(`/admin/casos/${r.id}`, { replace: true });
    } catch (e) { setMsg({ tipo: "error", texto: e.message }); }
    finally { setGuardando(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/admin/casos" className="text-sm text-suave hover:text-tinta">← Casos</Link>
      <div className="sticky top-[53px] z-20 -mx-2 mt-2 mb-4 flex flex-wrap items-center justify-between gap-3 bg-fondo/95 px-2 py-3 backdrop-blur">
        <h1 className="font-serif text-3xl tracking-tight">{nuevo ? "Nuevo caso" : c.titulo || "Caso"}</h1>
        <div className="flex gap-2">
          <Boton onClick={() => guardar()} cargando={guardando}>Guardar</Boton>
          {c.publicado
            ? <Boton onClick={() => guardar(false)} disabled={guardando}>Despublicar</Boton>
            : <Boton variante="primario" onClick={() => guardar(true)} disabled={guardando}>Guardar y publicar</Boton>}
        </div>
      </div>
      {!nuevo && c.publicado && <div className="mb-4"><Aviso tipo="info">Este caso está publicado. Los cambios se aplican también a las asignaciones en curso.</Aviso></div>}
      <div className="mb-4"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>

      <div className="flex flex-col gap-6">
        <Bloque titulo="1. El caso">
          <Campo etiqueta="Título"><Input value={c.titulo} onChange={(e) => set("titulo", e.target.value)} /></Campo>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="Área" className="sm:col-span-2"><Input placeholder="Ingeniería, Ciencias Económicas…" value={c.area} onChange={(e) => set("area", e.target.value)} /></Campo>
            <Campo etiqueta="Dificultad">
              <Select value={c.dificultad} onChange={(e) => set("dificultad", e.target.value)}>{["Inicial", "Intermedia", "Avanzada"].map((d) => <option key={d}>{d}</option>)}</Select>
            </Campo>
            <Campo etiqueta="Moneda"><Input value={c.moneda} maxLength={10} onChange={(e) => set("moneda", e.target.value.toUpperCase())} /></Campo>
          </div>
          <Campo etiqueta="Enunciado"><Textarea rows={5} value={c.enunciado} onChange={(e) => set("enunciado", e.target.value)} /></Campo>
          <ListaDatos datos={c.datos} onChange={(v) => set("datos", v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Objetivos" ayuda="Uno por línea."><Textarea rows={4} value={c.objetivos.join("\n")} onChange={(e) => set("objetivos", e.target.value.split("\n"))} /></Campo>
            <Campo etiqueta="Restricciones" ayuda="Una por línea."><Textarea rows={4} value={c.restricciones.join("\n")} onChange={(e) => set("restricciones", e.target.value.split("\n"))} /></Campo>
          </div>
          <Campo etiqueta="Notas de referencia para los evaluadores (ocultas para la persona evaluada)"
            ayuda="Valores correctos, órdenes de magnitud o errores típicos que los agentes usan para verificar.">
            <Textarea rows={4} value={c.referencia || ""} onChange={(e) => set("referencia", e.target.value)} />
          </Campo>
        </Bloque>

        <Bloque titulo="2. Secciones de la propuesta" ayuda="Lo que la persona tiene que completar, en orden. Con una sección de presupuesto y una de flujo de fondos se calculan inversión, repago, VAN y TIR.">
          <EditorSecciones secciones={c.secciones} onChange={(v) => set("secciones", v)} />
          {c.secciones.some((s) => s.tipo === "flujo") && (
            <Campo etiqueta="Tasa de descuento (% anual)" className="max-w-[220px]">
              <Input type="number" step="0.5" value={c.tasaDescuento} onChange={(e) => set("tasaDescuento", Number(e.target.value))} />
            </Campo>
          )}
        </Bloque>

        <Bloque titulo="3. Evaluadores" ayuda="Quiénes evalúan este caso, en qué orden hablan en la mesa de debate y con qué postura.">
          <EditorEvaluadores elegidos={c.agentes} biblioteca={agentes} onChange={(v) => set("agentes", v)} />
        </Bloque>
      </div>
    </div>
  );
}

const Bloque = ({ titulo, ayuda, children }) => (
  <section className="tarjeta flex flex-col gap-4 p-5">
    <div><h2 className="text-lg font-semibold">{titulo}</h2>{ayuda && <p className="mt-0.5 text-sm text-suave">{ayuda}</p>}</div>
    {children}
  </section>
);

function ListaDatos({ datos, onChange }) {
  const set = (i, k, v) => onChange(datos.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  return (
    <div className="etiqueta">
      <span>Datos del caso</span>
      {datos.map((d, i) => (
        <div key={i} className="flex gap-2">
          <Input className="flex-1" placeholder="Dato (ej.: Consumo anual)" value={d.clave} onChange={(e) => set(i, "clave", e.target.value)} />
          <Input className="flex-[1.4]" placeholder="Valor (ej.: 620.000 kWh)" value={d.valor} onChange={(e) => set(i, "valor", e.target.value)} />
          <button type="button" className="px-1 text-lg text-suave hover:text-error" onClick={() => onChange(datos.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <Boton type="button" tamano="sm" variante="fantasma" className="self-start" onClick={() => onChange([...datos, { clave: "", valor: "" }])}>+ Agregar dato</Boton>
    </div>
  );
}

function EditorSecciones({ secciones, onChange }) {
  const set = (i, k, v) => onChange(secciones.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const mover = (i, d) => { const n = [...secciones]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  const usado = (t) => secciones.some((s) => s.tipo === t);
  function agregar(tipo) {
    let s = { ...PLANTILLAS[tipo] };
    if (tipo === "texto") s.id = `seccion${secciones.length + 1}`;
    onChange([...secciones, s]);
  }
  return (
    <div className="flex flex-col gap-3">
      {secciones.map((s, i) => (
        <div key={i} className="rounded-lg border border-linea bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-tinta text-xs text-white">{i + 1}</span>
            <span className="text-sm text-suave">{TIPOS[s.tipo]}</span>
            <span className="flex-1" />
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30" title="Subir">↑</button>
            <button type="button" disabled={i === secciones.length - 1} onClick={() => mover(i, 1)} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30" title="Bajar">↓</button>
            <button type="button" onClick={() => onChange(secciones.filter((_, j) => j !== i))} className="px-1.5 text-lg text-suave hover:text-error" title="Quitar">×</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Título" className="sm:col-span-2">
              <Input value={s.titulo} onChange={(e) => {
                const titulo = e.target.value;
                // Para secciones de texto nuevas, el identificador sigue al título mientras no se haya tocado a mano.
                const auto = s.tipo === "texto" && (!s.id || /^seccion\d+$/.test(s.id) || s.id === slug(s.titulo));
                onChange(secciones.map((x, j) => (j === i ? { ...x, titulo, ...(auto && titulo ? { id: slug(titulo) } : {}) } : x)));
              }} />
            </Campo>
            <Campo etiqueta="Identificador" ayuda="Lo usan los evaluadores para señalar observaciones.">
              <Input className="font-mono text-sm" value={s.id} onChange={(e) => set(i, "id", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} />
            </Campo>
          </div>
          <Campo etiqueta="Consigna o ayuda" className="mt-3"><Input value={s.ayuda} onChange={(e) => set(i, "ayuda", e.target.value)} /></Campo>
          {s.tipo !== "presupuesto" && (
            <Campo etiqueta="Ejemplo (placeholder)" className="mt-3"><Input value={s.placeholder || ""} onChange={(e) => set(i, "placeholder", e.target.value)} /></Campo>
          )}
          {s.tipo === "flujo" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre del ingreso o ahorro anual"><Input value={s.etiquetaIngreso || ""} onChange={(e) => set(i, "etiquetaIngreso", e.target.value)} /></Campo>
              <Campo etiqueta="Nombre del costo anual"><Input value={s.etiquetaCosto || ""} onChange={(e) => set(i, "etiquetaCosto", e.target.value)} /></Campo>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Boton type="button" tamano="sm" onClick={() => agregar("texto")}>+ Sección de texto</Boton>
        {!usado("presupuesto") && <Boton type="button" tamano="sm" onClick={() => agregar("presupuesto")}>+ Presupuesto</Boton>}
        {!usado("flujo") && <Boton type="button" tamano="sm" onClick={() => agregar("flujo")}>+ Flujo de fondos</Boton>}
      </div>
    </div>
  );
}

function EditorEvaluadores({ elegidos, biblioteca, onChange }) {
  const [agregar, setAgregar] = useState("");
  const disponibles = biblioteca.filter((a) => a.activo && !elegidos.some((e) => e.id === a.id));
  const set = (i, k, v) => onChange(elegidos.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const mover = (i, d) => { const n = [...elegidos]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="flex flex-col gap-3">
      {elegidos.length === 0 && <p className="text-sm text-suave">Todavía no hay evaluadores. Agregá al menos uno para poder publicar el caso.</p>}
      {elegidos.map((a, i) => (
        <div key={a.id} className="rounded-lg border border-linea bg-white p-4">
          <div className="flex items-center gap-3">
            <Avatar agente={a} />
            <div className="min-w-0 flex-1"><p className="font-medium">{a.nombre}</p><p className="text-xs text-suave">{a.cargo} · mirada {a.mirada}</p></div>
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30">↑</button>
            <button type="button" disabled={i === elegidos.length - 1} onClick={() => mover(i, 1)} className="px-1.5 text-suave hover:text-tinta disabled:opacity-30">↓</button>
            <button type="button" onClick={() => onChange(elegidos.filter((_, j) => j !== i))} className="px-1.5 text-lg text-suave hover:text-error">×</button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
            <Campo etiqueta="Postura en este caso">
              <Select value={a.postura} onChange={(e) => set(i, "postura", e.target.value)}>{Object.entries(POSTURAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </Campo>
            <Campo etiqueta="Enfoque en este caso (opcional)" ayuda="Qué tiene que mirar especialmente acá. Ej.: exigir el cálculo del punto de equilibrio.">
              <Textarea rows={2} value={a.enfoque || ""} onChange={(e) => set(i, "enfoque", e.target.value)} />
            </Campo>
          </div>
        </div>
      ))}
      {disponibles.length > 0 && (
        <div className="flex gap-2">
          <Select className="max-w-sm" value={agregar} onChange={(e) => setAgregar(e.target.value)}>
            <option value="">Elegí un agente de la biblioteca…</option>
            {disponibles.map((a) => <option key={a.id} value={a.id}>{a.nombre} — {a.mirada}</option>)}
          </Select>
          <Boton type="button" disabled={!agregar} onClick={() => {
            const a = biblioteca.find((x) => x.id === agregar);
            onChange([...elegidos, { ...a, postura: a.posturaDefecto, enfoque: "" }]);
            setAgregar("");
          }}>Agregar</Boton>
        </div>
      )}
      <p className="text-xs text-suave">¿Falta un perfil? Crealo en <Link to="/admin/agentes" className="underline">Agentes</Link>.</p>
    </div>
  );
}
