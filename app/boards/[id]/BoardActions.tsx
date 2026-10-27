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
import { EndRulePicker, ModePicker, endRuleParams, type EndRule } from "@/components/GameOptions";
import type { GameMode } from "@/types/bingo";

export function BoardActions({
  boardId,
  title,
  isOwner,
  locked = false,
  isTemplate,
  missing = 0,
}: {
  boardId: string;
  title: string;
  isOwner: boolean;
  /** une partie en cours a des joueurs : édition impossible */
  locked?: boolean;
  isTemplate: boolean;
  /** phrases manquantes pour une grille (brouillon) */
  missing?: number;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<GameMode>("free");
  const [endRule, setEndRule] = useState<EndRule>("progressive");
  // préparer avec le groupe : seul le propriétaire (les invités écrivent dans le bingo)
  const canPrepare = isOwner && !isTemplate;
  const draft = missing > 0;
  const [prepare, setPrepare] = useState(draft);
  const lobby = canPrepare && (prepare || draft);
  const [busy, setBusy] = useState<null | "game" | "duplicate" | "delete">(null);

  async function createGame() {
    setBusy("game");
    try {
      await requireUser();
      const { data, error } = await getSupabaseBrowserClient().rpc("create_game", {
        p_board_id: boardId,
        p_mode: mode,
        ...endRuleParams(endRule),
        p_lobby: lobby,
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
          disabled={draft && !canPrepare}
          className="wiggle-parent lift flex items-center gap-4 rounded-3xl bg-accent p-5 text-left text-accent-fg shadow-lg shadow-violet-900/20 transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="wiggle grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl">
            {draft ? "✍️" : "🎉"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black">{draft ? t("board.prepare") : t("board.createGame")}</span>
            <span className="block text-sm opacity-85">
              {draft ? t("board.draft.hint", { count: missing }) : t("board.createGame.hint")}
            </span>
          </span>
          <Icon name="back" className="shrink-0 rotate-180" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/solo/${boardId}`}
            aria-disabled={draft}
            onClick={(e) => {
              if (draft) e.preventDefault();
            }}
            className={`card wiggle-parent lift flex flex-col gap-2 p-4 transition active:scale-[0.97] ${draft ? "pointer-events-none opacity-50" : ""}`}
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
        {canPrepare && (
            <div className="mb-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("board.start")}>
              {([false, true] as const).map((value) => {
                const selected = lobby === value;
                const disabled = !value && draft;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setPrepare(value)}
                    className={`rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] disabled:opacity-50 ${
                      selected ? "border-accent bg-accent-soft" : "border-border"
                    }`}
                  >
                    <span className="block text-xl" aria-hidden>
                      {value ? "✍️" : "🚀"}
                    </span>
                    <span className="mt-1 block text-sm font-bold">{value ? t("board.start.prepare") : t("board.start.now")}</span>
                    <span className="block text-xs text-muted">
                      {value
                        ? t("board.start.prepare.hint")
                        : draft
                          ? t("board.draft.missing", { count: missing })
                          : t("board.start.now.hint")}
                    </span>
                  </button>
                );
              })}
            </div>
        )}
        <ModePicker value={mode} onChange={setMode} />
        <EndRulePicker value={endRule} onChange={setEndRule} />
        <p className="mt-2 text-xs text-muted">{t("board.end.hint")}</p>

        <button
          type="button"
          className="btn btn-primary mt-5 w-full"
          onClick={createGame}
          disabled={busy === "game"}
        >
          {busy === "game" ? t("board.mode.starting") : lobby ? t("board.start.prepare.submit") : t("board.mode.start")}
        </button>
      </BottomSheet>
    </>
  );
}
