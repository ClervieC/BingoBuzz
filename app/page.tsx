import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BoardCard } from "@/components/BoardCard";
import { HeaderNav } from "@/components/HeaderNav";
import { Icon } from "@/components/Icon";
import { JoinCodeForm } from "@/components/JoinCodeForm";
import { fetchTemplates } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const [{ t }, templates] = await Promise.all([
    getT(),
    getSupabaseServerClient()
      .then(fetchTemplates)
      .catch(() => []),
  ]);

  return (
    <>
      <AppHeader actions={<HeaderNav />} />
      <main className="page pb-safe space-y-10 pt-6">
        <section className="space-y-5">
          <div className="grid w-fit grid-cols-3 gap-1" aria-hidden>
            {["💬", "⏰", "☔", "🎤", "★", "🙃", "📞", "🍰", "🎉"].map((e, i) => (
              <span
                key={e}
                className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${
                  [0, 4, 8].includes(i) ? "bg-accent text-accent-fg" : "bg-surface"
                }`}
              >
                {e}
              </span>
            ))}
          </div>
          <h1 className="text-[2rem] leading-[1.1] font-black tracking-tight text-balance">{t("home.title")}</h1>
          <p className="text-lg text-muted">{t("home.subtitle")}</p>
          <Link href="/create" className="btn btn-primary w-full text-lg sm:w-auto">
            <Icon name="plus" />
            {t("home.create")}
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-lg font-extrabold">{t("home.join.title")}</h2>
          <JoinCodeForm />
        </section>

        {templates.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">{t("home.templates")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-extrabold">{t("home.how.title")}</h2>
          <ol className="space-y-3">
            {(["home.how.1", "home.how.2", "home.how.3"] as const).map((key, i) => (
              <li key={key} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-black text-accent">
                  {i + 1}
                </span>
                <span className="pt-1">{t(key)}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
