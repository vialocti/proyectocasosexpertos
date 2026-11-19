import "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { MODO_DEMO } from "./agents.js";
import { PROVEEDOR, MODELO, NOMBRE_PROVEEDOR, CLAVE_REQUERIDA } from "./llm.js";
import { login, logout, yo, cambiarPassword, requiereSesion, requiereAdmin } from "./auth.js";
import trabajo, { ah } from "./routes/trabajo.js";
import admin from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1); // detrás de Nginx: IP real del cliente para el límite de intentos
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------- Públicas ----------
app.get("/api/salud", ah(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));
app.get("/api/info", (_req, res) => res.json({ modoDemo: MODO_DEMO, proveedor: PROVEEDOR, modelo: MODELO }));

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." }
});
app.post("/api/auth/login", limiteLogin, ah(login));
app.post("/api/auth/logout", logout);

// ---------- Con sesión ----------
app.use("/api", requiereSesion);
app.get("/api/auth/yo", yo);
app.post("/api/auth/password", ah(cambiarPassword));

// Quien tiene una contraseña provisoria debe cambiarla antes de usar el resto de la app.
app.use("/api", (req, res, next) =>
  req.usuario.debe_cambiar_password
    ? res.status(403).json({ error: "Tenés que cambiar tu contraseña provisoria.", codigo: "cambiar_password" })
    : next());

app.use("/api/admin", requiereAdmin, admin);
app.use("/api", trabajo);
app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// ---------- Frontend compilado (producción) ----------
const dist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  app.get("/", (_req, res) => res.type("text").send("API en funcionamiento. En desarrollo, abrí el frontend con `npm run dev` en la carpeta frontend."));
}

// ---------- Errores ----------
app.use((err, _req, res, _next) => {
  if (err.code === "22P02") return res.status(404).json({ error: "No encontramos ese recurso." }); // id con formato inválido
  if (err.code === "23503") return res.status(400).json({ error: "Hace referencia a un registro que no existe." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "El cuerpo del pedido no es JSON válido." });
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(MODO_DEMO
    ? `⚠  MODO DEMO (falta ${CLAVE_REQUERIDA} para ${NOMBRE_PROVEEDOR}): respuestas simuladas por reglas`
    : `Agentes conectados a ${NOMBRE_PROVEEDOR} · modelo ${MODELO}`);
});
