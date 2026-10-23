import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isValidCode, normalizeCode } from "@/lib/code";
import { fetchPublicGame } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabasePublicClient } from "@/lib/supabase/server";
import { GameClient } from "./GameClient";

type Props = { params: Promise<{ code: string }> };

// une seule requête pour generateMetadata + la page
const getGame = cache(async (raw: string) => {
  const code = normalizeCode(raw);
  if (!isValidCode(code)) return null;
  return fetchPublicGame(getSupabasePublicClient(), code);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ code }, { t }] = await Promise.all([params, getT()]);
  const game = await getGame(code).catch(() => null);
  if (!game) return { title: t("game.notFound"), robots: { index: false } };

  const title = `${game.theme.emoji} ${game.title}`;
  const description = t("game.share.text", { title: game.title, code: game.code });
  // l'image est fournie par ./opengraph-image.tsx (convention de fichier Next)
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title: t("game.join.title", { title: game.title }), description, url: `/play/${game.code}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PlayPage({ params }: Props) {
  const { code } = await params;
  const game = await getGame(code);
  if (!game) notFound();
  return <GameClient publicGame={game} />;
}
