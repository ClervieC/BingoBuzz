"use client";

import { useMemo } from "react";
import { cellsToBingo, countChecked, hasBingo, sizeFromLength } from "@/lib/bingo";
import type { GamePlayer } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

export interface RankedPlayer {
  player: GamePlayer;
  count: number;
  total: number;
  missing: number;
  bingo: boolean;
}

/**
 * Classement : bingos d'abord (par ordre d'arrivée), puis nombre de cases
 * cochées, puis proximité d'une ligne complète.
 */
export function rankPlayers(players: GamePlayer[]): RankedPlayer[] {
  return players
    .map((player) => {
      const size = sizeFromLength(player.grid.length);
      return {
        player,
        count: countChecked(player.checked),
        total: player.grid.length,
        missing: cellsToBingo(player.checked, size),
        bingo: hasBingo(player.checked, size),
      };
    })
    .sort((a, b) => {
      if (a.bingo !== b.bingo) return a.bingo ? -1 : 1;
      if (a.bingo && b.bingo) {
        return (a.player.bingo_at ?? "~").localeCompare(b.player.bingo_at ?? "~");
      }
      if (a.count !== b.count) return b.count - a.count;
      if (a.missing !== b.missing) return a.missing - b.missing;
      return a.player.joined_at.localeCompare(b.player.joined_at);
    });
}

export function Leaderboard({
  players,
  userId,
  hostId,
  online,
  onSelect,
}: {
  players: GamePlayer[];
  userId: string | null;
  hostId: string | null;
  online: ReadonlySet<string>;
  onSelect: (player: GamePlayer) => void;
}) {
  const t = useT();
  const ranked = useMemo(() => rankPlayers(players), [players]);

  if (ranked.length === 0) {
    return <p className="card p-6 text-center text-muted">{t("game.ranking.empty")}</p>;
  }

  return (
    <ol className="space-y-2" aria-live="polite">
      {ranked.map(({ player, count, total, missing, bingo }, i) => {
        const isMe = player.user_id === userId;
        const isOnline = online.has(player.user_id);
        return (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onSelect(player)}
              className={`card flex min-h-[64px] w-full items-center gap-3 p-3 text-left transition active:scale-[0.99] ${
                bingo ? "border-gold bg-gold/10" : isMe ? "border-accent/50" : ""
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                  bingo ? "bg-gold text-black" : "bg-surface-2"
                }`}
              >
                {bingo ? <Icon name="trophy" size={18} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    aria-label={isOnline ? t("game.ranking.online") : t("game.ranking.offline")}
                    role="img"
                    className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? "bg-success" : "bg-border"}`}
                  />
                  <span className="truncate font-bold">{player.nickname}</span>
                  {isMe && <span className="chip shrink-0">{t("game.ranking.you")}</span>}
                  {player.user_id === hostId && (
                    <span className="shrink-0 text-xs font-semibold text-muted">{t("game.ranking.host")}</span>
                  )}
                </span>
                {bingo ? (
                  <span className="block text-sm font-black tracking-wide text-gold">{t("game.ranking.bingo")} 🎉</span>
                ) : missing === 1 ? (
                  <span className="block animate-pulse text-sm font-bold text-accent">{t("game.ranking.oneLeft")}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-black tabular-nums">{t("game.ranking.cells", { count, total })}</span>
                <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(count / total) * 100}%` }} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
