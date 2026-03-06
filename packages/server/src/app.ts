import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Serve client build (enables LAN play from a single URL)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});
