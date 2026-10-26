import "server-only";

import { getSupabaseServerClient } from "./server";

export interface ServerUser {
  id: string;
  email: string | null;
  /** prénom affichable : nom Google, sinon début de l'e-mail */
  name: string | null;
  isAnonymous: boolean;
  /** user_metadata du JWT (acceptation des conditions, onboarding…) */
  metadata: Record<string, unknown>;
}

function displayName(metadata: unknown, email: string | null): string | null {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const full = [meta.given_name, meta.full_name, meta.name].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  if (full) return full.trim().split(/\s+/)[0];
  if (!email) return null;
  const local = email.split("@")[0].split(/[._+-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : null;
}

/** Utilisateur courant côté serveur (JWT vérifié via getClaims), ou null. */
export async function getServerUser(): Promise<ServerUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const email = typeof claims.email === "string" && claims.email ? claims.email : null;
  return {
    id: claims.sub,
    email,
    name: displayName(claims.user_metadata, email),
    isAnonymous: Boolean(claims.is_anonymous),
    metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
  };
}
