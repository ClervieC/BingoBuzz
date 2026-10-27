"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { AVATARS } from "@/lib/avatars";
import { errorKey } from "@/lib/errors";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { useT } from "./I18nProvider";

/** Choix de l'avatar et du pseudo, puis appel de join_game. */
export function JoinForm({
  onJoin,
  submitLabel,
  initialNickname,
  initialAvatar,
}: {
  onJoin: (nickname: string, avatar: string) => Promise<void>;
  submitLabel?: string;
  /** modification de son profil (préparation) : valeurs actuelles */
  initialNickname?: string;
  initialAvatar?: string | null;
}) {
  const t = useT();
  const id = useId();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = initialNickname ?? readJson<string>(storageKeys.nickname);
    if (saved) setNickname(saved);
    const savedAvatar = initialAvatar ?? readJson<string>(storageKeys.avatar);
    setAvatar(savedAvatar && AVATARS.includes(savedAvatar) ? savedAvatar : AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valeurs de départ seulement
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
      writeJson(storageKeys.avatar, avatar);
      await onJoin(name, avatar);
      setBusy(false);
    } catch (err) {
      setError(t(errorKey(err)));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {/* min-w-0 : un fieldset prend sinon la largeur de son contenu (toute la rangée) */}
      <fieldset className="min-w-0">
        <legend className="label">{t("game.join.avatar")}</legend>
        <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 py-1" role="radiogroup">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={a}
              onClick={() => setAvatar(a)}
              className={`grid h-11 w-11 shrink-0 snap-start place-items-center rounded-full text-2xl transition active:scale-90 ${
                avatar === a ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>
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
