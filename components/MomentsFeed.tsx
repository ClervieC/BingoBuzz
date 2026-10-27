"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useProofUrls } from "@/hooks/useProofUrls";
import { frenchSpacing } from "@/lib/phrases";
import type { GameClaim, GameEvent, GamePlayer, GameReaction } from "@/types/bingo";
import { BottomSheet } from "./BottomSheet";
import { useI18n, useT } from "./I18nProvider";
import { PlayerAvatar } from "./PlayerAvatar";

type Moment = {
  id: string;
  at: string;
  userId: string | null;
  icon: string;
  text: ReactNode;
  extra?: ReactNode;
  /** proposition avec photo de preuve : affichée dans le moment */
  photo?: GameClaim;
};

function ago(iso: string, locale: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (Math.abs(seconds) < 60) return rtf.format(0, "second");
  if (Math.abs(seconds) < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

/**
 * Fil de la partie : arrivées, phrases vues / validées (avec leur photo de
 * preuve), bingos, du plus récent au plus ancien. Reconstitué à partir des
 * données déjà chargées.
 */
export function MomentsFeed({
  players,
  claims,
  events,
  phraseText,
  renderReactions,
}: {
  players: GamePlayer[];
  claims: GameClaim[];
  events: GameEvent[];
  phraseText: (phraseId: string) => string;
  /** réactions sous chaque moment (cible : type + id) */
  renderReactions?: (targetType: GameReaction["target_type"], targetId: string) => ReactNode;
}) {
  const t = useT();
  const { locale } = useI18n();
  const photoUrls = useProofUrls(claims);
  const [viewing, setViewing] = useState<GameClaim | null>(null);

  const moments = useMemo(() => {
    const byUser = new Map(players.map((p) => [p.user_id, p]));
    const name = (uid: string | null) => (uid ? (byUser.get(uid)?.nickname ?? "?") : "?");
    const list: Moment[] = [];

    for (const p of players) {
      list.push({
        id: `join-${p.id}`,
        at: p.joined_at,
        userId: p.user_id,
        icon: "👋",
        text: t("moments.join", { name: p.nickname }),
        extra: renderReactions?.("join", p.id),
      });
      if (p.has_bingo && p.bingo_at) {
        list.push({
          id: `bingo-${p.id}`,
          at: p.bingo_at,
          userId: p.user_id,
          icon: "🎉",
          text: <strong>{t("moments.bingo", { name: p.nickname })}</strong>,
          extra: renderReactions?.("bingo", p.id),
        });
      }
      if (p.double_at && !p.full_at) {
        list.push({
          id: `double-${p.id}`,
          at: p.double_at,
          userId: p.user_id,
          icon: "🔥",
          text: <strong>{t("moments.double", { name: p.nickname })}</strong>,
          extra: renderReactions?.("double", p.id),
        });
      }
      if (p.full_at) {
        list.push({
          id: `full-${p.id}`,
          at: p.full_at,
          userId: p.user_id,
          icon: "💯",
          text: <strong>{t("moments.full", { name: p.nickname })}</strong>,
          extra: renderReactions?.("full", p.id),
        });
      }
    }
    for (const c of claims) {
      // en attente : seulement si une photo l'accompagne (à voir tout de suite)
      if (c.status !== "confirmed" && !(c.status === "pending" && c.photo_path)) continue;
      const vars = { name: name(c.claimed_by), text: frenchSpacing(phraseText(c.phrase_id)) };
      list.push({
        id: `claim-${c.id}`,
        at: c.resolved_at ?? c.created_at,
        userId: c.claimed_by,
        icon: c.photo_path ? "📸" : "👀",
        text: c.status === "pending" ? t("moments.claimPending", vars) : t("moments.claim", vars),
        extra: renderReactions?.("claim", c.id),
        photo: c.photo_path ? c : undefined,
      });
    }
    for (const e of events) {
      list.push({
        id: `event-${e.id}`,
        at: e.created_at,
        userId: null,
        icon: "✅",
        text: t("moments.validated", { text: frenchSpacing(phraseText(e.phrase_id)) }),
        extra: renderReactions?.("event", e.id),
      });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  }, [players, claims, events, phraseText, renderReactions, t]);

  const avatarOf = (uid: string | null) => players.find((p) => p.user_id === uid)?.avatar;

  return (
    <section aria-live="polite">
      <h2 className="mb-2 text-lg font-extrabold">{t("moments.title")}</h2>
      {moments.length === 0 ? (
        <p className="card p-5 text-center text-sm text-muted">{t("moments.empty")}</p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-0.5 before:bg-border">
          {moments.map((m) => (
            <li key={m.id} className="animate-rise relative flex gap-3">
              {m.userId ? (
                <PlayerAvatar userId={m.userId} avatar={avatarOf(m.userId)} size={36} className="relative bg-surface" />
              ) : (
                <span aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg">
                  {m.icon}
                </span>
              )}
              <div className="min-w-0 flex-1 pt-1.5">
                <p className="text-sm leading-snug">
                  {m.userId && <span aria-hidden>{m.icon} </span>}
                  {m.text}
                </p>
                <p className="text-xs text-muted">{ago(m.at, locale)}</p>
                {m.photo?.photo_path && (
                  <button
                    type="button"
                    onClick={() => setViewing(m.photo!)}
                    aria-label={t("game.peer.photo.view", { name: players.find((p) => p.user_id === m.userId)?.nickname ?? "?" })}
                    className="mt-2 block w-full max-w-[280px] overflow-hidden rounded-2xl bg-surface-2 transition active:scale-[0.98]"
                  >
                    {photoUrls[m.photo.photo_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrls[m.photo.photo_path]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <span className="grid aspect-[4/3] w-full animate-pulse place-items-center text-3xl">📷</span>
                    )}
                  </button>
                )}
                {m.extra && <div className="mt-1.5">{m.extra}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <BottomSheet
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? t("game.peer.photo.title", { name: players.find((p) => p.user_id === viewing.claimed_by)?.nickname ?? "?" }) : undefined}
      >
        {viewing?.photo_path && (
          <div className="space-y-3">
            <p className="font-extrabold">« {frenchSpacing(phraseText(viewing.phrase_id))} »</p>
            {photoUrls[viewing.photo_path] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrls[viewing.photo_path]} alt="" className="max-h-[65dvh] w-full rounded-2xl object-contain" />
            )}
            {renderReactions?.("claim", viewing.id)}
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
