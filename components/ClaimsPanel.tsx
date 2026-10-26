"use client";

import { useState, type ReactNode } from "react";
import { useProofUrls } from "@/hooks/useProofUrls";
import { frenchSpacing } from "@/lib/phrases";
import { BottomSheet } from "./BottomSheet";
import type { GameClaim, GamePlayer } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

/**
 * Mode « validé par le groupe » : propositions des autres à confirmer ou
 * contester, et rappel de ses propres propositions en attente.
 */
export function ClaimsPanel({
  claims,
  players,
  userId,
  phraseText,
  onResolve,
  onCancel,
  showEmpty = false,
  renderReactions,
}: {
  claims: GameClaim[];
  players: GamePlayer[];
  userId: string | null;
  phraseText: (phraseId: string) => string;
  onResolve: (claimId: string, accept: boolean) => void;
  /** annuler sa propre proposition (supprime aussi la photo) */
  onCancel: (claim: GameClaim) => void;
  showEmpty?: boolean;
  renderReactions?: (claim: GameClaim) => ReactNode;
}) {
  const t = useT();
  const photoUrls = useProofUrls(claims);
  const [viewing, setViewing] = useState<GameClaim | null>(null);
  const pending = claims.filter((c) => c.status === "pending");
  const toConfirm = pending.filter((c) => c.claimed_by !== userId);
  const mine = pending.filter((c) => c.claimed_by === userId);
  const nameOf = (uid: string) => players.find((p) => p.user_id === uid)?.nickname ?? "?";

  if (toConfirm.length === 0 && mine.length === 0) {
    return showEmpty ? <p className="card p-4 text-center text-sm text-muted">{t("game.peer.empty")}</p> : null;
  }

  return (
    <section className="space-y-3" aria-live="polite">
      {toConfirm.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-black tracking-wide text-accent uppercase">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            {t("game.peer.toConfirm")} ({toConfirm.length})
          </h2>
          <ul className="space-y-2">
            {toConfirm.map((claim) => (
              <li key={claim.id} className="animate-rise card border-accent/40 p-3 shadow-md shadow-violet-900/10">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-muted">{t("game.peer.saw", { name: nameOf(claim.claimed_by) })}</p>
                    <p className="mt-0.5 font-extrabold">« {frenchSpacing(phraseText(claim.phrase_id))} »</p>
                  </div>
                  {claim.photo_path && (
                    <button
                      type="button"
                      onClick={() => setViewing(claim)}
                      aria-label={t("game.peer.photo.view", { name: nameOf(claim.claimed_by) })}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-2 ring-accent/40"
                    >
                      {photoUrls[claim.photo_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrls[claim.photo_path]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full animate-pulse place-items-center text-xl">📷</span>
                      )}
                    </button>
                  )}
                </div>
                {renderReactions && <div className="mt-2">{renderReactions(claim)}</div>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-sm bg-success text-on-status" onClick={() => onResolve(claim.id, true)}>
                    <Icon name="check" size={18} strokeWidth={3} />
                    {t("game.peer.confirm")}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => onResolve(claim.id, false)}>
                    <Icon name="close" size={18} />
                    {t("game.peer.reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mine.length > 0 && (
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="mb-1 text-xs font-bold text-muted">⏳ {t("game.peer.ownList")}</p>
          <ul className="space-y-1">
            {mine.map((claim) => (
              <li key={claim.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {claim.photo_path && <span aria-hidden>📷 </span>}
                  {frenchSpacing(phraseText(claim.phrase_id))}
                </span>
                <button
                  type="button"
                  className="min-h-[36px] shrink-0 px-2 text-xs font-bold text-muted underline"
                  onClick={() => onCancel(claim)}
                >
                  {t("game.peer.cancel")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BottomSheet
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? t("game.peer.photo.title", { name: nameOf(viewing.claimed_by) }) : undefined}
      >
        {viewing?.photo_path && (
          <div className="space-y-3">
            <p className="font-extrabold">« {frenchSpacing(phraseText(viewing.phrase_id))} »</p>
            {photoUrls[viewing.photo_path] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrls[viewing.photo_path]}
                alt={t("game.peer.photo.title", { name: nameOf(viewing.claimed_by) })}
                className="max-h-[60dvh] w-full rounded-2xl object-contain"
              />
            )}
            {viewing.claimed_by !== userId && viewing.status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn btn-sm bg-success text-on-status"
                  onClick={() => {
                    onResolve(viewing.id, true);
                    setViewing(null);
                  }}
                >
                  <Icon name="check" size={18} strokeWidth={3} />
                  {t("game.peer.confirm")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    onResolve(viewing.id, false);
                    setViewing(null);
                  }}
                >
                  <Icon name="close" size={18} />
                  {t("game.peer.reject")}
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
