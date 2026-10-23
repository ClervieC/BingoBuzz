"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { vibrate } from "@/lib/haptics";

const MOVE_TOLERANCE = 10;

/**
 * Distingue tap et appui long sur un même élément.
 * - tap : `onTap` (via onClick, donc aussi clavier Entrée/Espace)
 * - appui long (≥ delay ms sans bouger) ou clic droit / touche Menu : `onLongPress`
 */
export function useLongPress({
  onTap,
  onLongPress,
  delay = 450,
}: {
  onTap?: () => void;
  onLongPress?: () => void;
  delay?: number;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!onLongPress || (e.pointerType === "mouse" && e.button !== 0)) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        vibrate(20);
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) clear();
    },
    [clear],
  );

  const onClick = useCallback(() => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    onTap?.();
  }, [onTap]);

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      // Android déclenche aussi contextmenu lors d'un appui long : déjà traité
      if (fired.current) return;
      clear();
      onLongPress?.();
    },
    [clear, onLongPress],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick,
    onContextMenu,
  };
}
