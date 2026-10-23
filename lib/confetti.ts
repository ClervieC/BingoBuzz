"use client";

/** Confettis (canvas-confetti chargé à la demande pour alléger le premier rendu). */
export async function fireConfetti(kind: "bingo" | "full" | "small" = "bingo"): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const { default: confetti } = await import("canvas-confetti");
  const colors = ["#7c3aed", "#f59e0b", "#ec4899", "#10b981", "#3b82f6"];

  if (kind === "small") {
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    return;
  }

  const duration = kind === "full" ? 2500 : 1200;
  const end = Date.now() + duration;
  confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors, disableForReducedMotion: true });

  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
