"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Taille de police dynamique : cherche (dichotomie) la plus grande taille pour
 * laquelle le texte tient dans sa boîte, sans couper les mots si possible.
 * Le DOM est modifié directement : aucun re-render React par case.
 *
 * - `boxRef` : conteneur aux dimensions fixes (sans padding)
 * - `textRef` : bloc de texte, largeur 100 %, hauteur auto
 */
export function useFitText<Box extends HTMLElement, Text extends HTMLElement>(
  text: string,
  { min = 9, max = 22 }: { min?: number; max?: number } = {},
) {
  const boxRef = useRef<Box>(null);
  const textRef = useRef<Text>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    let frame = 0;

    const fits = (w: number, h: number) => el.scrollHeight <= h + 0.5 && el.scrollWidth <= w + 0.5;

    const fit = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;

      // plafond relatif à la case : un mot court ne doit pas devenir énorme
      const upper = Math.max(min, Math.min(max, Math.floor(w * 0.26)));

      // 1er passage : sans couper les mots
      el.style.overflowWrap = "normal";
      let lo = min;
      let hi = upper;
      let best = min;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        el.style.fontSize = `${mid}px`;
        if (fits(w, h)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      el.style.fontSize = `${best}px`;

      // un mot trop long même à la taille minimale : on autorise la coupure
      if (!fits(w, h)) el.style.overflowWrap = "anywhere";
    };

    fit();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(box);

    // les polices web peuvent changer les métriques après le premier rendu
    document.fonts?.ready.then(fit).catch(() => {});

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text, min, max]);

  return { boxRef, textRef };
}
