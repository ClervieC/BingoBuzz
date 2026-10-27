import type { Translator } from "@/lib/i18n";
import { DemoGrid } from "./DemoGrid";

/** Sous le formulaire de connexion : démonstration et « comment ça marche ». */
export function AuthShowcase({ t }: { t: Translator }) {
  const steps = [
    { emoji: "✍️", title: t("landing.step1"), body: t("landing.step1.body") },
    { emoji: "🔗", title: t("landing.step2"), body: t("landing.step2.body") },
    { emoji: "🎉", title: t("landing.step3"), body: t("landing.step3.body") },
  ];
  const phrases = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => t(`landing.demo.${n}` as Parameters<Translator>[0]));
  const ideas = ["💼", "💍", "🎄", "⚽", "📺", "🎂", "🗳️", "✈️"];

  return (
    <section className="page grid gap-10 py-12 lg:max-w-6xl lg:grid-cols-2 lg:items-center" aria-labelledby="landing-title">
      <div className="space-y-6">
        <h2 id="landing-title" className="text-2xl leading-tight font-black text-balance sm:text-3xl">
          {t("landing.title")}
        </h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl" aria-hidden>
                {s.emoji}
              </span>
              <div>
                <p className="font-extrabold">
                  <span className="text-accent">{i + 1}.</span> {s.title}
                </p>
                <p className="text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <p className="mb-2 text-sm font-bold text-muted">{t("landing.ideas")}</p>
          <p className="flex flex-wrap gap-2 text-2xl" aria-hidden>
            {ideas.map((e) => (
              <span key={e} className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2">
                {e}
              </span>
            ))}
          </p>
        </div>
      </div>
      <DemoGrid phrases={phrases} bingoLabel="BINGO" />
    </section>
  );
}
