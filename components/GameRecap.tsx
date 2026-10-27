"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useProofUrls } from "@/hooks/useProofUrls";
import { countChecked } from "@/lib/bingo";
import { frenchSpacing } from "@/lib/phrases";
import { themeStyle } from "@/lib/themes";
import type { BoardTheme, Game, GameClaim, GamePlayer, GameReaction } from "@/types/bingo";
import { ExportImageButton } from "./ExportImageButton";
import { useT } from "./I18nProvider";
import { rankPlayers } from "./Leaderboard";
import { Logo } from "./Logo";
import { PlayerAvatar } from "./PlayerAvatar";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Récap de fin de partie, pensé pour être partagé en image : podium, bingo le
 * plus rapide, phrase la plus commentée, meilleure photo, chiffres clés.
 */
export function GameRecap({
  title,
  theme,
  game,
  players,
  claims,
  reactions,
  phraseText,
  actions,
}: {
  title: string;
  theme: BoardTheme;
  game: Game;
  players: GamePlayer[];
  claims: GameClaim[];
  reactions: GameReaction[];
  phraseText: (phraseId: string) => string;
  /** boutons sous la carte (rejouer…) — hors de l'image exportée */
  actions?: ReactNode;
}) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);

  const recap = useMemo(() => {
    const ranked = rankPlayers(players);
    const start = new Date(game.created_at).getTime();
    const end = game.ended_at ? new Date(game.ended_at).getTime() : Date.now();

    const bingos = players.filter((p) => p.has_bingo && p.bingo_at);
    const fastest = bingos
      .map((p) => ({ player: p, ms: new Date(p.bingo_at!).getTime() - start }))
      .sort((a, b) => a.ms - b.ms)[0];

    const count = (type: GameReaction["target_type"], id: string) =>
      reactions.filter((r) => r.target_type === type && r.target_id === id).length;
    const confirmed = claims.filter((c) => c.status === "confirmed");
    const topClaim = confirmed
      .map((c) => ({ claim: c, n: count("claim", c.id) }))
      .sort((a, b) => b.n - a.n)[0];
    const photos = confirmed.filter((c) => c.photo_path);
    const bestPhoto = photos.map((c) => ({ claim: c, n: count("claim", c.id) })).sort((a, b) => b.n - a.n)[0]?.claim;

    return {
      podium: ranked.slice(0, 3),
      fastest,
      topClaim: topClaim && topClaim.n > 0 ? topClaim : undefined,
      bestPhoto,
      cells: players.reduce((sum, p) => sum + Math.max(0, countChecked(p.checked) - (p.grid.some((c) => c.free) ? 1 : 0)), 0),
      reactions: reactions.length,
      durationMs: Math.max(0, end - start),
    };
  }, [players, claims, reactions, game.created_at, game.ended_at]);

  const photoUrls = useProofUrls(recap.bestPhoto ? [recap.bestPhoto] : []);
  const photoUrl = recap.bestPhoto?.photo_path ? photoUrls[recap.bestPhoto.photo_path] : undefined;

  const duration = (ms: number) => {
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (minutes < 60) return t("recap.minutes", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t("recap.hours", { count: hours });
    return t("recap.days", { count: Math.round(hours / 24) });
  };

  return (
    <section className="space-y-3">
      <div
        ref={cardRef}
        className="themed animate-bounce-in relative overflow-hidden rounded-[2rem] p-5 text-white shadow-xl"
        style={{ ...themeStyle(theme), background: "linear-gradient(160deg, var(--accent), #1c1830 78%)" }}
      >
        <span aria-hidden className="pointer-events-none absolute -top-6 -right-4 text-[7rem] leading-none opacity-15">
          {theme.emoji}
        </span>
        <p className="relative text-xs font-black tracking-widest uppercase opacity-80">🏁 {t("recap.title")}</p>
        <h2 className="relative mt-1 text-2xl leading-tight font-black text-balance">{title}</h2>

        {/* podium */}
        {recap.podium.length > 0 ? (
          <ol className="relative mt-5 flex items-end justify-center gap-3">
            {[1, 0, 2].map((rank) => {
              const entry = recap.podium[rank];
              if (!entry) return <li key={rank} className="w-20" />;
              const big = rank === 0;
              return (
                <li key={entry.player.id} className="flex w-24 flex-col items-center text-center">
                  <span className="text-2xl" aria-hidden>
                    {MEDALS[rank]}
                  </span>
                  <PlayerAvatar userId={entry.player.user_id} avatar={entry.player.avatar} size={big ? 64 : 48} className="bg-white/10" />
                  <span className="mt-1 w-full truncate text-sm font-extrabold">{entry.player.nickname}</span>
                  <span className="text-xs opacity-80">
                    {entry.stage === 3
                      ? t("game.ranking.full")
                      : entry.stage === 2
                        ? t("game.ranking.double")
                        : entry.bingo
                          ? "BINGO"
                          : t("game.ranking.cells", { count: entry.count, total: entry.total })}
                  </span>
                  <span
                    aria-hidden
                    className={`mt-1 w-full rounded-t-xl bg-white/15 ${big ? "h-14" : rank === 1 ? "h-10" : "h-7"}`}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="relative mt-4 opacity-80">{t("game.ended.noWinner")}</p>
        )}

        {/* chiffres clés */}
        <dl className="relative mt-4 grid grid-cols-2 gap-2 text-center">
          {[
            { label: t("recap.duration"), value: duration(recap.durationMs) },
            {
              label: t("recap.fastest"),
              value: recap.fastest ? `${recap.fastest.player.nickname} · ${duration(recap.fastest.ms)}` : "—",
            },
            { label: t("recap.cells"), value: String(recap.cells) },
            { label: t("recap.reactions"), value: String(recap.reactions) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/12 p-2.5" style={{ background: "rgb(255 255 255 / 0.12)" }}>
              <dt className="text-[11px] font-bold tracking-wide uppercase opacity-75">{s.label}</dt>
              <dd className="truncate text-base font-black">{s.value}</dd>
            </div>
          ))}
        </dl>

        {recap.topClaim && (
          <div className="relative mt-3 rounded-2xl p-3" style={{ background: "rgb(255 255 255 / 0.12)" }}>
            <p className="text-[11px] font-bold tracking-wide uppercase opacity-75">🔥 {t("recap.cult")}</p>
            <p className="mt-0.5 font-extrabold">« {frenchSpacing(phraseText(recap.topClaim.claim.phrase_id))} »</p>
            <p className="text-xs opacity-80">{t("recap.cult.count", { count: recap.topClaim.n })}</p>
          </div>
        )}

        {photoUrl && (
          <figure className="relative mt-3 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" crossOrigin="anonymous" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-bold">
              📸 {t("recap.photo")}
            </figcaption>
          </figure>
        )}

        {/* pastille aux couleurs du thème : le logo (clair ou sombre) reste lisible */}
        <div className="relative mt-4 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1">
            <Logo size={20} />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <ExportImageButton targetRef={cardRef} title={title} className="btn btn-secondary btn-sm" label={t("recap.share")} icon="share" />
      </div>
      {actions}
    </section>
  );
}
