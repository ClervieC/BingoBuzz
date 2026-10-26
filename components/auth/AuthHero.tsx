import { Icon, type IconName } from "@/components/Icon";
import type { MessageKey, Translator } from "@/lib/i18n";

const DEMO_CELLS: (MessageKey | null)[] = [
  "auth.demo.1",
  "auth.demo.2",
  "auth.demo.3",
  "auth.demo.4",
  null, // case libre
  "auth.demo.5",
  "auth.demo.6",
  "auth.demo.7",
  "auth.demo.8",
];
/** diagonale complète → BINGO */
const CHECKED = new Set([0, 4, 8, 3]);
const WIN = new Set([0, 4, 8]);

/**
 * Accroche de l'écran de connexion.
 * Mobile : titre seul, pour que le formulaire soit visible sans défiler.
 * Grand écran : étiquette, sous-titre et carte de démo en plus.
 */
export function AuthHero({ t }: { t: Translator }) {
  return (
    <section className="stagger text-center lg:text-left">
      <span className="chip mb-4 hidden lg:inline-flex">{t("auth.hero.kicker")}</span>
      <h1 className="text-[1.65rem] leading-[1.1] font-black tracking-tight text-balance sm:text-4xl lg:text-6xl lg:leading-[1.05]">
        {t("auth.hero.title")}
      </h1>
      <p className="mx-auto mt-4 hidden max-w-md text-lg text-muted lg:mx-0 lg:block">{t("auth.hero.subtitle")}</p>
      <div className="mt-8 hidden justify-center lg:flex lg:justify-start">
        <DemoCard t={t} />
      </div>
    </section>
  );
}

/** Arguments clés (sous le formulaire sur mobile, sous l'accroche sur grand écran). */
export function AuthPoints({ t }: { t: Translator }) {
  const points: { icon: IconName; key: MessageKey }[] = [
    { icon: "grid", key: "auth.hero.point1" },
    { icon: "users", key: "auth.hero.point2" },
    { icon: "link", key: "auth.hero.point3" },
  ];
  return (
    <ul className="space-y-3">
      {points.map(({ icon, key }) => (
        <li key={key} className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name={icon} size={20} />
          </span>
          <span className="font-semibold">{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Carte de bingo de démonstration, penchée, avec une diagonale gagnante. */
function DemoCard({ t }: { t: Translator }) {
  return (
    <div aria-hidden className="relative">
      {/* halo */}
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-violet-500/30 via-fuchsia-400/20 to-amber-300/30 blur-2xl" />
      <div className="animate-float relative w-64 rounded-3xl bg-surface p-3 shadow-2xl shadow-violet-900/20 sm:w-72">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-lg">💼</span>
          <span className="text-sm font-extrabold">{t("auth.demo.title")}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DEMO_CELLS.map((key, i) => (
            <div
              key={i}
              className={`relative grid aspect-square place-items-center overflow-hidden rounded-xl p-1 text-center text-[11px] leading-tight font-bold sm:text-xs ${
                key === null
                  ? "bg-accent text-accent-fg"
                  : CHECKED.has(i)
                    ? `bg-accent-soft ${WIN.has(i) ? "ring-2 ring-gold" : ""}`
                    : "border border-border bg-bg"
              }`}
            >
              {key !== null && CHECKED.has(i) && (
                <span
                  className="animate-stamp absolute inset-0 m-auto aspect-square w-[78%] rounded-full border-[3px] border-accent/45 bg-accent/10"
                  // les tampons tombent l’un après l’autre
                  style={{ animationDelay: `${600 + [...CHECKED].indexOf(i) * 280}ms` }}
                />
              )}
              <span className="relative">{key === null ? `★ ${t("grid.free")}` : t(key)}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="animate-sticker absolute -top-4 -right-5 rounded-2xl bg-gold px-3 py-1.5 text-lg font-black text-black shadow-lg">
        BINGO !
      </span>
    </div>
  );
}
