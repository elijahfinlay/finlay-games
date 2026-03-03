import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message);
    });
    console.log('[DB] Connected to Neon Postgres');
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  const p = getPool();
  if (!p) return null;
  return p.query(text, params);
}
