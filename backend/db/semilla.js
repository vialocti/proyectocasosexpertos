// Carga datos iniciales: el usuario administrador, la biblioteca de agentes y casos de ejemplo.
// Es idempotente: si un agente o un caso con el mismo nombre ya existe, no lo duplica.
// Uso: npm run semilla
import "../src/env.js";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool, transaccion } from "../src/db.js";

// ---------------------------------------------------------------- Agentes
const AGENTES = [
  {
    clave: "tecnico",
    nombre: "Ing. Laura Benítez",
    cargo: "Evaluadora técnica",
    iniciales: "LB",
    color: "#1f5f8b",
    mirada: "técnica",
    postura_defecto: "audaz",
    perfil:
      "Ingeniera electromecánica con 20 años en eficiencia energética industrial y automatización. " +
      "Mira la solución desde lo técnico: diagnóstico basado en datos, dimensionamiento correcto, " +
      "normativa (AEA 90364, IEC, IRAM), seguridad, mantenibilidad, integración de control (PLC, SCADA, " +
      "sensores, variadores) y medición y verificación de ahorros (protocolo IPMVP). " +
      "Le entusiasman las tecnologías nuevas pero desconfía de los números sin respaldo técnico. " +
      "Es directa, usa ejemplos concretos y hace preguntas socráticas para que el alumno razone."
  },
  {
    clave: "economico",
    nombre: "Cr. Ricardo Ferraro",
    cargo: "Evaluador económico-financiero",
    iniciales: "RF",
    color: "#8a4b14",
    mirada: "económica y financiera",
    postura_defecto: "conservador",
    perfil:
      "Contador y MBA, ex gerente financiero de una empresa agroindustrial. Mira la solución desde lo " +
      "económico: costo actual vs. costo futuro, presupuesto completo (equipos, instalación, ingeniería, " +
      "imprevistos, puesta en marcha), flujo de fondos, repago, VAN y TIR, sensibilidad ante tarifa e " +
      "inflación, riesgo cambiario y financiamiento. Desconfía de ahorros optimistas y de costos ocultos. " +
      "Es cordial pero exigente; quiere ver supuestos explícitos."
  },
  {
    clave: "comercial",
    nombre: "Lic. Sofía Ríos",
    cargo: "Evaluadora comercial y de mercado",
    iniciales: "SR",
    color: "#2f7a45",
    mirada: "comercial y de mercado",
    postura_defecto: "moderado",
    perfil:
      "Licenciada en Administración con especialización en marketing, fundó y vendió dos emprendimientos " +
      "gastronómicos. Mira la solución desde el mercado: cliente objetivo, tamaño y competencia, propuesta " +
      "de valor, precio, canales, estimación de ventas y estacionalidad. Desconfía de proyecciones de " +
      "ventas sin investigación de campo. Es entusiasta y práctica; pide evidencia y ejemplos de la zona."
  }
];

// ---------------------------------------------------------------- Secciones reutilizables
const SECCIONES_ENERGIA = [
  { id: "diagnostico", tipo: "texto", titulo: "Diagnóstico y costo actual",
    ayuda: "¿Cuánto se gasta hoy y en qué? Desagregá por uso final. Calculá el costo anual actual.",
    placeholder: "Ej.: Costo de energía actual = 620.000 kWh × 0,13 = 80.600 USD/año. Los motores representan el 48%…" },
  { id: "cambiosTecnicos", tipo: "texto", titulo: "Cambios técnicos",
    ayuda: "¿Qué equipos o instalaciones cambiarías? Indicá cantidades, potencias y el ahorro esperado de cada medida.",
    placeholder: "Ej.: Reemplazo de 260 tubos 2×36 W por LED 2×18 W → ahorro de …" },
  { id: "automatizacion", tipo: "texto", titulo: "Automatización y control",
    ayuda: "¿Qué automatizarías? Sensores, PLC, variadores, gestión de demanda, medición y verificación.",
    placeholder: "Ej.: Sensores de presencia y luz natural; control de presión del compresor; medidores por tablero…" },
  { id: "presupuesto", tipo: "presupuesto", titulo: "Presupuesto de la inversión",
    ayuda: "Cargá todos los ítems: equipos, instalación, ingeniería, puesta en marcha, imprevistos." },
  { id: "ahorro", tipo: "flujo", titulo: "Ahorro y amortización",
    ayuda: "Estimá el ahorro anual y el costo adicional de operación. Justificá el ahorro medida por medida.",
    placeholder: "Ej.: LED: 260 × 36 W × 4.800 h = 44.900 kWh/año → 5.840 USD…" }
];

// ---------------------------------------------------------------- Casos
const CASOS = [
  {
    titulo: "Reducir el consumo eléctrico de una planta de alimentos",
    area: "Ingeniería + Economía",
    dificultad: "Intermedia",
    enunciado:
      "Una planta elaboradora de pastas secas en Mendoza trabaja en 2 turnos (16 h/día, 300 días/año). " +
      "La gerencia quiere reducir al menos un 20% la factura eléctrica en el próximo año. " +
      "Debés proponer los cambios técnicos, qué automatizarías, el presupuesto de la inversión y en cuánto tiempo se amortiza.",
    datos: [
      { clave: "Consumo anual", valor: "620.000 kWh" },
      { clave: "Tarifa media energía", valor: "0,13 USD/kWh" },
      { clave: "Cargo por potencia", valor: "320 kW contratados · 9 USD/kW-mes" },
      { clave: "Factor de potencia medio", valor: "0,82 (recargo por bajo cos φ: 4% de la factura)" },
      { clave: "Motores (extrusoras, mezcladoras, cintas)", valor: "48% del consumo · arranque directo, sin variadores" },
      { clave: "Aire comprimido", valor: "14% del consumo · fugas estimadas 25%" },
      { clave: "Iluminación", valor: "12% · 260 tubos fluorescentes 2x36 W, encendido manual" },
      { clave: "Secaderos (resistencias + ventilación)", valor: "20% del consumo" },
      { clave: "Otros (oficinas, climatización)", valor: "6%" },
      { clave: "Presupuesto máximo aprobado", valor: "120.000 USD" },
      { clave: "Tasa de descuento de la empresa", valor: "12% anual" }
    ],
    objetivos: ["Reducir ≥ 20% el costo eléctrico anual", "No afectar la producción ni la calidad",
      "Recuperar la inversión en un plazo razonable para la empresa"],
    restricciones: ["Las obras sólo pueden hacerse en paradas de fin de semana", "Equipos con repuestos disponibles en Argentina"],
    referencia:
      "Costo de energía anual: 80.600 USD (620.000 kWh × 0,13). Costo de potencia anual: 34.560 USD (320 kW × 9 × 12). " +
      "Recargo por bajo cos φ: ≈ 4.606 USD/año. Costo eléctrico total ≈ 119.766 USD/año; la meta del 20% equivale a ≈ 24.000 USD/año.",
    secciones: SECCIONES_ENERGIA,
    tasa_descuento: 12,
    agentes: [{ clave: "tecnico", postura: "audaz" }, { clave: "economico", postura: "conservador" }]
  },
  {
    titulo: "Refrigeración eficiente en una bodega durante la vendimia",
    area: "Ingeniería + Economía",
    dificultad: "Avanzada",
    enunciado:
      "Una bodega mediana del Valle de Uco procesa 2,5 millones de kg de uva por año. Durante los 70 días de vendimia, " +
      "el sistema de frío para control de fermentación dispara el consumo y la demanda de potencia. " +
      "Proponé mejoras técnicas y de automatización, presupuestalas y evaluá la amortización.",
    datos: [
      { clave: "Consumo anual total", valor: "410.000 kWh (55% en los 70 días de vendimia)" },
      { clave: "Tarifa energía", valor: "0,14 USD/kWh (pico 0,19 · resto 0,12)" },
      { clave: "Chillers", valor: "2 equipos de 180 kW frigoríficos, COP medio 2,6, 14 años de antigüedad" },
      { clave: "Tanques de acero inoxidable", valor: "38 tanques sin aislación, control de temperatura manual" },
      { clave: "Bombas de agua glicolada", valor: "3 x 7,5 kW a velocidad fija" },
      { clave: "Pico de demanda en vendimia", valor: "290 kW (cargo 11 USD/kW-mes)" },
      { clave: "Radiación solar disponible", valor: "≈ 2.000 kWh/kWp·año" },
      { clave: "Presupuesto máximo", valor: "180.000 USD" },
      { clave: "Tasa de descuento", valor: "14% anual" }
    ],
    objetivos: ["Reducir el consumo y el pico de demanda en vendimia",
      "Mejorar el control de temperatura de fermentación (calidad del vino)",
      "Amortizar la inversión en un plazo aceptable para el directorio"],
    restricciones: ["No se pueden hacer obras entre febrero y abril", "El directorio es reacio a endeudarse en dólares"],
    referencia:
      "Costo de energía anual: 57.400 USD (410.000 kWh × 0,14). Costo de potencia anual ≈ 21.450 USD " +
      "(290 kW × 11 × 3 meses de vendimia + 120 kW × 11 × 9 meses).",
    secciones: SECCIONES_ENERGIA,
    tasa_descuento: 14,
    agentes: [{ clave: "tecnico", postura: "moderado" }, { clave: "economico", postura: "conservador" }]
  },
  {
    titulo: "Eficiencia energética en un edificio de oficinas",
    area: "Ingeniería + Economía",
    dificultad: "Inicial",
    enunciado:
      "Un edificio corporativo de 6 pisos (4.800 m²) con 300 empleados tiene una factura eléctrica alta. " +
      "La administración pide un plan de mejoras con presupuesto y período de repago.",
    datos: [
      { clave: "Consumo anual", valor: "540.000 kWh" },
      { clave: "Tarifa media", valor: "0,15 USD/kWh" },
      { clave: "Climatización (equipos split antiguos, 38 unidades)", valor: "52% del consumo" },
      { clave: "Iluminación (fluorescente, sin sensores)", valor: "24% del consumo" },
      { clave: "Equipos informáticos y servidores", valor: "18% del consumo" },
      { clave: "Ascensores y bombas", valor: "6% del consumo" },
      { clave: "Horario de uso", valor: "8 a 19 h, pero el 40% de las luces quedan encendidas de noche" },
      { clave: "Presupuesto máximo", valor: "90.000 USD" },
      { clave: "Tasa de descuento", valor: "10% anual" }
    ],
    objetivos: ["Reducir ≥ 25% el consumo", "Mantener el confort térmico y lumínico", "Repago menor a 4 años"],
    restricciones: ["El edificio no puede cerrar; obras por piso fuera del horario laboral"],
    referencia: "Costo de energía anual: 81.000 USD (540.000 kWh × 0,15). La meta del 25% equivale a 135.000 kWh/año.",
    secciones: SECCIONES_ENERGIA,
    tasa_descuento: 10,
    agentes: [{ clave: "tecnico", postura: "audaz" }, { clave: "economico", postura: "moderado" }]
  },
  {
    titulo: "Plan de negocios para una cafetería de especialidad",
    area: "Ciencias Económicas",
    dificultad: "Intermedia",
    enunciado:
      "Dos socios quieren abrir una cafetería de especialidad en el centro de Mendoza, a dos cuadras de la peatonal. " +
      "Tienen el local identificado y un capital propio limitado. Armá el plan de negocios: análisis de mercado, " +
      "propuesta comercial, inversión inicial, flujo de fondos y principales riesgos.",
    datos: [
      { clave: "Local", valor: "70 m², 28 cubiertos · alquiler 1.400 USD/mes · 3 meses de depósito" },
      { clave: "Flujo peatonal frente al local", valor: "≈ 3.500 personas/día hábil" },
      { clave: "Competencia en 400 m", valor: "5 cafeterías (2 de especialidad), ticket medio 6–9 USD" },
      { clave: "Capital propio de los socios", valor: "45.000 USD" },
      { clave: "Costo de mercadería", valor: "≈ 30% del precio de venta" },
      { clave: "Sueldos (4 empleados con cargas)", valor: "≈ 4.800 USD/mes" },
      { clave: "Servicios, insumos y otros fijos", valor: "≈ 1.100 USD/mes" },
      { clave: "Horario", valor: "Lunes a sábado, 8 a 20 h" },
      { clave: "Tasa de descuento de los socios", valor: "18% anual" }
    ],
    objetivos: ["Definir un cliente objetivo y una propuesta de valor diferencial",
      "Estimar ventas con supuestos explícitos y alcanzar el punto de equilibrio en el primer año",
      "Que la inversión inicial no supere el capital propio más un préstamo razonable"],
    restricciones: ["Los socios no quieren endeudarse por más de 20.000 USD", "La habilitación municipal demora 60 días"],
    referencia:
      "Costos fijos ≈ 7.300 USD/mes (alquiler 1.400 + sueldos 4.800 + otros 1.100). Con margen de contribución del 70% " +
      "el punto de equilibrio es ≈ 10.430 USD/mes de ventas; con ticket de 7 USD son ≈ 1.490 tickets/mes (≈ 57 por día). " +
      "Una inversión inicial razonable (equipamiento, obra, depósito, capital de trabajo) ronda 50.000–70.000 USD.",
    secciones: [
      { id: "mercado", tipo: "texto", titulo: "Análisis de mercado",
        ayuda: "¿Quién es tu cliente? ¿Cuánta demanda hay y cómo te diferenciás de la competencia?",
        placeholder: "Ej.: Del flujo de 3.500 personas/día, estimo que un 2% entra…" },
      { id: "comercial", tipo: "texto", titulo: "Propuesta comercial",
        ayuda: "Producto, precios, canales de venta y comunicación. Estimá ventas mensuales y justificalas.",
        placeholder: "Ej.: Ticket medio 7,5 USD; 70 tickets/día el primer semestre…" },
      { id: "presupuesto", tipo: "presupuesto", titulo: "Inversión inicial",
        ayuda: "Equipamiento, obra, mobiliario, depósito, habilitaciones y capital de trabajo." },
      { id: "flujo", tipo: "flujo", titulo: "Flujo de fondos",
        etiquetaIngreso: "Margen de contribución anual (ventas − mercadería)", etiquetaCosto: "Costos fijos anuales",
        ayuda: "Cargá el resultado anual esperado (ventas − costos variables) y los costos fijos anuales. Justificá los supuestos.",
        placeholder: "Ej.: Ventas 160.000 USD/año − mercadería 30% = 112.000 USD de margen…" },
      { id: "riesgos", tipo: "texto", titulo: "Riesgos y plan de contingencia",
        ayuda: "¿Qué puede salir mal y qué harías? Inflación, ventas menores, aumento del alquiler…",
        placeholder: "Ej.: Si las ventas son 20% menores al plan…" }
    ],
    tasa_descuento: 18,
    agentes: [{ clave: "comercial", postura: "audaz" }, { clave: "economico", postura: "conservador" }]
  }
];

export async function semilla() {
  await transaccion(async (db) => {
    // Administrador inicial
    const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const existe = await db.query("SELECT 1 FROM usuarios WHERE lower(email) = lower($1)", [email]);
      if (!existe.rowCount) {
        await db.query(
          "INSERT INTO usuarios (email, nombre, password_hash, rol, debe_cambiar_password) VALUES ($1, $2, $3, 'admin', false)",
          [email, process.env.ADMIN_NOMBRE || "Administrador", await bcrypt.hash(password, 10)]
        );
        console.log(`✔ administrador creado: ${email}`);
      }
    } else {
      console.warn("⚠  ADMIN_EMAIL y ADMIN_PASSWORD no están en el .env: no se creó el administrador.");
    }

    // Agentes
    const idPorClave = {};
    for (const { clave, ...a } of AGENTES) {
      const r = await db.query("SELECT id FROM agentes WHERE nombre = $1", [a.nombre]);
      if (r.rowCount) { idPorClave[clave] = r.rows[0].id; continue; }
      const ins = await db.query(
        `INSERT INTO agentes (nombre, cargo, iniciales, color, mirada, perfil, postura_defecto)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [a.nombre, a.cargo, a.iniciales, a.color, a.mirada, a.perfil, a.postura_defecto]
      );
      idPorClave[clave] = ins.rows[0].id;
      console.log(`✔ agente: ${a.nombre}`);
    }

    // Casos
    for (const { agentes, ...c } of CASOS) {
      const r = await db.query("SELECT 1 FROM casos WHERE titulo = $1", [c.titulo]);
      if (r.rowCount) continue;
      const ins = await db.query(
        `INSERT INTO casos (titulo, area, dificultad, enunciado, datos, objetivos, restricciones, referencia, secciones, tasa_descuento, publicado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) RETURNING id`,
        [c.titulo, c.area, c.dificultad, c.enunciado, JSON.stringify(c.datos), JSON.stringify(c.objetivos),
          JSON.stringify(c.restricciones), c.referencia, JSON.stringify(c.secciones), c.tasa_descuento]
      );
      for (const [orden, a] of agentes.entries()) {
        await db.query("INSERT INTO caso_agentes (caso_id, agente_id, orden, postura) VALUES ($1, $2, $3, $4)",
          [ins.rows[0].id, idPorClave[a.clave], orden, a.postura]);
      }
      console.log(`✔ caso: ${c.titulo}`);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  semilla()
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
