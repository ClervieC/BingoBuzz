"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { errorKey } from "@/lib/errors";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { useT } from "./I18nProvider";

/** Saisie du pseudo puis appel de join_game. */
export function JoinForm({
  onJoin,
  submitLabel,
}: {
  onJoin: (nickname: string) => Promise<void>;
  submitLabel?: string;
}) {
  const t = useT();
  const id = useId();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readJson<string>(storageKeys.nickname);
    if (saved) setNickname(saved);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = nickname.trim().slice(0, 24);
    if (!name) {
      setError(t("errors.invalid_nickname"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      writeJson(storageKeys.nickname, name);
      await onJoin(name);
    } catch (err) {
      setError(t(errorKey(err)));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label htmlFor={id} className="label">
        {t("game.join.nickname")}
      </label>
      <input
        id={id}
        className="input text-lg"
        value={nickname}
        maxLength={24}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t("game.join.nickname.placeholder")}
        autoComplete="nickname"
        autoCapitalize="words"
        enterKeyHint="go"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? t("game.join.joining") : (submitLabel ?? t("game.join.submit"))}
      </button>
    </form>
  );
}
