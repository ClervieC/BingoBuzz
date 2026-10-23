/** Vibration courte si l'appareil la supporte (Android ; ignoré silencieusement sur iOS). */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // certains navigateurs lèvent une erreur hors geste utilisateur
  }
}

export const haptics = {
  tap: () => vibrate(12),
  untap: () => vibrate(6),
  bingo: () => vibrate([60, 40, 60, 40, 160]),
  alert: () => vibrate([30, 30, 30]),
};
