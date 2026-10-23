import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BoardCard } from "@/components/BoardCard";
import { HeaderNav } from "@/components/HeaderNav";
import { Icon } from "@/components/Icon";
import { fetchOwnBoards, fetchTemplates } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("library.title"), robots: { index: false } };
}

export default async function LibraryPage() {
  const supabase = await getSupabaseServerClient();
  const [{ t, locale }, user, templates] = await Promise.all([
    getT(),
    getServerUser(),
    fetchTemplates(supabase).catch(() => []),
  ]);
  const boards = user ? await fetchOwnBoards(supabase, user.id) : [];
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} title={t("library.title")} actions={<HeaderNav />} />
      <main className="page pb-safe space-y-8 pt-4">
        {/* Compte : invité → proposer la conversion ; déconnecté → proposer la connexion */}
        {user?.isAnonymous && (
          <section className="card flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
            <Icon name="user" className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{t("library.guest.title")}</h2>
              <p className="text-sm text-muted">{t("library.guest.body")}</p>
              <Link href="/login" className="btn btn-primary btn-sm mt-3">
                {t("library.guest.cta")}
              </Link>
            </div>
          </section>
        )}
        {!user && (
          <section className="card p-4">
            <p className="text-muted">{t("library.signedOut")}</p>
            <Link href="/login" className="btn btn-primary btn-sm mt-3">
              {t("nav.login")}
            </Link>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t("library.title")}</h2>
            <Link href="/create" className="btn btn-secondary btn-sm">
              <Icon name="plus" size={20} />
              {t("home.create")}
            </Link>
          </div>
          {boards.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-muted">{t("library.empty")}</p>
              <Link href="/create" className="btn btn-primary mt-4">
                {t("library.empty.cta")}
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {boards.map((board) => (
                <BoardCard key={board.id} board={board} subtitle={dateFormat.format(new Date(board.updated_at))} />
              ))}
            </div>
          )}
        </section>

        {templates.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">{t("library.templates")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
