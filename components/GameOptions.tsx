"use client";

import type { GameAutoEnd, GameMode } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

/**
 * Règle de fin proposée à l'hôte : automatique (bingo, carton plein), durée,
 * ou « keep » (partie en cours : garder l'échéance déjà fixée).
 */
export type EndRule = GameAutoEnd | "1d" | "3d" | "7d" | "keep";
const END_RULES: EndRule[] = ["manual", "first_bingo", "full_card", "1d", "3d", "7d"];
const MODES: GameMode[] = ["free", "peer", "validated"];

export function isDuration(rule: EndRule): rule is "1d" | "3d" | "7d" {
  return rule === "1d" || rule === "3d" || rule === "7d";
}

/** Paramètres de create_game / update_game_settings correspondant à une règle. */
export function endRuleParams(rule: EndRule) {
  return {
    p_auto_end: (isDuration(rule) || rule === "keep" ? "manual" : rule) as GameAutoEnd,
    p_duration_days: isDuration(rule) ? Number.parseInt(rule, 10) : null,
  };
}

export function ModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-3" role="radiogroup" aria-label={t("board.mode")}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          disabled={disabled && value !== m}
          onClick={() => onChange(m)}
          className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition disabled:opacity-40 ${
            value === m ? "border-accent bg-accent-soft" : "border-border"
          }`}
        >
          <span
            aria-hidden
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
              value === m ? "border-accent bg-accent text-accent-fg" : "border-border"
            }`}
          >
            {value === m && <Icon name="check" size={14} strokeWidth={3} />}
          </span>
          <span>
            <span className="block font-bold">{t(`board.mode.${m}`)}</span>
            <span className="block text-sm text-muted">{t(`board.mode.${m}.hint`)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function EndRulePicker({
  value,
  onChange,
  keepLabel,
}: {
  value: EndRule;
  onChange: (rule: EndRule) => void;
  /** partie en cours avec une échéance : proposer de la garder */
  keepLabel?: string;
}) {
  const t = useT();
  const rules: EndRule[] = keepLabel ? ["keep", ...END_RULES] : END_RULES;
  return (
    <>
      <h3 className="mt-6 mb-2 font-bold">{t("board.end")}</h3>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("board.end")}>
        {rules.map((rule) => (
          <button
            key={rule}
            type="button"
            role="radio"
            aria-checked={value === rule}
            onClick={() => onChange(rule)}
            className={`min-h-[40px] rounded-full border-2 px-3 text-sm font-bold transition active:scale-95 ${
              value === rule ? "border-accent bg-accent-soft" : "border-border"
            }`}
          >
            {rule === "keep"
              ? `⏱ ${keepLabel}`
              : isDuration(rule)
                ? `⏱ ${t("board.end.days", { count: Number.parseInt(rule, 10) })}`
                : t(`board.end.${rule}`)}
          </button>
        ))}
      </div>
    </>
  );
}
