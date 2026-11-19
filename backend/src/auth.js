// Autenticación con email y contraseña. La sesión viaja en una cookie httpOnly firmada (JWT),
// así el frontend no maneja tokens y JavaScript no puede leerla.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uno, query } from "./db.js";

const SECRETO = process.env.JWT_SECRET;
if (!SECRETO || SECRETO.length < 32) {
  console.error("⚠  JWT_SECRET falta o es muy corto (mínimo 32 caracteres). Generá uno con: openssl rand -hex 32");
}
const COOKIE = "sesion";
const DURACION_DIAS = Number(process.env.SESION_DIAS || 7);
export const MIN_PASSWORD = 8;

export const hashPassword = (p) => bcrypt.hash(p, 10);

export function validarPassword(p) {
  if (typeof p !== "string" || p.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return null;
}

const usuarioPublico = (u) => ({
  id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, debeCambiarPassword: u.debe_cambiar_password
});

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Ingresá email y contraseña." });
  const u = await uno("SELECT * FROM usuarios WHERE lower(email) = lower($1)", [String(email).trim()]);
  // Mismo mensaje para usuario inexistente o contraseña incorrecta.
  if (!u || !u.activo || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: "Email o contraseña incorrectos." });
  }
  await query("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [u.id]);
  const token = jwt.sign({ sub: u.id }, SECRETO, { expiresIn: `${DURACION_DIAS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    maxAge: DURACION_DIAS * 864e5
  });
  res.json(usuarioPublico(u));
}

export function logout(_req, res) {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}

export const yo = (req, res) => res.json(usuarioPublico(req.usuario));

export async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body || {};
  const u = await uno("SELECT password_hash FROM usuarios WHERE id = $1", [req.usuario.id]);
  if (!(await bcrypt.compare(actual || "", u.password_hash))) return res.status(400).json({ error: "La contraseña actual no es correcta." });
  const err = validarPassword(nueva);
  if (err) return res.status(400).json({ error: err });
  if (nueva === actual) return res.status(400).json({ error: "La contraseña nueva tiene que ser distinta de la actual." });
  await query("UPDATE usuarios SET password_hash = $1, debe_cambiar_password = false, actualizado_en = now() WHERE id = $2",
    [await hashPassword(nueva), req.usuario.id]);
  res.json({ ok: true });
}

/** Exige sesión válida. Relee el usuario de la base para respetar bajas y cambios de rol al instante. */
export async function requiereSesion(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: "Iniciá sesión para continuar." });
    const { sub } = jwt.verify(token, SECRETO);
    const u = await uno("SELECT id, email, nombre, rol, activo, debe_cambiar_password FROM usuarios WHERE id = $1", [sub]);
    if (!u || !u.activo) return res.status(401).json({ error: "Tu usuario no está activo." });
    req.usuario = u;
    next();
  } catch {
    res.status(401).json({ error: "La sesión venció. Iniciá sesión de nuevo." });
  }
}

export function requiereAdmin(req, res, next) {
  if (req.usuario?.rol !== "admin") return res.status(403).json({ error: "Solo para administradores." });
  next();
}
