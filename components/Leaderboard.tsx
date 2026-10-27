"use client";

import { useMemo, type ReactNode } from "react";
import { cellsToBingo, countChecked, detectBingo, hasBingo, sizeFromLength } from "@/lib/bingo";
import type { GamePlayer } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { PlayerAvatar } from "./PlayerAvatar";

export interface RankedPlayer {
  player: GamePlayer;
  count: number;
  total: number;
  missing: number;
  bingo: boolean;
  /** palier atteint : 0 rien, 1 bingo, 2 double bingo, 3 carton plein */
  stage: 0 | 1 | 2 | 3;
}

/** Moment où le palier a été atteint (pour départager). */
function stageAt(p: GamePlayer, stage: number): string {
  return (stage === 3 ? p.full_at : stage === 2 ? p.double_at : p.bingo_at) ?? "~";
}

/**
 * Classement : palier le plus haut d'abord (carton plein, double bingo, bingo),
 * à palier égal le premier arrivé ; puis nombre de cases cochées, puis
 * proximité d'une ligne complète.
 */
export function rankPlayers(players: GamePlayer[]): RankedPlayer[] {
  return players
    // pas encore de grille (partie en préparation, ou distribution en cours)
    .filter((player) => player.grid.length > 0)
    .map((player) => {
      const size = sizeFromLength(player.grid.length);
      const count = countChecked(player.checked);
      const bingo = hasBingo(player.checked, size);
      const lines = detectBingo(player.checked, size).lines.length;
      const stage: RankedPlayer["stage"] = count === player.grid.length ? 3 : lines >= 2 ? 2 : bingo ? 1 : 0;
      return {
        player,
        count,
        total: player.grid.length,
        missing: cellsToBingo(player.checked, size),
        bingo,
        stage,
      };
    })
    .sort((a, b) => {
      if (a.stage !== b.stage) return b.stage - a.stage;
      if (a.stage > 0) return stageAt(a.player, a.stage).localeCompare(stageAt(b.player, b.stage));
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
  renderExtra,
}: {
  players: GamePlayer[];
  userId: string | null;
  hostId: string | null;
  online: ReadonlySet<string>;
  onSelect: (player: GamePlayer) => void;
  /** contenu sous la ligne d'un joueur (réactions sur son bingo) */
  renderExtra?: (player: GamePlayer, bingo: boolean) => ReactNode;
}) {
  const t = useT();
  const ranked = useMemo(() => rankPlayers(players), [players]);

  if (ranked.length === 0) {
    return <p className="card p-6 text-center text-muted">{t("game.ranking.empty")}</p>;
  }

  return (
    <ol className="stagger space-y-2" aria-live="polite">
      {ranked.map(({ player, count, total, missing, bingo, stage }, i) => {
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
                {bingo ? (
                  <Icon name="trophy" size={18} />
                ) : count > 0 && i < 3 ? (
                  <span className="text-2xl leading-none">{["🥇", "🥈", "🥉"][i]}</span>
                ) : (
                  i + 1
                )}
              </span>
              <span className="relative">
                <PlayerAvatar userId={player.user_id} avatar={player.avatar} size={40} />
                <span
                  aria-label={isOnline ? t("game.ranking.online") : t("game.ranking.offline")}
                  role="img"
                  className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface ${isOnline ? "bg-success" : "bg-border"}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold">{player.nickname}</span>
                  {isMe && <span className="chip shrink-0">{t("game.ranking.you")}</span>}
                  {player.user_id === hostId && (
                    <span className="shrink-0 text-xs font-semibold text-muted">{t("game.ranking.host")}</span>
                  )}
                </span>
                {bingo ? (
                  <span className="block text-sm font-black tracking-wide text-gold">
                    {stage === 3 ? `${t("game.ranking.full")} 💯` : stage === 2 ? `${t("game.ranking.double")} 🔥` : `${t("game.ranking.bingo")} 🎉`}
                  </span>
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
            {renderExtra?.(player, bingo)}
          </li>
        );
      })}
    </ol>
  );
}
