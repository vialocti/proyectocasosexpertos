// Conexión a PostgreSQL. DATABASE_URL en el .env, por ejemplo:
//   DATABASE_URL=postgres://usuario:clave@localhost:5432/casos_expertos
import pg from "pg";

// Las columnas numeric llegan como string; para este proyecto alcanza con número de JS.
pg.types.setTypeParser(1700, (v) => (v == null ? null : Number(v)));
// Las columnas date se devuelven como 'YYYY-MM-DD', sin conversión de zona horaria.
pg.types.setTypeParser(1082, (v) => v);

if (!process.env.DATABASE_URL) {
  console.error("⚠  Falta DATABASE_URL en el .env (ej.: postgres://usuario:clave@localhost:5432/casos_expertos)");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_MAX || 10)
});

export const query = (text, params) => pool.query(text, params);

/** Primera fila o null. */
export async function uno(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

/** Ejecuta `fn(client)` dentro de una transacción. */
export async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await fn(client);
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
