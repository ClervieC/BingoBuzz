import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

/**
 * Rafraîchit le jeton Supabase à chaque requête et répercute les cookies
 * sur la requête (pour les Server Components) et la réponse (pour le navigateur).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Ne rien intercaler entre createServerClient et getClaims : getClaims
  // valide le JWT et déclenche le rafraîchissement si nécessaire.
  await supabase.auth.getClaims();

  return response;
}
