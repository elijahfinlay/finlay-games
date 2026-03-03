import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from '../constants/index.js';

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) return 'Name is required';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or less`;
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) return 'Name can only contain letters, numbers, spaces, hyphens, and underscores';
  return null;
}
