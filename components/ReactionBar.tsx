"use client";

import { useState } from "react";
import { REACTION_EMOJIS, type GameReaction, type ReactionEmoji } from "@/types/bingo";
import { useT } from "./I18nProvider";

/**
 * Réactions emoji sur un bingo ou une proposition : compteurs (appuyer
 * ajoute / retire la sienne) et petit sélecteur pour en ajouter une.
 */
export function ReactionBar({
  reactions,
  targetType,
  targetId,
  userId,
  onToggle,
  className = "",
}: {
  reactions: GameReaction[];
  targetType: GameReaction["target_type"];
  targetId: string;
  userId: string | null;
  onToggle: (emoji: ReactionEmoji) => void;
  className?: string;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const mine = reactions.filter((r) => r.target_type === targetType && r.target_id === targetId);
  const counts = REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: mine.filter((r) => r.emoji === emoji).length,
    own: mine.some((r) => r.emoji === emoji && r.user_id === userId),
  }));
  const shown = picking ? counts : counts.filter((c) => c.count > 0);

  return (
    <div role="group" aria-label={t("reactions.label")} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map(({ emoji, count, own }) => (
        <button
          key={emoji}
          type="button"
          aria-pressed={own}
          aria-label={t("reactions.add", { emoji })}
          onClick={() => {
            onToggle(emoji);
            setPicking(false);
          }}
          className={`animate-bounce-in inline-flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 text-sm font-bold tabular-nums transition active:scale-90 ${
            own ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"
          }`}
        >
          <span aria-hidden>{emoji}</span>
          {count > 0 && <span>{count}</span>}
        </button>
      ))}
      <button
        type="button"
        aria-expanded={picking}
        aria-label={t("reactions.label")}
        onClick={() => setPicking((p) => !p)}
        className="inline-flex min-h-[32px] items-center rounded-full border border-dashed border-border px-2.5 text-sm text-muted transition active:scale-90"
      >
        {picking ? "×" : "☺︎+"}
      </button>
    </div>
  );
}
