// Cálculos financieros de la propuesta del alumno: inversión, flujo neto,
// repago simple, repago descontado, VAN y TIR.

export function analizarFinanzas(solucion = {}, tasaPct = 12) {
  const items = Array.isArray(solucion.items) ? solucion.items : [];
  const inversion = items.reduce(
    (acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.costoUnitario) || 0),
    0
  );
  const ahorro = Number(solucion.ahorroAnual) || 0;
  const costoOp = Number(solucion.costoOperativoAnual) || 0;
  const vida = Math.max(1, Math.round(Number(solucion.vidaUtil) || 10));
  const tasa = (Number(tasaPct) || 0) / 100;
  const flujo = ahorro - costoOp;

  const flujos = [-inversion, ...Array(vida).fill(flujo)];
  const van = npv(tasa, flujos);
  const tir = irr(flujos);

  const repagoSimple = flujo > 0 ? inversion / flujo : null;

  let repagoDescontado = null;
  let acumulado = -inversion;
  for (let t = 1; t <= vida; t++) {
    const fd = flujo / Math.pow(1 + tasa, t);
    if (acumulado + fd >= 0 && fd > 0) {
      repagoDescontado = t - 1 + -acumulado / fd;
      break;
    }
    acumulado += fd;
  }

  return {
    inversion: round(inversion),
    ahorroAnual: round(ahorro),
    costoOperativoAnual: round(costoOp),
    flujoNetoAnual: round(flujo),
    vidaUtil: vida,
    tasaDescuento: tasaPct,
    repagoSimpleAnios: repagoSimple == null ? null : round(repagoSimple, 2),
    repagoDescontadoAnios: repagoDescontado == null ? null : round(repagoDescontado, 2),
    van: round(van),
    tir: tir == null ? null : round(tir * 100, 1),
    flujoAcumulado: acumularFlujos(flujos)
  };
}

function npv(rate, flows) {
  return flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
}

function irr(flows) {
  if (!(flows[0] < 0) || flows.slice(1).every((f) => f <= 0)) return null;
  let lo = -0.99, hi = 10;
  if (npv(lo, flows) * npv(hi, flows) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid, flows) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function acumularFlujos(flows) {
  let acc = 0;
  return flows.map((f, t) => ({ anio: t, acumulado: round((acc += f)) }));
}

function round(x, d = 0) {
  const k = Math.pow(10, d);
  return Math.round(x * k) / k;
}

export function extraerTasa(caso) {
  const d = caso.datos.find((x) => /tasa/i.test(x.clave));
  const m = d && d.valor.match(/([\d.,]+)/);
  return m ? Number(m[1].replace(",", ".")) : 12;
}
