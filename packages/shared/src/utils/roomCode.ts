import { ROOM_CODE_LENGTH } from '../constants/index.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (ambiguous)

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}
