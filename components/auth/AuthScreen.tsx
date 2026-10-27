import Link from "next/link";
import { LoginClient } from "@/app/login/LoginClient";
import { Logo } from "@/components/Logo";
import { CompactPreferences } from "@/components/PreferenceControls";
import type { Translator } from "@/lib/i18n";
import { AuthHero, AuthPoints } from "./AuthHero";
import { AuthShowcase } from "./AuthShowcase";

/**
 * Écran d'accueil sans compte : accroche + connexion / inscription.
 * Mobile : accroche, formulaire, arguments. Grand écran : formulaire à droite.
 */
export function AuthScreen({
  t,
  next,
  callbackError,
  notice,
}: {
  t: Translator;
  next: string;
  callbackError: boolean;
  notice: string | null;
}) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <header className="pt-safe">
        <div className="page flex h-16 items-center justify-between lg:max-w-6xl">
          <Logo size={38} priority />

          <CompactPreferences />
        </div>
      </header>

      <main className="page grid flex-1 content-start gap-9 pt-6 pb-8 lg:max-w-6xl lg:content-normal lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16 lg:pt-12">
        <AuthHero t={t} />

        <div className="lg:sticky lg:top-8 lg:row-span-2">
          <div className="card p-4 shadow-xl shadow-violet-900/10 sm:p-6">
            <LoginClient
              callbackError={callbackError}
              next={next}
              initialStatus="signedOut"
              initialNotice={notice}
            />
          </div>
        </div>

        {/* arguments : seulement sur grand écran, à côté du formulaire */}
        <div className="hidden lg:-mt-4 lg:block">
          <AuthPoints t={t} />
        </div>
      </main>

      {/* sous le formulaire : on découvre le jeu en faisant défiler */}
      <div className="border-t border-border/70 bg-surface/40">
        <AuthShowcase t={t} />
      </div>

      <footer className="pb-safe border-t border-border/70">
        <div className="page flex flex-col items-center gap-2 py-5 text-sm text-muted sm:flex-row sm:justify-between lg:max-w-6xl">
          <span>{t("auth.footer.made")}</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="min-h-[44px] content-center underline-offset-2 hover:underline">
              {t("legal.privacy")}
            </Link>
            <Link href="/terms" className="min-h-[44px] content-center underline-offset-2 hover:underline">
              {t("legal.terms")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
