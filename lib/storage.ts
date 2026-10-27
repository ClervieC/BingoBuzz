/** Accès localStorage tolérant (navigation privée, quota, SSR). */

export function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : la partie continue, simplement sans sauvegarde
  }
}

export const storageKeys = {
  solo: (boardId: string) => `bingobuzz:solo:${boardId}`,
  nickname: "bingobuzz:nickname",
  avatar: "bingobuzz:avatar",
  celebrated: (gameId: string) => `bingobuzz:celebrated:${gameId}`,
  pushDismissed: "bingobuzz:push-dismissed",
};
