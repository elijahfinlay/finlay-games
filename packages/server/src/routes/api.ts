import { Router, type Router as RouterType } from 'express';
import { query } from '../db/index.js';

export const apiRouter: RouterType = Router();

// GET /api/leaderboard
apiRouter.get('/leaderboard', async (_req, res) => {
  const result = await query(
    'SELECT id, name, games_played, games_won, win_rate FROM leaderboard LIMIT 50',
  );
  if (!result) return res.json({ players: [], dbConnected: false });
  res.json({ players: result.rows, dbConnected: true });
});

// GET /api/matches/recent
apiRouter.get('/matches/recent', async (_req, res) => {
  const result = await query(
    `SELECT m.id, m.room_code, m.game_type, m.started_at, m.ended_at, m.rounds,
       json_agg(json_build_object(
         'player_id', mp.player_id,
         'name', p.name,
         'color', mp.color,
         'score', mp.score,
         'placement', mp.placement
       ) ORDER BY mp.placement) AS players
     FROM matches m
     JOIN match_players mp ON mp.match_id = m.id
     JOIN players p ON p.id = mp.player_id
     WHERE m.ended_at IS NOT NULL
     GROUP BY m.id
     ORDER BY COALESCE(m.started_at, m.ended_at) DESC
     LIMIT 20`,
  );
  if (!result) return res.json({ matches: [], dbConnected: false });
  res.json({ matches: result.rows, dbConnected: true });
});

// GET /api/players/:id/stats
apiRouter.get('/players/:id/stats', async (req, res) => {
  const result = await query(
    'SELECT id, name, games_played, games_won, created_at FROM players WHERE id = $1',
    [req.params.id],
  );
  if (!result || result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
  res.json(result.rows[0]);
});
