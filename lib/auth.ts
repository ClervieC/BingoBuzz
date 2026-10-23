"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let pending: Promise<User> | null = null;

/**
 * Renvoie l'utilisateur courant, en créant une session anonyme si besoin.
 * Appelé seulement quand une action en a besoin (créer un bingo, rejoindre
 * une partie) : un robot qui génère l'aperçu d'un lien ne crée pas de compte.
 */
export function ensureSession(): Promise<User> {
  if (!pending) {
    pending = (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;

      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (error || !anon.user) throw error ?? new Error("not_authenticated");
      return anon.user;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function isAnonymous(user: Pick<User, "is_anonymous"> | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}
