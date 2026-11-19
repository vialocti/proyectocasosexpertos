// Evaluador de expresiones propio (sin eval): números, + - * / ^, %, paréntesis, funciones y constantes.
// Decimales con coma o punto; argumentos separados con ";".

export const FUNCIONES = {
  raiz: Math.sqrt, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
  sen: Math.sin, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a), suma: (...a) => a.reduce((s, x) => s + x, 0),
  redondear: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n,
  van: (t, ...f) => f.reduce((s, x, i) => s + x / (1 + t) ** i, 0),
  tir: (...f) => tir(f),
  repago: (inv, flujo) => Math.abs(inv) / flujo,
  cuota: (t, n, p) => (t === 0 ? p / n : (p * t) / (1 - (1 + t) ** -n)),
  va: (t, n, f) => (t === 0 ? f * n : (f * (1 - (1 + t) ** -n)) / t),
  equilibrio: (fijos, precio, variable) => fijos / (precio - variable)
};

function tir(f) {
  const van = (r) => f.reduce((s, x, i) => s + x / (1 + r) ** i, 0);
  let lo = -0.99, hi = 10;
  if (van(lo) * van(hi) > 0) throw new Error("La TIR no está definida para esos flujos");
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; van(lo) * van(m) <= 0 ? (hi = m) : (lo = m); }
  return (lo + hi) / 2;
}

export function evaluar(expr, ans) {
  const toks = expr.replace(/\s+/g, "").match(/\d+(?:[.,]\d+)?|[a-záéíóúñ_]+|[-+*/^%();]|./gi) || [];
  let i = 0;
  const ver = () => toks[i];
  const tomar = (t) => { if (toks[i] !== t) throw new Error(`Se esperaba "${t}"`); i++; };
  const suma = () => { let v = prod(); while (ver() === "+" || ver() === "-") v = toks[i++] === "+" ? v + prod() : v - prod(); return v; };
  const prod = () => { let v = unario(); while (ver() === "*" || ver() === "/") v = toks[i++] === "*" ? v * unario() : v / unario(); return v; };
  const unario = () => (ver() === "-" ? (i++, -unario()) : ver() === "+" ? (i++, unario()) : pot());
  const pot = () => { const b = postfijo(); return ver() === "^" ? (i++, b ** unario()) : b; };
  const postfijo = () => { let v = atomo(); while (ver() === "%") { i++; v /= 100; } return v; };
  const atomo = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error("Expresión incompleta");
    if (/^\d/.test(t)) return parseFloat(t.replace(",", "."));
    if (t === "(") { const v = suma(); tomar(")"); return v; }
    const n = t.toLowerCase();
    if (n === "pi") return Math.PI;
    if (n === "e") return Math.E;
    if (n === "ans") return ans ?? 0;
    if (FUNCIONES[n]) {
      tomar("(");
      const args = [];
      if (ver() !== ")") { args.push(suma()); while (ver() === ";") { i++; args.push(suma()); } }
      tomar(")");
      return FUNCIONES[n](...args);
    }
    throw new Error(`No reconozco "${t}"`);
  };
  const v = suma();
  if (i < toks.length) throw new Error(`Sobra "${toks[i]}"`);
  if (!Number.isFinite(v)) throw new Error("El resultado no es un número finito");
  return v;
}
