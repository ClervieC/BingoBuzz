"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorKey, MIN_PASSWORD_LENGTH } from "../login/LoginClient";

export function ResetPasswordClient() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("login.errors.weak"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (err) {
      setError(t(authErrorKey(err)));
      setBusy(false);
      return;
    }
    toast.show(t("reset.done"), { tone: "success" });
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div>
        <label htmlFor={id} className="label">
          {t("login.password.new")}
        </label>
        <div className="relative">
          <input
            id={id}
            type={show ? "text" : "password"}
            className="input pr-14"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            enterKeyHint="done"
            required
            autoFocus
            aria-describedby={`${id}-hint`}
          />
          <button
            type="button"
            className="icon-btn absolute top-1/2 right-1 -translate-y-1/2 text-muted"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t("login.password.hide") : t("login.password.show")}
            aria-pressed={show}
          >
            <Icon name={show ? "eyeOff" : "eye"} size={20} />
          </button>
        </div>
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {t("login.password.hint")}
        </p>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !password}>
        {t("reset.submit")}
      </button>
    </form>
  );
}
