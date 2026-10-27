"use client";

import { useState } from "react";
import { REACTION_EMOJIS, type GamePlayer, type GameReaction, type ReactionEmoji } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { PlayerAvatar } from "./PlayerAvatar";

/**
 * Réactions emoji sur un bingo ou une proposition : compteurs (appuyer
 * ajoute / retire la sienne), petit sélecteur pour en ajouter une, et, si
 * `players` est fourni, la liste de qui a réagi avec quoi.
 */
export function ReactionBar({
  reactions,
  targetType,
  targetId,
  userId,
  onToggle,
  players,
  className = "",
}: {
  reactions: GameReaction[];
  targetType: GameReaction["target_type"];
  targetId: string;
  userId: string | null;
  onToggle: (emoji: ReactionEmoji) => void;
  /** pour afficher qui a réagi */
  players?: GamePlayer[];
  className?: string;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [showWho, setShowWho] = useState(false);
  const mine = reactions.filter((r) => r.target_type === targetType && r.target_id === targetId);
  const counts = REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: mine.filter((r) => r.emoji === emoji).length,
    own: mine.some((r) => r.emoji === emoji && r.user_id === userId),
  }));
  const shown = picking ? counts : counts.filter((c) => c.count > 0);
  const playerOf = (uid: string) => players?.find((p) => p.user_id === uid);
  // un auteur une seule fois dans la pile d'avatars
  const reactors = [...new Set(mine.map((r) => r.user_id))];

  return (
    <div className={className}>
      <div role="group" aria-label={t("reactions.label")} className="flex flex-wrap items-center gap-1.5">
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
        {players && reactors.length > 0 && (
          <button
            type="button"
            aria-expanded={showWho}
            onClick={() => setShowWho((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-1.5 text-xs font-bold text-muted transition active:scale-95"
          >
            <span className="flex -space-x-2" aria-hidden>
              {reactors.slice(0, 3).map((uid) => (
                <PlayerAvatar key={uid} userId={uid} avatar={playerOf(uid)?.avatar} size={22} className="bg-surface ring-2 ring-surface" />
              ))}
            </span>
            {t("reactions.who")}
          </button>
        )}
      </div>
      {showWho && players && (
        <ul className="animate-rise mt-1.5 space-y-1 rounded-xl bg-surface-2 p-2 text-sm" aria-label={t("reactions.who")}>
          {mine.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <PlayerAvatar userId={r.user_id} avatar={playerOf(r.user_id)?.avatar} size={22} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {r.user_id === userId ? t("game.ranking.you") : (playerOf(r.user_id)?.nickname ?? "?")}
              </span>
              <span aria-hidden>{r.emoji}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
