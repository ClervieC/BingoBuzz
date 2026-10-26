import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

/**
 * Routes accessibles sans être connecté.
 * `/play/…` reste public pour que les robots d'aperçu (WhatsApp, Messenger)
 * lisent les métadonnées Open Graph ; la page demande ensuite de se connecter.
 */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/play/", "/privacy", "/terms"];

/** Routes accessibles à un compte qui n'a pas encore terminé l'accueil. */
const ONBOARDING_EXEMPT = ["/welcome", "/auth/", "/privacy", "/terms", "/login"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function isPublic(pathname: string): boolean {
  // l'accueil affiche lui-même l'écran de connexion quand on n'a pas de compte
  return pathname === "/" || matches(pathname, PUBLIC_PREFIXES);
}

/**
 * Rafraîchit le jeton Supabase à chaque requête, répercute les cookies, et :
 * - renvoie vers l'accueil (écran de connexion) quand la page exige un compte ;
 * - renvoie vers /welcome tant que l'accueil et les conditions ne sont pas validés.
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
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // une ancienne session invité ne compte pas comme un compte
  const signedIn = Boolean(claims?.sub) && !claims?.is_anonymous;

  const { pathname, search } = request.nextUrl;
  const redirectTo = (target: string) => {
    const destination = request.nextUrl.clone();
    destination.pathname = target;
    destination.search = "";
    if (pathname !== "/") destination.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(destination);
    // conserver les cookies éventuellement rafraîchis
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn) {
    return isPublic(pathname) ? response : redirectTo("/");
  }

  if (!hasCompletedOnboarding(claims?.user_metadata) && !matches(pathname, ONBOARDING_EXEMPT)) {
    return redirectTo("/welcome");
  }

  return response;
}
