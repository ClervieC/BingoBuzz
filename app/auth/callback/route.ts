import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour de Google (OAuth) et des liens magiques. Gère le flux PKCE (`code`)
 * et les liens `token_hash` des modèles d'e-mail personnalisés, puis renvoie
 * vers la page demandée avant la connexion (`next`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const supabase = await getSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  if (!ok) {
    const failure = new URL("/", origin);
    failure.searchParams.set("error", "1");
    if (next !== "/") failure.searchParams.set("next", next);
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(new URL(next, origin));
}
