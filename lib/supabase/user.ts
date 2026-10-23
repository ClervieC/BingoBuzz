import "server-only";

import { getSupabaseServerClient } from "./server";

export interface ServerUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

/** Utilisateur courant côté serveur (JWT vérifié via getClaims), ou null. */
export async function getServerUser(): Promise<ServerUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" && claims.email ? claims.email : null,
    isAnonymous: Boolean(claims.is_anonymous),
  };
}
