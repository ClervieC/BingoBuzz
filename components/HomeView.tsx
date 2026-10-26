import Link from "next/link";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { HeaderNav } from "@/components/HeaderNav";
import { BoardTile } from "@/components/BoardTile";
import { Icon } from "@/components/Icon";
import { JoinCodeForm } from "@/components/JoinCodeForm";
import type { ActiveGame } from "@/lib/db";
import type { Translator } from "@/lib/i18n";
import { themeStyle } from "@/lib/themes";
import type { Board } from "@/types/bingo";

/** Accueil d'un utilisateur connecté. */
export function HomeView({
  t,
  name,
  mine,
  templates,
  active = [],
  nav = <HeaderNav />,
}: {
  t: Translator;
  name: string | null;
  mine: Board[];
  templates: Board[];
  /** parties en cours (une partie peut durer plusieurs jours) */
  active?: ActiveGame[];
  /** actions de l'en-tête (HeaderNav par défaut) */
  nav?: ReactNode;
}) {
  return (
    <>
      <AppHeader actions={nav} />
      <main className="page pb-safe stagger space-y-8 pt-5 pb-10">
        {/* Accueil personnalisé */}
        <section>
          <p className="font-semibold text-muted">
            {name ? t("home.greeting", { name }) : t("home.greetingAnon")}
          </p>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-black tracking-tight text-balance">
            {t("home.headline")}
          </h1>
        </section>

        {/* Parties en cours : on y revient en un toucher */}
        {active.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              {t("home.active")}
            </h2>
            <ul className="stagger space-y-2">
              {active.map((game) => (
                <li key={game.code}>
                  <ActiveGameCard game={game} t={t} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions principales */}
        <section className="grid gap-3">
          <Link
            href="/create"
            className="group lift relative flex min-h-[132px] items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] p-5 text-white shadow-lg shadow-violet-900/20 transition active:scale-[0.98]"
          >
            <div className="min-w-0 flex-1">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20">
                <Icon name="plus" />
              </span>
              <span className="mt-3 block text-xl font-black">{t("home.create")}</span>
              <span className="mt-0.5 block text-sm text-white/80">{t("home.create.hint")}</span>
            </div>
            <MiniGrid />
          </Link>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name="users" size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="font-extrabold">{t("home.join.title")}</h2>
                <p className="text-sm text-muted">{t("home.join.hint")}</p>
              </div>
            </div>
            <JoinCodeForm />
          </div>
        </section>

        {/* Mes bingos : reprise rapide */}
        {mine.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">{t("home.mine")}</h2>
              <Link href="/library" className="-my-2 py-2 text-sm font-bold text-accent">
                {t("home.seeAll")}
              </Link>
            </div>
            <ul className="stagger -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2">
              {mine.slice(0, 10).map((board) => (
                <li key={board.id} className="w-40 shrink-0 snap-start">
                  <BoardTile board={board} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Modèles */}
        {templates.length > 0 && (
          <section>
            <h2 className="text-lg font-extrabold">{t("home.templates")}</h2>
            <p className="mb-3 text-sm text-muted">{t("home.templates.hint")}</p>
            {/* sur mobile, une tuile seule en fin de liste prend toute la largeur */}
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

/** Carte d’une partie en cours : progression du joueur, accès direct. */
function ActiveGameCard({ game, t }: { game: ActiveGame; t: Translator }) {
  const progress = game.me ? game.me.count / game.me.total : 0;
  return (
    <Link
      href={`/play/${game.code}`}
      aria-label={t("home.active.resume", { title: game.title })}
      className="themed wiggle-parent lift flex items-center gap-3 rounded-3xl border border-border bg-surface p-3 transition active:scale-[0.98]"
      style={themeStyle(game.theme)}
    >
      <span aria-hidden className="wiggle grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-3xl">
        {game.theme.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">{game.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold">
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono tracking-widest">{game.code}</span>
          {game.isHost && <span className="text-accent">{t("home.active.host")}</span>}
          {game.lobby ? (
            <span className="text-accent">✍️ {t("home.active.lobby")}</span>
          ) : game.me?.hasBingo ? (
            <span className="text-gold">BINGO 🎉</span>
          ) : game.me?.missing === 1 ? (
            <span className="animate-pulse text-accent">{t("game.ranking.oneLeft")}</span>
          ) : game.me ? (
            <span className="text-muted">{t("home.active.progress", { count: game.me.count, total: game.me.total })}</span>
          ) : (
            <span className="text-muted">{t("home.active.watching")}</span>
          )}
        </span>
        {game.me && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </span>
      <Icon name="back" className="shrink-0 rotate-180 text-muted" />
    </Link>
  );
}

/** Petite grille décorative avec une diagonale « cochée ». */
function MiniGrid() {
  return (
    <div aria-hidden className="grid shrink-0 rotate-6 grid-cols-3 gap-1.5 transition group-active:rotate-0">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`h-7 w-7 rounded-lg bg-white/25 ${[0, 4, 8].includes(i) ? "animate-light-up" : ""}`}
          // la diagonale s’allume case par case, en boucle
          style={[0, 4, 8].includes(i) ? { animationDelay: `${[0, 4, 8].indexOf(i) * 350}ms` } : undefined}
        />
      ))}
    </div>
  );
}
