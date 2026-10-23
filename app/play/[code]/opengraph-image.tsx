import { isValidCode, normalizeCode } from "@/lib/code";
import { fetchPublicGame } from "@/lib/db";
import { createTranslator, DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";
import { OG_SIZE, renderDefaultOg, renderGameOg } from "@/lib/og";
import { getSupabasePublicClient } from "@/lib/supabase/server";

export const alt = "BingoBuzz";
export const size = OG_SIZE;
export const contentType = "image/png";
// le nombre de joueurs évolue : image régénérée au plus toutes les 5 minutes
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  // les robots d'aperçu n'envoient pas nos cookies : langue par défaut
  const t = createTranslator(getDictionary(DEFAULT_LOCALE));
  const code = normalizeCode(raw);
  const game = isValidCode(code)
    ? await fetchPublicGame(getSupabasePublicClient(), code).catch(() => null)
    : null;

  if (!game) return renderDefaultOg({ tagline: t("app.tagline") });

  return renderGameOg({
    title: game.title,
    emoji: game.theme.emoji,
    color: game.theme.color,
    code: game.code,
    players: game.player_count,
    joinLabel: t("home.join.title"),
    playersLabel: t("game.join.players"),
  });
}
