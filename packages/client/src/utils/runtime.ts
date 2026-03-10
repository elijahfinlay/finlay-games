const explicitServerUrl = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/$/, '');

export const SERVER_URL = explicitServerUrl || '';

export function apiUrl(path: `/${string}`): string {
  return `${SERVER_URL}${path}`;
}
