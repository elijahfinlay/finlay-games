import { query, getPool } from './index.js';
import type { PlayerColor } from '@finlay-games/shared';

interface MatchPlayerData {
  playerId: string;
  name: string;
  color: PlayerColor;
  score: number;
  placement: number;
}

export async function getOrCreatePlayer(name: string): Promise<string | null> {
  const result = await query(
    `INSERT INTO players (name) VALUES ($1)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [name],
  );
  if (!result || result.rows.length === 0) {
    // Player already exists, find them
    const existing = await query('SELECT id FROM players WHERE name = $1 LIMIT 1', [name]);
    return existing?.rows[0]?.id ?? null;
  }
  return result.rows[0].id;
}

export async function recordMatch(
  roomCode: string,
  gameType: string,
  rounds: number,
  players: MatchPlayerData[],
  winnerId: string | null,
): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create match
    const matchResult = await client.query(
      `INSERT INTO matches (room_code, game_type, started_at, ended_at, rounds, winner_id)
       VALUES ($1, $2, now(), now(), $3, $4)
       RETURNING id`,
      [roomCode, gameType, rounds, winnerId],
    );
    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const matchId = matchResult.rows[0].id as string;

    // Insert all match players
    for (const p of players) {
      await client.query(
        `INSERT INTO match_players (match_id, player_id, color, score, placement)
         VALUES ($1, $2, $3, $4, $5)`,
        [matchId, p.playerId, p.color, p.score, p.placement],
      );
    }

    // Update player stats
    for (const p of players) {
      await client.query(
        `UPDATE players SET
          games_played = games_played + 1,
          games_won = games_won + CASE WHEN $1 = id THEN 1 ELSE 0 END
         WHERE id = $2`,
        [winnerId, p.playerId],
      );
    }

    await client.query('COMMIT');
    return matchId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
