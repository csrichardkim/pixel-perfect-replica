/** Device-local memory so hosts and players can refresh and come back. */
const hostKey = (code: string) => `camp:host:${code}`;
const playerKey = (code: string) => `camp:player:${code}`;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const session = {
  getHostToken: (code: string) => safe(() => localStorage.getItem(hostKey(code)), null),
  setHostToken: (code: string, token: string) =>
    safe(() => localStorage.setItem(hostKey(code), token), undefined),
  getPlayerId: (code: string) => safe(() => localStorage.getItem(playerKey(code)), null),
  setPlayerId: (code: string, id: string) =>
    safe(() => localStorage.setItem(playerKey(code), id), undefined),
  clearPlayer: (code: string) => safe(() => localStorage.removeItem(playerKey(code)), undefined),
};
