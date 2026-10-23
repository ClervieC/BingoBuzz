import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour des liens magiques, de la confirmation d'e-mail (conversion d'un
 * compte invité) et d'OAuth Google. Gère le flux PKCE (`code`) et les liens
 * `token_hash` des modèles d'e-mail personnalisés.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get("next") ?? "/library";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/library";
  const upgraded = searchParams.get("upgraded") === "1";

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
    return NextResponse.redirect(new URL("/login?error=1", origin));
  }

  const destination = new URL(upgraded ? "/login?upgraded=1" : next, origin);
  return NextResponse.redirect(destination);
}
