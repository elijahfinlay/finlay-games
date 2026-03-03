export const MAX_PLAYERS = 8;
export const ROOM_CODE_LENGTH = 4;
export const MAX_NAME_LENGTH = 12;
export const MIN_NAME_LENGTH = 1;

export const DISCONNECT_GRACE_MS = 10_000;
export const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export const ROUND_TIME_OPTIONS = [60, 90, 120, 180, 240] as const;
export const ROUNDS_OPTIONS = [1, 3, 5, 7] as const;
