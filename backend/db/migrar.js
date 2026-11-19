// Aplica en orden las migraciones de db/migrations que todavía no se ejecutaron.
// Uso: npm run migrar
import "../src/env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export async function migrar() {
  await pool.query(`CREATE TABLE IF NOT EXISTS migraciones (
    nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await pool.query("SELECT nombre FROM migraciones");
  const hechas = new Set(rows.map((r) => r.nombre));
  const pendientes = fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && !hechas.has(f)).sort();

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(dir, archivo), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migraciones (nombre) VALUES ($1)", [archivo]);
      await client.query("COMMIT");
      console.log(`✔ migración aplicada: ${archivo}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Falló la migración ${archivo}: ${e.message}`);
    } finally {
      client.release();
    }
  }
  if (!pendientes.length) console.log("La base ya está al día.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrar()
    .then(() => pool.end())
    .catch((e) => { console.error(e.message); process.exit(1); });
}
