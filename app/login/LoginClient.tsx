"use client";

import type { AuthError, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signedOut" | "anonymous" | "signedIn";

function isEmailExists(error: AuthError | null): boolean {
  return Boolean(error && (error.code === "email_exists" || /already (been )?registered/i.test(error.message)));
}

export function LoginClient({
  callbackError,
  upgraded,
  next,
}: {
  callbackError: boolean;
  upgraded: boolean;
  next: string;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const emailId = useId();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [useExisting, setUseExisting] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(callbackError ? t("login.callbackError") : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const apply = (u: User | null) => {
      setUser(u);
      setStatus(!u ? "signedOut" : u.is_anonymous ? "anonymous" : "signedIn");
    };
    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (upgraded) toast.show(t("login.upgraded"), { tone: "success" });
  }, [upgraded, toast, t]);

  // conversion d'un compte invité, sauf si l'utilisateur veut rejoindre un compte existant
  const upgrading = status === "anonymous" && !useExisting;

  function callbackUrl(extra?: Record<string, string>) {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    return url.toString();
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    if (upgrading) {
      // Le compte anonyme garde son id : ses bingos et parties sont conservés
      const { error: err } = await supabase.auth.updateUser(
        { email: address },
        { emailRedirectTo: callbackUrl({ upgraded: "1" }) },
      );
      if (isEmailExists(err)) {
        setError(t("login.emailExists"));
        setUseExisting(true);
      } else if (err) {
        setError(t("login.error"));
      } else {
        setSentTo(address);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
      });
      if (err) setError(t("login.error"));
      else setSentTo(address);
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = upgrading
      ? await supabase.auth.linkIdentity({
          provider: "google",
          options: { redirectTo: callbackUrl({ upgraded: "1" }) },
        })
      : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (err) {
      setError(t("login.error"));
      setBusy(false);
    }
    // sinon : redirection vers Google
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">{upgrading ? t("login.upgrade.title") : t("login.title")}</h1>
        <p className="mt-1 text-muted">{upgrading ? t("login.upgrade.subtitle") : t("login.subtitle")}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {sentTo ? (
        <div className="card flex items-start gap-3 p-5" role="status">
          <Icon name="mail" className="mt-0.5 shrink-0 text-accent" />
          <p className="font-semibold">
            {upgrading ? t("login.email.upgradeSent", { email: sentTo }) : t("login.email.sent", { email: sentTo })}
          </p>
        </div>
      ) : (
        <>
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

          <form onSubmit={submitEmail} className="space-y-3">
            <label htmlFor={emailId} className="label">
              {t("login.email.label")}
            </label>
            <input
              id={emailId}
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.email.placeholder")}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="send"
              required
            />
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !email.trim()}>
              {upgrading ? t("login.email.upgradeSubmit") : t("login.email.submit")}
            </button>
          </form>
        </>
      )}

      {status === "anonymous" && !sentTo && (
        <button
          type="button"
          className="mx-auto block min-h-[44px] text-sm font-semibold text-accent underline underline-offset-4"
          onClick={() => {
            setUseExisting((v) => !v);
            setError(null);
          }}
        >
          {useExisting ? t("login.upgrade.title") : t("login.useExisting")}
        </button>
      )}
    </div>
  );
}
