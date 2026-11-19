// Mismo cálculo que backend/src/finance.js, para mostrar los indicadores al instante mientras se escribe.
// El servidor vuelve a calcularlos al guardar y es la fuente de verdad para los evaluadores.

export function analizarFinanzas(solucion = {}, tasaPct = 12) {
  const items = Array.isArray(solucion.items) ? solucion.items : [];
  const inversion = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.costoUnitario) || 0), 0);
  const ahorro = Number(solucion.ahorroAnual) || 0;
  const costoOp = Number(solucion.costoOperativoAnual) || 0;
  const vida = Math.max(1, Math.round(Number(solucion.vidaUtil) || 10));
  const tasa = (Number(tasaPct) || 0) / 100;
  const flujo = ahorro - costoOp;
  const flujos = [-inversion, ...Array(vida).fill(flujo)];

  let repagoDescontado = null, acumulado = -inversion;
  for (let t = 1; t <= vida; t++) {
    const fd = flujo / Math.pow(1 + tasa, t);
    if (acumulado + fd >= 0 && fd > 0) { repagoDescontado = t - 1 + -acumulado / fd; break; }
    acumulado += fd;
  }
  let acc = 0;
  return {
    inversion,
    flujoNetoAnual: flujo,
    vidaUtil: vida,
    tasaDescuento: tasaPct,
    repagoSimpleAnios: flujo > 0 ? inversion / flujo : null,
    repagoDescontadoAnios: repagoDescontado,
    van: npv(tasa, flujos),
    tir: irr(flujos),
    flujoAcumulado: flujos.map((f, t) => ({ anio: t, acumulado: (acc += f) }))
  };
}

const npv = (r, f) => f.reduce((a, x, t) => a + x / Math.pow(1 + r, t), 0);

function irr(f) {
  if (!(f[0] < 0) || f.slice(1).every((x) => x <= 0)) return null;
  let lo = -0.99, hi = 10;
  if (npv(lo, f) * npv(hi, f) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(m, f) > 0) lo = m; else hi = m; }
  return ((lo + hi) / 2) * 100;
}
