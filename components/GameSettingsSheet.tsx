"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game, GameMode } from "@/types/bingo";
import { BottomSheet } from "./BottomSheet";
import { EndRulePicker, ModePicker, endRuleParams, type EndRule } from "./GameOptions";
import { useI18n, useT } from "./I18nProvider";
import { Icon } from "./Icon";

function initialRule(game: Game): EndRule {
  if (game.auto_end !== "manual") return game.auto_end;
  if (game.status === "lobby") {
    const d = game.duration_days;
    return d === 1 || d === 3 || d === 7 ? (`${d}d` as EndRule) : "manual";
  }
  return game.ends_at ? "keep" : "manual";
}

/**
 * Paramètres de la partie, pour l'hôte : mode (en préparation seulement),
 * règle de fin et durée, modification du bingo en brouillon, remise à zéro.
 */
export function GameSettingsSheet({
  open,
  onClose,
  game,
  editHref,
  onSave,
  onReset,
  onReopen,
}: {
  open: boolean;
  onClose: () => void;
  game: Game;
  /** lien vers l'éditeur du bingo (propriétaire, partie en préparation) */
  editHref?: string;
  onSave: (settings: { mode: GameMode; autoEnd: Game["auto_end"]; durationDays: number | null; keepDeadline: boolean }) => Promise<boolean>;
  onReset: (newGrids: boolean) => Promise<boolean>;
  /** retour en préparation (propriétaire du bingo seulement) */
  onReopen?: () => Promise<boolean>;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [mode, setMode] = useState<GameMode>(game.mode);
  const [rule, setRule] = useState<EndRule>(() => initialRule(game));
  const [newGrids, setNewGrids] = useState(false);
  const [busy, setBusy] = useState(false);

  // à chaque ouverture, on repart des réglages actuels
  useEffect(() => {
    if (!open) return;
    setMode(game.mode);
    setRule(initialRule(game));
    setNewGrids(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement à l'ouverture
  }, [open]);

  const lobby = game.status === "lobby";
  const finished = game.status === "finished";
  const keepLabel =
    !lobby && game.ends_at
      ? t("game.settings.keep", {
          date: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
            new Date(game.ends_at),
          ),
        })
      : undefined;

  async function save() {
    setBusy(true);
    const { p_auto_end, p_duration_days } = endRuleParams(rule);
    const ok = await onSave({ mode, autoEnd: p_auto_end, durationDays: p_duration_days, keepDeadline: rule === "keep" });
    setBusy(false);
    if (ok) onClose();
  }

  async function reopen() {
    if (!onReopen || !window.confirm(t("game.reopen.confirm"))) return;
    setBusy(true);
    const ok = await onReopen();
    setBusy(false);
    if (ok) onClose();
  }

  async function reset() {
    if (!window.confirm(newGrids ? t("game.reset.confirmNew") : t("game.reset.confirm"))) return;
    setBusy(true);
    const ok = await onReset(newGrids);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("game.settings")}>
      <div className="space-y-6">
        {editHref && (
          <Link href={editHref} className="card flex min-h-[56px] items-center gap-3 p-3 font-bold active:bg-surface-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon name="edit" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{t("game.settings.editBoard")}</span>
              <span className="block text-xs font-normal text-muted">{t("game.settings.editBoard.hint")}</span>
            </span>
            <Icon name="back" size={18} className="rotate-180 text-muted" />
          </Link>
        )}

        {!finished && (
          <section>
            {lobby ? (
              <ModePicker value={mode} onChange={setMode} />
            ) : (
              <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">
                {t("game.settings.modeLocked", { mode: t(`board.mode.${game.mode}`) })}
              </p>
            )}
            <EndRulePicker value={rule} onChange={setRule} keepLabel={keepLabel} />
            <p className="mt-2 text-xs text-muted">
              {lobby ? t("game.settings.lobbyHint") : t("game.settings.durationHint")}
            </p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={save} disabled={busy}>
              {t("game.settings.save")}
            </button>
          </section>
        )}

        {!lobby && (
          <section className="rounded-2xl border-2 border-danger/30 p-4">
            <h3 className="font-extrabold">🔄 {t("game.reset")}</h3>
            <p className="mt-1 text-sm text-muted">{t("game.reset.hint")}</p>
            <label className="mt-3 flex min-h-[44px] items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent)]"
                checked={newGrids}
                onChange={(e) => setNewGrids(e.target.checked)}
              />
              {t("game.reset.newGrids")}
            </label>
            <button type="button" className="btn btn-danger mt-2 w-full" onClick={reset} disabled={busy}>
              {t("game.reset.submit")}
            </button>
          </section>
        )}

        {!lobby && onReopen && (
          <section className="rounded-2xl border-2 border-border p-4">
            <h3 className="font-extrabold">✍️ {t("game.reopen")}</h3>
            <p className="mt-1 text-sm text-muted">{t("game.reopen.hint")}</p>
            <button type="button" className="btn btn-secondary mt-3 w-full" onClick={reopen} disabled={busy}>
              {t("game.reopen.submit")}
            </button>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}
