import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BoardTile } from "@/components/BoardTile";
import { HeaderNav } from "@/components/HeaderNav";
import { Icon } from "@/components/Icon";
import { fetchOwnBoards, fetchTemplates } from "@/lib/db";
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
  const [{ t }, user, templates] = await Promise.all([getT(), getServerUser(), fetchTemplates(supabase).catch(() => [])]);
  // le proxy garantit une session ; on reste prudent
  const boards = user ? await fetchOwnBoards(supabase, user.id).catch(() => []) : [];

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
