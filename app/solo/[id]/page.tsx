import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchBoard } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SoloClient } from "./SoloClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const board = await fetchBoard(await getSupabaseServerClient(), id).catch(() => null);
  return { title: board ? `${board.theme.emoji} ${board.title}` : undefined, robots: { index: false } };
}

export default async function SoloPage({ params }: Props) {
  const { id } = await params;
  const board = await fetchBoard(await getSupabaseServerClient(), id);
  if (!board) notFound();
  return <SoloClient board={board} />;
}
