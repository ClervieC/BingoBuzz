"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { extractCode, normalizeCode } from "@/lib/code";
import { useT } from "./I18nProvider";

export function JoinCodeForm() {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) {
      setError(true);
      return;
    }
    router.push(`/play/${code}`);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="label">
        {t("home.join.label")}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input text-center font-mono text-xl font-bold tracking-[0.3em] uppercase"
          value={value}
          onChange={(e) => {
            // un lien collé est accepté tel quel ; sinon on normalise au fil de la frappe
            const raw = e.target.value;
            setValue(raw.includes("/") ? raw : normalizeCode(raw));
            setError(false);
          }}
          placeholder={t("home.join.placeholder")}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button type="submit" className="btn btn-primary shrink-0">
          {t("home.join.submit")}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 text-sm text-danger">
          {t("home.join.invalid")}
        </p>
      )}
    </form>
  );
}
