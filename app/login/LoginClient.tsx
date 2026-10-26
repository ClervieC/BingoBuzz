"use client";

import type { AuthError, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { TermsCheckbox } from "@/components/TermsCheckbox";
import type { MessageKey } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signedOut" | "signedIn";
type Mode = "signIn" | "signUp" | "forgot";

export const MIN_PASSWORD_LENGTH = 6;

/** Erreurs Supabase Auth → messages lisibles. */
export function authErrorKey(error: AuthError): MessageKey {
  switch (error.code) {
    case "invalid_credentials":
      return "login.errors.invalid";
    case "email_not_confirmed":
      return "login.errors.notConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "login.errors.exists";
    case "weak_password":
      return "login.errors.weak";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "login.errors.rateLimit";
    default:
      return "login.error";
  }
}

export function LoginClient({
  callbackError,
  next,
  initialStatus = "loading",
  initialNotice = null,
}: {
  callbackError: boolean;
  next: string;
  /** état connu du serveur : évite d'afficher un squelette avant le formulaire */
  initialStatus?: Status;
  /** message d'information à l'arrivée (ex. compte supprimé) */
  initialNotice?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const ids = { email: useId(), password: useId() };
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [error, setError] = useState<string | null>(callbackError ? t("login.callbackError") : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // une ancienne session invité ne compte pas comme connectée
    const apply = (u: User | null) => {
      const real = u && !u.is_anonymous ? u : null;
      setUser(real);
      setStatus(real ? "signedIn" : "signedOut");
    };
    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  function callbackUrl(target = next) {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", target);
    return url.toString();
  }

  /** Après connexion : rechargement complet pour que le serveur lise les nouveaux cookies. */
  function goNext() {
    window.location.assign(next);
  }

  async function google() {
    // à l'inscription, la case doit être cochée (sinon l'accueil la redemandera)
    if (mode === "signUp" && !acceptTerms) {
      setTermsError(true);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (err) {
      setError(t("login.error"));
      setBusy(false);
    }
    // sinon : redirection vers Google
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const auth = getSupabaseBrowserClient().auth;

    if (mode === "signIn") {
      const { error: err } = await auth.signInWithPassword({ email: address, password });
      if (err) setError(t(authErrorKey(err)));
      else return goNext();
    } else if (mode === "signUp") {
      if (!acceptTerms) {
        setTermsError(true);
        setBusy(false);
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(t("login.errors.weak"));
        setBusy(false);
        return;
      }
      const { data, error: err } = await auth.signUp({
        email: address,
        password,
        options: {
          emailRedirectTo: callbackUrl(),
          // preuve d'acceptation des conditions (RGPD / CGU)
          data: { terms_accepted_at: new Date().toISOString(), terms_version: LEGAL.version },
        },
      });
      if (err) {
        setError(t(authErrorKey(err)));
      } else if (data.session) {
        // confirmation d'e-mail désactivée dans Supabase : déjà connecté
        return goNext();
      } else if (data.user && data.user.identities?.length === 0) {
        // Supabase masque les comptes existants : identities vide = e-mail déjà inscrit
        setError(t("login.errors.exists"));
        setMode("signIn");
      } else {
        setNotice(t("login.signUp.confirm", { email: address }));
        setPassword("");
        setMode("signIn");
      }
    } else {
      const { error: err } = await auth.resetPasswordForEmail(address, {
        redirectTo: callbackUrl("/reset-password"),
      });
      if (err) setError(t(authErrorKey(err)));
      else setNotice(t("login.forgot.sent", { email: address }));
    }
    setBusy(false);
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (status === "loading") {
    return <div className="card h-64 animate-pulse" aria-label={t("common.loading")} />;
  }

  if (status === "signedIn" && user) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="user" size={30} />
        </span>
        <p className="font-semibold break-all">{t("login.signedInAs", { email: user.email ?? "" })}</p>
        <button type="button" className="btn btn-ghost w-full" onClick={signOut}>
          <Icon name="logout" size={20} />
          {t("login.signOut")}
        </button>
      </div>
    );
  }

  const submitLabel =
    mode === "signIn" ? t("login.email.submit") : mode === "signUp" ? t("login.signUp.submit") : t("login.forgot.submit");

  return (
    <div className="space-y-5">
      {mode === "forgot" ? (
        <div>
          <h2 className="text-xl font-black">{t("login.forgot.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("login.forgot.body")}</p>
        </div>
      ) : null}

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      {notice && (
        <div role="status" className="card flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
          <Icon name="mail" className="mt-0.5 shrink-0 text-accent" />
          <p className="text-sm font-semibold">{notice}</p>
        </div>
      )}

      {mode !== "forgot" && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
            {(["signIn", "signUp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-[44px] rounded-xl font-bold transition ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
              >
                {m === "signIn" ? t("login.tab.signIn") : t("login.tab.signUp")}
              </button>
            ))}
          </div>

          {/* à l'inscription, l'acceptation vaut pour Google comme pour l'e-mail */}
          {mode === "signUp" && (
            <TermsCheckbox
              checked={acceptTerms}
              onChange={(v) => {
                setAcceptTerms(v);
                setTermsError(false);
              }}
              invalid={termsError}
            />
          )}

          <button type="button" className="btn btn-ghost w-full bg-surface" onClick={google} disabled={busy}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {t("login.google")}
          </button>

          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            {t("common.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor={ids.email} className="label">
            {t("login.email.label")}
          </label>
          <input
            id={ids.email}
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.email.placeholder")}
            autoComplete={mode === "signUp" ? "email" : "username"}
            inputMode="email"
            enterKeyHint={mode === "forgot" ? "send" : "next"}
            required
          />
        </div>

        {mode !== "forgot" && (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label htmlFor={ids.password} className="label mb-0">
                {mode === "signUp" ? t("login.password.new") : t("login.password.label")}
              </label>
              {mode === "signIn" && (
                <button
                  type="button"
                  className="min-h-[32px] text-sm font-semibold text-accent"
                  onClick={() => switchMode("forgot")}
                >
                  {t("login.forgot")}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id={ids.password}
                type={showPassword ? "text" : "password"}
                className="input pr-14"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                minLength={mode === "signUp" ? MIN_PASSWORD_LENGTH : undefined}
                enterKeyHint="go"
                required
                aria-describedby={mode === "signUp" ? `${ids.password}-hint` : undefined}
              />
              <button
                type="button"
                className="icon-btn absolute top-1/2 right-1 -translate-y-1/2 text-muted"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("login.password.hide") : t("login.password.show")}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
              </button>
            </div>
            {mode === "signUp" && (
              <p id={`${ids.password}-hint`} className="mt-1 text-sm text-muted">
                {t("login.password.hint")}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy || !email.trim() || (mode !== "forgot" && !password)}
        >
          {submitLabel}
        </button>
      </form>

      {mode === "forgot" && (
        <button
          type="button"
          className="mx-auto block min-h-[44px] text-sm font-semibold text-accent"
          onClick={() => switchMode("signIn")}
        >
          {t("login.backToSignIn")}
        </button>
      )}
    </div>
  );
}
