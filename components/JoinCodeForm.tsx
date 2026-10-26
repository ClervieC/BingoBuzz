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
      <label htmlFor={id} className="sr-only">
        {t("home.join.label")}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input min-w-0 font-mono text-lg font-bold tracking-[0.25em] uppercase placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
          value={value}
          onChange={(e) => {
            // un lien collé est accepté tel quel ; sinon on normalise au fil de la frappe
            const raw = e.target.value;
            setValue(raw.includes("/") ? raw : normalizeCode(raw));
            setError(false);
          }}
          placeholder={t("home.join.placeholderLong")}
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
