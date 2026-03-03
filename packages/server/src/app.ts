import express, { type Express } from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { getPool } from './db/index.js';

export const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const pool = getPool();
  let dbStatus = 'no DATABASE_URL';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }
  res.json({ status: 'ok', db: dbStatus, timestamp: Date.now() });
});

app.use('/api', apiRouter);
