// Lectura de datos y conversión de filas (snake_case) a objetos de la API (camelCase).
import { query, uno } from "./db.js";
import { analizarFinanzas } from "./finance.js";

export const SOLUCION_VACIA = { secciones: {}, items: [], ahorroAnual: 0, costoOperativoAnual: 0, vidaUtil: 10 };

export const aAgente = (r) => ({
  id: r.id, nombre: r.nombre, cargo: r.cargo, iniciales: r.iniciales, color: r.color, mirada: r.mirada,
  perfil: r.perfil, instrucciones: r.instrucciones, posturaDefecto: r.postura_defecto, activo: r.activo,
  creadoEn: r.creado_en, actualizadoEn: r.actualizado_en
});

export const aCaso = (r, { conReferencia = false } = {}) => ({
  id: r.id, titulo: r.titulo, area: r.area, dificultad: r.dificultad, enunciado: r.enunciado,
  datos: r.datos, objetivos: r.objetivos, restricciones: r.restricciones,
  ...(conReferencia && { referencia: r.referencia }),
  secciones: r.secciones, tasaDescuento: r.tasa_descuento, moneda: r.moneda, publicado: r.publicado,
  creadoEn: r.creado_en, actualizadoEn: r.actualizado_en
});

/** Agentes de un caso con la configuración propia del caso (postura, enfoque, orden). */
export async function agentesDelCaso(casoId) {
  const { rows } = await query(
    `SELECT a.*, ca.postura, ca.enfoque, ca.orden
       FROM caso_agentes ca JOIN agentes a ON a.id = ca.agente_id
      WHERE ca.caso_id = $1 ORDER BY ca.orden, a.nombre`, [casoId]);
  return rows.map((r) => ({ ...aAgente(r), postura: r.postura, enfoque: r.enfoque, orden: r.orden }));
}

/** Caso con sus agentes. `conReferencia` incluye las notas ocultas (solo admin y motor de IA). */
export async function cargarCaso(id, { conReferencia = false } = {}) {
  const r = await uno("SELECT * FROM casos WHERE id = $1", [id]);
  if (!r) return null;
  return { ...aCaso(r, { conReferencia }), agentes: await agentesDelCaso(id) };
}

/** Datos del caso en el formato que espera el motor de agentes. */
export const casoParaMotor = (c) => ({ ...c, tasa_descuento: c.tasaDescuento });

export const finanzasDe = (caso, solucion) => analizarFinanzas(solucion, caso.tasaDescuento);

export const aAsignacion = (r) => ({
  id: r.id, usuarioId: r.usuario_id, casoId: r.caso_id, estado: r.estado, fechaLimite: r.fecha_limite,
  solucion: { ...SOLUCION_VACIA, ...r.solucion }, iniciadoEn: r.iniciado_en, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en
});

export const aRevision = (r) => ({
  id: r.id, numero: r.numero, finanzas: r.finanzas, resultados: r.resultados, aprobada: r.aprobada,
  puntajePromedio: r.puntaje_promedio, creadoEn: r.creado_en
});

export const aMensaje = (r) => ({
  id: Number(r.id), canal: r.canal, agenteId: r.agente_id, autor: r.autor, texto: r.texto,
  revisionNumero: r.revision_numero, fuentes: r.fuentes, creadoEn: r.creado_en
});

export const aDebate = (r) => ({ id: r.id, intervenciones: r.intervenciones, consenso: r.consenso, creadoEn: r.creado_en });
