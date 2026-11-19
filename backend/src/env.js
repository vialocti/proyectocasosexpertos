// Carga backend/.env sin importar desde qué carpeta se arranque el proceso (PM2, systemd, etc.).
// Se importa primero en server.js para que las variables estén listas antes que el resto de los módulos.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rutaEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
const { error } = dotenv.config({ path: rutaEnv });
if (error) console.warn(`⚠  No se encontró ${rutaEnv}; se usan solo las variables del entorno.`);
else console.log(`Configuración cargada de ${rutaEnv}`);
