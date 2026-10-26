"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { TermsCheckbox } from "@/components/TermsCheckbox";
import { useToast } from "@/components/Toast";
import type { MessageKey } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Slide {
  emoji: string;
  title: MessageKey;
  body: MessageKey;
}

const SLIDES: Slide[] = [
  { emoji: "✍️", title: "welcome.1.title", body: "welcome.1.body" },
  { emoji: "📲", title: "welcome.2.title", body: "welcome.2.body" },
  { emoji: "🎉", title: "welcome.3.title", body: "welcome.3.body" },
];

/**
 * Accueil en 3 écrans (glissables) puis acceptation des conditions si elle
 * n'a pas encore eu lieu (connexion Google). Le résultat est stocké dans
 * user_metadata, que le proxy lit pour laisser passer.
 */
export function WelcomeClient({
  next,
  name,
  termsAccepted,
  termsVersion,
}: {
  next: string;
  name: string | null;
  termsAccepted: boolean;
  termsVersion: string;
}) {
  const t = useT();
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState(termsAccepted);
  const [showError, setShowError] = useState(false);
  const [busy, setBusy] = useState(false);

  // dernier écran : conditions (si besoin) sinon le 3e écran
  const total = SLIDES.length + (termsAccepted ? 0 : 1);
  const isLast = index === total - 1;

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  async function finish() {
    if (!accepted) {
      setShowError(true);
      return;
    }
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();
    const { error } = await supabase.auth.updateUser({
      data: {
        onboarded_at: now,
        terms_version: termsVersion,
        ...(termsAccepted ? {} : { terms_accepted_at: now }),
      },
    });
    if (error) {
      toast.show(t("errors.generic"), { tone: "error" });
      setBusy(false);
      return;
    }
    // le JWT doit contenir les nouvelles métadonnées avant que le proxy les relise
    await supabase.auth.refreshSession();
    window.location.assign(next);
  }

  return (
    <div className="flex min-h-dvh flex-col pt-safe pb-safe">
      <div className="page flex h-14 items-center justify-between">
        <span className="text-sm font-bold text-muted" aria-live="polite">
          {t("welcome.step", { n: index + 1, total })}
        </span>
        {!isLast && (
          <button type="button" className="min-h-[44px] px-2 font-bold text-muted" onClick={() => goTo(total - 1)}>
            {t("welcome.skip")}
          </button>
        )}
      </div>

      {/* Écrans glissables (scroll-snap) */}
      <div
        ref={trackRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {SLIDES.map((slide, i) => (
          <section
            key={slide.title}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6 text-center"
            aria-hidden={index !== i}
          >
            <div className="grid h-40 w-40 place-items-center rounded-[2.5rem] bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] text-7xl shadow-xl shadow-violet-900/25">
              {/* l’emoji rebondit à chaque fois que l’écran devient actif */}
              <span aria-hidden className={index === i ? "animate-bounce-in inline-block" : "inline-block opacity-0"}>
                {slide.emoji}
              </span>
            </div>
            {i === 0 && name && <p className="mt-8 font-semibold text-muted">{t("home.greeting", { name })}</p>}
            <h1 className={`${i === 0 && name ? "mt-1" : "mt-8"} text-3xl font-black tracking-tight text-balance`}>
              {t(slide.title)}
            </h1>
            <p className="mt-3 max-w-sm text-lg text-muted">{t(slide.body)}</p>
          </section>
        ))}

        {!termsAccepted && (
          <section
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6"
            aria-hidden={!isLast}
          >
            <div className="grid h-40 w-40 place-items-center rounded-[2.5rem] bg-accent-soft text-7xl">
              <span aria-hidden className={isLast ? "animate-bounce-in inline-block" : "inline-block opacity-0"}>
                🤝
              </span>
            </div>
            <h1 className="mt-8 text-center text-3xl font-black tracking-tight">{t("welcome.terms.title")}</h1>
            <p className="mt-3 max-w-sm text-center text-lg text-muted">{t("welcome.terms.body")}</p>
            <div className="card mt-6 w-full max-w-sm p-4">
              <TermsCheckbox
                checked={accepted}
                onChange={(v) => {
                  setAccepted(v);
                  setShowError(false);
                }}
                invalid={showError}
              />
            </div>
          </section>
        )}
      </div>

      <div className="page space-y-5 pt-4 pb-2">
        <div className="flex justify-center gap-2" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-accent" : "w-2 bg-border"}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary w-full text-lg"
          onClick={() => (isLast ? finish() : goTo(index + 1))}
          disabled={busy}
        >
          {isLast ? t("welcome.start") : t("welcome.next")}
        </button>
      </div>
    </div>
  );
}
