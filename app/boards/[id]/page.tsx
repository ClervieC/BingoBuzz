import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import { fetchBoard } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";
import { themeStyle } from "@/lib/themes";
import { BoardActions } from "./BoardActions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const board = await fetchBoard(await getSupabaseServerClient(), id).catch(() => null);
  return { title: board ? `${board.theme.emoji} ${board.title}` : undefined, robots: { index: false } };
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const [{ t }, user, board] = await Promise.all([
    getT(),
    getServerUser(),
    getSupabaseServerClient().then((s) => fetchBoard(s, id)),
  ]);
  if (!board) notFound();

  const isOwner = Boolean(user && board.owner_id === user.id);

  return (
    <div className="themed min-h-dvh" style={themeStyle(board.theme)}>
      <AppHeader back="/library" backLabel={t("common.back")} />
      <main className="page pb-safe space-y-6 pt-4">
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-accent-soft text-4xl">
            {board.theme.emoji}
          </span>
          <div className="min-w-0 pt-1">
            {board.is_template && <span className="chip mb-1">{t("board.template")}</span>}
            <h1 className="text-2xl leading-tight font-extrabold break-words">{board.title}</h1>
            <p className="mt-1 text-muted">
              {t("board.summary", { count: board.phrases.length, size: board.grid_size })}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <Link href={`/solo/${board.id}`} className="card flex items-center gap-4 p-4 active:scale-[0.99]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon name="play" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{t("board.playSolo")}</span>
              <span className="block text-sm text-muted">{t("board.playSolo.hint")}</span>
            </span>
          </Link>

          <BoardActions
            boardId={board.id}
            title={board.title}
            isOwner={isOwner}
            isTemplate={board.is_template}
          />
        </div>

        <details className="card group p-4">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-bold">
            {t("board.phrasesList")} ({board.phrases.length})
            <Icon name="back" className="-rotate-90 transition group-open:rotate-90" />
          </summary>
          <ul className="mt-2 space-y-2">
            {board.phrases.map((p) => (
              <li key={p.id} className="rounded-xl bg-surface-2 px-3 py-2">
                {p.text}
              </li>
            ))}
          </ul>
        </details>
      </main>
    </div>
  );
}
