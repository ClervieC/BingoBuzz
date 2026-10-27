import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HeaderNav } from "@/components/HeaderNav";
import { computeBadges } from "@/lib/badges";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";
import type { PlayerStats } from "@/types/bingo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.title"), robots: { index: false } };
}

export default async function ProfilePage() {
  const [{ t, locale }, user] = await Promise.all([getT(), getServerUser()]);
  if (!user || user.isAnonymous) redirect("/");

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("get_my_stats");
  const stats = data as PlayerStats | null;
  const badges = stats ? computeBadges(stats) : [];
  const earned = badges.filter((b) => b.value >= b.goal).length;
  const since = stats?.since
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(stats.since))
    : null;

  const tiles = stats
    ? [
        { emoji: "🎟️", value: stats.games_played, label: t("profile.stats.games") },
        { emoji: "🎉", value: stats.bingos, label: t("profile.stats.bingos") },
        { emoji: "🏆", value: stats.wins, label: t("profile.stats.wins") },
        { emoji: "✅", value: stats.cells_checked, label: t("profile.stats.cells") },
        { emoji: "🎤", value: stats.hosted, label: t("profile.stats.hosted") },
        { emoji: "🤝", value: stats.friends, label: t("profile.stats.friends") },
      ]
    : [];

  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} actions={<HeaderNav />} />
      <main className="page pb-safe stagger space-y-7 pt-5 pb-12">
        <section className="flex items-center gap-4">
          <span className="animate-bounce-in grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-2xl font-black text-accent-fg">
            {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[1.6rem] leading-tight font-black">{user.name ?? t("profile.title")}</h1>
            {since && <p className="text-sm font-semibold text-muted">{t("profile.since", { date: since })}</p>}
          </div>
        </section>

        {stats ? (
          <>
            <section>
              <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted uppercase">{t("profile.stats")}</h2>
              <ul className="grid grid-cols-3 gap-2">
                {tiles.map((tile) => (
                  <li key={tile.label} className="card flex flex-col items-center p-3 text-center">
                    <span aria-hidden className="text-2xl">
                      {tile.emoji}
                    </span>
                    <span className="animate-pop text-xl font-black tabular-nums">{tile.value}</span>
                    <span className="text-xs leading-tight font-semibold text-muted">{tile.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted uppercase">
                {t("profile.badges", { count: earned, total: badges.length })}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {badges.map((badge) => {
                  const done = badge.value >= badge.goal;
                  return (
                    <li
                      key={badge.id}
                      className={`card flex flex-col items-center gap-1 p-3 text-center ${done ? "border-gold bg-gold/10" : ""}`}
                    >
                      <span aria-hidden className={`text-3xl ${done ? "animate-bounce-in" : "opacity-35 grayscale"}`}>
                        {badge.emoji}
                      </span>
                      <span className="text-sm font-extrabold">{t(badge.name)}</span>
                      <span className="text-xs leading-tight text-muted">{t(badge.hint, { goal: badge.goal })}</span>
                      {!done && (
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.min(100, (badge.value / badge.goal) * 100)}%` }}
                          />
                        </span>
                      )}
                      <span className="sr-only">
                        {done ? t("profile.badge.earned") : `${badge.value}/${badge.goal}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        ) : (
          <p className="card p-6 text-center text-muted">{t("errors.generic")}</p>
        )}
      </main>
    </>
  );
}
