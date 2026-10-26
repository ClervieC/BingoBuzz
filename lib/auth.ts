"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** URL de l'écran de connexion (l'accueil), avec retour vers la page courante. */
export function loginUrl(next?: string): string {
  const target = next ?? `${window.location.pathname}${window.location.search}`;
  return target === "/" ? "/" : `/?next=${encodeURIComponent(target)}`;
}

/**
 * Renvoie l'utilisateur connecté. La connexion est obligatoire : sans compte
 * (ou avec une ancienne session invité), on part sur l'accueil et la promesse ne
 * se résout jamais (pas de message d'erreur pendant la redirection).
 */
export async function requireUser(): Promise<User> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const user = data.session?.user;
  if (user && !user.is_anonymous) return user;

  window.location.assign(loginUrl());
  return new Promise<User>(() => {});
}
