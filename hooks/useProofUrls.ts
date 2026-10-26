"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GameClaim } from "@/types/bingo";

const TTL_SECONDS = 60 * 60;

/**
 * Liens signés (bucket privé « proofs ») des photos de preuve des propositions.
 * Générés par lots, uniquement pour les chemins pas encore connus.
 */
export function useProofUrls(claims: GameClaim[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const missing = claims
    .map((c) => c.photo_path)
    .filter((path): path is string => Boolean(path) && !urls[path as string]);
  const key = [...new Set(missing)].sort().join("|");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getSupabaseBrowserClient()
      .storage.from("proofs")
      .createSignedUrls(key.split("|"), TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const item of data) if (item.path && item.signedUrl) next[item.path] = item.signedUrl;
        setUrls((prev) => ({ ...prev, ...next }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}
