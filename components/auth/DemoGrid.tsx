"use client";

import { useEffect, useState } from "react";

/** Ordre de remplissage : une diagonale gagnante après quelques autres cases. */
const SEQUENCE = [1, 0, 5, 8];
const WIN = [0, 4, 8];

/**
 * Grille de démonstration 3×3 qui se coche toute seule jusqu'au BINGO,
 * puis recommence. Décorative (aria-hidden) ; respecte « réduire les animations ».
 */
export function DemoGrid({ phrases, bingoLabel }: { phrases: string[]; bingoLabel: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(SEQUENCE.length);
      return;
    }
    const id = window.setInterval(() => setStep((s) => (s >= SEQUENCE.length + 3 ? 0 : s + 1)), 900);
    return () => window.clearInterval(id);
  }, []);

  const checked = new Set([4, ...SEQUENCE.slice(0, step)]);
  const won = WIN.every((i) => checked.has(i));
  let k = 0;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px]">
      <div className="grid grid-cols-3 gap-1.5 rounded-3xl bg-gradient-to-b from-accent-soft to-surface p-2.5 shadow-xl shadow-violet-900/15 ring-1 ring-accent/15">
        {Array.from({ length: 9 }, (_, i) => {
          const free = i === 4;
          const text = free ? "★" : phrases[k++ % phrases.length];
          const on = checked.has(i);
          const winning = won && WIN.includes(i);
          return (
            <span
              key={i}
              className={`relative grid aspect-square place-items-center overflow-hidden rounded-xl border p-1 text-center text-[11px] leading-tight font-semibold transition-colors duration-300 ${
                free
                  ? "border-transparent bg-accent text-lg text-accent-fg"
                  : on
                    ? "border-accent/50 bg-accent-soft"
                    : "border-border bg-surface"
              } ${winning ? "animate-win border-gold" : ""}`}
            >
              {on && !free && (
                <span className="animate-stamp absolute inset-0 m-auto aspect-square w-[78%] rounded-full border-[3px] border-accent/45 bg-accent/10" />
              )}
              <span className="relative">{text}</span>
            </span>
          );
        })}
      </div>
      {won && (
        <span className="animate-bounce-in absolute -top-3 -right-2 rotate-6 rounded-full bg-gold px-3 py-1 text-sm font-black text-black shadow-lg">
          {bingoLabel} 🎉
        </span>
      )}
    </div>
  );
}
