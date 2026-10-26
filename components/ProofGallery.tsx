"use client";

import { useState } from "react";
import { useProofUrls } from "@/hooks/useProofUrls";
import { frenchSpacing } from "@/lib/phrases";
import type { GameClaim, GamePlayer } from "@/types/bingo";
import { BottomSheet } from "./BottomSheet";
import { useT } from "./I18nProvider";

/** Galerie des photos de preuve de la partie (confirmées et en attente). */
export function ProofGallery({
  claims,
  players,
  phraseText,
}: {
  claims: GameClaim[];
  players: GamePlayer[];
  phraseText: (phraseId: string) => string;
}) {
  const t = useT();
  const photos = claims.filter((c) => c.photo_path && c.status !== "rejected");
  const urls = useProofUrls(photos);
  const [viewing, setViewing] = useState<GameClaim | null>(null);
  const nameOf = (uid: string) => players.find((p) => p.user_id === uid)?.nickname ?? "?";

  return (
    <section>
      <h2 className="text-lg font-extrabold">📸 {t("game.photos.title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("game.photos.hint")}</p>

      {photos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-4xl" aria-hidden>
            📷
          </p>
          <p className="mt-2 text-muted">{t("game.photos.empty")}</p>
        </div>
      ) : (
        <ul className="stagger grid grid-cols-2 gap-3">
          {photos.map((claim) => {
            const url = claim.photo_path ? urls[claim.photo_path] : undefined;
            return (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => setViewing(claim)}
                  className="lift block w-full overflow-hidden rounded-2xl border border-border bg-surface text-left transition active:scale-[0.97]"
                >
                  <span className="relative block aspect-square bg-surface-2">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-full w-full animate-pulse place-items-center text-3xl">📷</span>
                    )}
                    <span
                      className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-black ${
                        claim.status === "confirmed" ? "bg-success text-on-status" : "bg-surface/90 text-fg"
                      }`}
                    >
                      {claim.status === "confirmed" ? `✓ ${t("game.photos.confirmed")}` : `⏳ ${t("game.photos.pending")}`}
                    </span>
                  </span>
                  <span className="block p-2.5">
                    <span className="line-clamp-2 text-sm leading-tight font-bold">
                      {frenchSpacing(phraseText(claim.phrase_id))}
                    </span>
                    <span className="mt-1 block text-xs text-muted">{t("game.photos.by", { name: nameOf(claim.claimed_by) })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? t("game.peer.photo.title", { name: nameOf(viewing.claimed_by) }) : undefined}
      >
        {viewing?.photo_path && (
          <div className="space-y-3">
            <p className="font-extrabold">« {frenchSpacing(phraseText(viewing.phrase_id))} »</p>
            {urls[viewing.photo_path] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[viewing.photo_path]}
                alt={t("game.peer.photo.title", { name: nameOf(viewing.claimed_by) })}
                className="max-h-[65dvh] w-full rounded-2xl object-contain"
              />
            )}
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
