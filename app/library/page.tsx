import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BoardTile } from "@/components/BoardTile";
import { HeaderNav } from "@/components/HeaderNav";
import { Icon } from "@/components/Icon";
import { fetchFinishedGames, fetchOwnBoards, fetchTemplates } from "@/lib/db";
import { themeStyle } from "@/lib/themes";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";
import { LibraryGrid } from "./LibraryGrid";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("library.title"), robots: { index: false } };
}

export default async function LibraryPage() {
  const supabase = await getSupabaseServerClient();
  const [{ t, locale }, user] = await Promise.all([getT(), getServerUser()]);
  // le proxy garantit une session ; on reste prudent
  const [templates, boards, history] = await Promise.all([
    fetchTemplates(supabase, locale).catch(() => []),
    user ? fetchOwnBoards(supabase, user.id).catch(() => []) : [],
    user ? fetchFinishedGames(supabase, user.id).catch(() => []) : [],
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} actions={<HeaderNav />} />
      <main className="page pb-safe stagger space-y-8 pt-5 pb-12">
        <section>
          <h1 className="text-[1.75rem] leading-tight font-black tracking-tight">{t("library.title")}</h1>
          <p className="mt-1 font-semibold text-muted">
            {boards.length > 0 ? t("library.subtitle", { count: boards.length }) : t("library.subtitleEmpty")}
          </p>
        </section>

        {boards.length === 0 ? (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] p-6 text-center text-white shadow-lg shadow-violet-900/20">
            <div aria-hidden className="mx-auto mb-4 flex w-fit -space-x-3">
              {["💼", "💍", "🎄"].map((e, i) => (
                <span
                  key={e}
                  className="animate-bounce-in grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-3xl backdrop-blur"
                  style={{ animationDelay: `${150 + i * 120}ms`, rotate: `${(i - 1) * 10}deg` }}
                >
                  {e}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-black">{t("library.empty.title")}</h2>
            <p className="mt-1 text-white/80">{t("library.empty")}</p>
            <Link href="/create" className="btn mt-5 bg-white text-[#4c1d95]">
              <Icon name="plus" size={20} />
              {t("library.empty.cta")}
            </Link>
          </section>
        ) : (
          <LibraryGrid boards={boards} />
        )}

        {history.length > 0 && (
          <section>
            <h2 className="text-lg font-extrabold">{t("library.history")}</h2>
            <p className="mb-3 text-sm text-muted">{t("library.history.hint")}</p>
            <ul className="stagger space-y-2">
              {history.map((game) => (
                <li key={game.code}>
                  <Link
                    href={`/play/${game.code}`}
                    className="card lift flex min-h-[64px] items-center gap-3 p-3 transition active:scale-[0.99]"
                  >
                    <span
                      aria-hidden
                      className="themed grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl"
                      style={themeStyle(game.theme)}
                    >
                      {game.theme.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{game.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {game.winners.length > 0
                          ? t("library.history.winner", { names: game.winners.join(", ") })
                          : t("library.history.noWinner")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      <span className="block">{dateFormat.format(new Date(game.endedAt))}</span>
                      {game.me && (
                        <span className="block font-bold text-fg tabular-nums">
                          {t("library.history.you", { count: game.me.count, total: game.me.total })}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {templates.length > 0 && (
          <section>
            <h2 className="text-lg font-extrabold">{t("library.templates")}</h2>
            <p className="mb-3 text-sm text-muted">{t("library.templates.hint")}</p>
            <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>li:last-child:nth-child(odd)]:col-span-2">
              {templates.map((board) => (
                <li key={board.id}>
                  <BoardTile board={board} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
