import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

/** Client Supabase pour Server Components, Server Actions et route handlers (session de l'utilisateur). */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le proxy (proxy.ts) se charge de rafraîchir la session.
        }
      },
    },
  });
}

/**
 * Client sans session (rôle `anon`), pour les données publiques : images
 * Open Graph, métadonnées. N'écrit aucun cookie, donc utilisable partout.
 */
export function getSupabasePublicClient() {
  const { url, anonKey } = supabaseEnv();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
