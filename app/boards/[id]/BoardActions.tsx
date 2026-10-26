"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { requireUser } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GameAutoEnd, GameMode } from "@/types/bingo";

/** Règles de fin proposées à l'hôte : automatique (bingo, carton plein) ou durée. */
type EndRule = GameAutoEnd | "1d" | "3d" | "7d";
const END_RULES: EndRule[] = ["manual", "first_bingo", "full_card", "1d", "3d", "7d"];

export function BoardActions({
  boardId,
  title,
  isOwner,
  locked = false,
  isTemplate,
}: {
  boardId: string;
  title: string;
  isOwner: boolean;
  /** une partie en cours a des joueurs : édition impossible */
  locked?: boolean;
  isTemplate: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<GameMode>("free");
  const [endRule, setEndRule] = useState<EndRule>("manual");
  const [busy, setBusy] = useState<null | "game" | "duplicate" | "delete">(null);

  async function createGame() {
    setBusy("game");
    try {
      await requireUser();
      const { data, error } = await getSupabaseBrowserClient().rpc("create_game", {
        p_board_id: boardId,
        p_mode: mode,
        p_auto_end: endRule.endsWith("d") ? "manual" : (endRule as GameAutoEnd),
        p_duration_days: endRule.endsWith("d") ? Number.parseInt(endRule, 10) : null,
      });
      if (error || !data) throw error ?? new Error("create_game");
      router.push(`/play/${data.code}`);
    } catch (err) {
      toast.show(t(errorKey(err)), { tone: "error" });
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("duplicate");
    try {
      await requireUser();
      const { data: id, error } = await getSupabaseBrowserClient().rpc("duplicate_board", {
        p_id: boardId,
        p_title: isTemplate ? title : `${title} ${t("library.copySuffix")}`,
      });
      if (error || !id) throw error ?? new Error("duplicate_board");
      toast.show(t("library.duplicated"), { tone: "success" });
      router.push(`/boards/${id}/edit`);
    } catch (err) {
      toast.show(t(errorKey(err)), { tone: "error" });
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(t("board.delete.confirm", { title }))) return;
    setBusy("delete");
    const { error } = await getSupabaseBrowserClient().from("boards").delete().eq("id", boardId);
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      setBusy(null);
      return;
    }
    toast.show(t("library.deleted"));
    router.push("/library");
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-3">
        {/* action principale */}
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="wiggle-parent lift flex items-center gap-4 rounded-3xl bg-accent p-5 text-left text-accent-fg shadow-lg shadow-violet-900/20 transition active:scale-[0.98]"
        >
          <span className="wiggle grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl">
            🎉
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black">{t("board.createGame")}</span>
            <span className="block text-sm opacity-85">{t("board.createGame.hint")}</span>
          </span>
          <Icon name="back" className="shrink-0 rotate-180" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/solo/${boardId}`}
            className="card wiggle-parent lift flex flex-col gap-2 p-4 transition active:scale-[0.97]"
          >
            <span className="wiggle grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon name="play" />
            </span>
            <span className="font-extrabold">{t("board.playSolo")}</span>
            <span className="text-xs text-muted">{t("board.playSolo.hint")}</span>
          </Link>

          {isOwner && !locked ? (
            <Link
              href={`/boards/${boardId}/edit`}
              className="card wiggle-parent lift flex flex-col gap-2 p-4 transition active:scale-[0.97]"
            >
              <span className="wiggle grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Icon name="edit" />
              </span>
              <span className="font-extrabold">{t("common.edit")}</span>
              <span className="text-xs text-muted">{t("game.host.edit.hint")}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={duplicate}
              disabled={busy !== null}
              className="card wiggle-parent lift flex flex-col gap-2 p-4 text-left transition active:scale-[0.97]"
            >
              <span className="wiggle grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Icon name="copy" />
              </span>
              <span className="font-extrabold">{isTemplate ? t("board.useTemplate") : t("common.duplicate")}</span>
              <span className="text-xs text-muted">{t("library.templates.hint")}</span>
            </button>
          )}
        </div>

        {isOwner && locked && <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">{t("board.locked")}</p>}

        {/* actions secondaires */}
        {isOwner && (
          <div className="flex flex-wrap justify-center gap-2" aria-label={t("board.more")}>
            {!locked && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={duplicate} disabled={busy !== null}>
                <Icon name="copy" size={18} />
                {t("common.duplicate")}
              </button>
            )}
            <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy !== null}>
              <Icon name="trash" size={18} />
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t("board.mode")}>
        <div className="space-y-3" role="radiogroup" aria-label={t("board.mode")}>
          {(["free", "peer", "validated"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                mode === m ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                  mode === m ? "border-accent bg-accent text-accent-fg" : "border-border"
                }`}
              >
                {mode === m && <Icon name="check" size={14} strokeWidth={3} />}
              </span>
              <span>
                <span className="block font-bold">{t(`board.mode.${m}`)}</span>
                <span className="block text-sm text-muted">{t(`board.mode.${m}.hint`)}</span>
              </span>
            </button>
          ))}
        </div>
        <h3 className="mt-6 mb-2 font-bold">{t("board.end")}</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("board.end")}>
          {END_RULES.map((rule) => (
            <button
              key={rule}
              type="button"
              role="radio"
              aria-checked={endRule === rule}
              onClick={() => setEndRule(rule)}
              className={`min-h-[40px] rounded-full border-2 px-3 text-sm font-bold transition active:scale-95 ${
                endRule === rule ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              {rule.endsWith("d")
                ? `⏱ ${t("board.end.days", { count: Number.parseInt(rule, 10) })}`
                : t(`board.end.${rule as GameAutoEnd}`)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("board.end.hint")}</p>

        <button
          type="button"
          className="btn btn-primary mt-5 w-full"
          onClick={createGame}
          disabled={busy === "game"}
        >
          {busy === "game" ? t("board.mode.starting") : t("board.mode.start")}
        </button>
      </BottomSheet>
    </>
  );
}
