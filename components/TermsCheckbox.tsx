"use client";

import Link from "next/link";
import { useId } from "react";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

/** Case « J'accepte les conditions d'utilisation et la politique de confidentialité ». */
export function TermsCheckbox({
  checked,
  onChange,
  invalid = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  invalid?: boolean;
}) {
  const t = useT();
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-err` : undefined}
            className={`peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 transition checked:border-accent checked:bg-accent ${
              invalid ? "border-danger" : "border-border"
            }`}
          />
          <Icon
            name="check"
            size={16}
            strokeWidth={3}
            className="pointer-events-none absolute text-accent-fg opacity-0 peer-checked:opacity-100"
          />
        </span>
        <label htmlFor={id} className="text-sm leading-snug">
          {t("auth.terms.before")}
          <Link href="/terms" target="_blank" className="font-semibold text-accent underline underline-offset-2">
            {t("auth.terms.termsLink")}
          </Link>
          {t("auth.terms.middle")}
          <Link href="/privacy" target="_blank" className="font-semibold text-accent underline underline-offset-2">
            {t("auth.terms.privacyLink")}
          </Link>
          {t("auth.terms.after")}
        </label>
      </div>
      {invalid && (
        <p id={`${id}-err`} role="alert" className="mt-1 pl-9 text-sm font-semibold text-danger">
          {t("auth.terms.required")}
        </p>
      )}
    </div>
  );
}
