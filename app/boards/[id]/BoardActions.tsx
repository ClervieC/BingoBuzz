"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { ensureSession } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GameMode } from "@/types/bingo";

export function BoardActions({
  boardId,
  title,
  isOwner,
  isTemplate,
}: {
  boardId: string;
  title: string;
  isOwner: boolean;
  isTemplate: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<GameMode>("free");
  const [busy, setBusy] = useState<null | "game" | "duplicate" | "delete">(null);

  async function createGame() {
    setBusy("game");
    try {
      await ensureSession();
      const { data, error } = await getSupabaseBrowserClient().rpc("create_game", {
        p_board_id: boardId,
        p_mode: mode,
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
      await ensureSession();
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
      <button
        type="button"
        onClick={() => setSheet(true)}
        className="card flex items-center gap-4 p-4 text-left active:scale-[0.99]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg">
          <Icon name="users" />
        </span>
        <span className="min-w-0">
          <span className="block font-bold">{t("board.createGame")}</span>
          <span className="block text-sm text-muted">{t("board.createGame.hint")}</span>
        </span>
      </button>

      <div className="flex flex-wrap gap-2 pt-1">
        {isOwner && (
          <Link href={`/boards/${boardId}/edit`} className="btn btn-ghost btn-sm">
            <Icon name="edit" size={20} />
            {t("common.edit")}
          </Link>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={duplicate} disabled={busy !== null}>
          <Icon name="copy" size={20} />
          {isTemplate ? t("board.useTemplate") : t("common.duplicate")}
        </button>
        {isOwner && (
          <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy !== null}>
            <Icon name="trash" size={20} />
            {t("common.delete")}
          </button>
        )}
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t("board.mode")}>
        <div className="space-y-3" role="radiogroup" aria-label={t("board.mode")}>
          {(["free", "validated"] as const).map((m) => (
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
                <span className="block font-bold">{t(m === "free" ? "board.mode.free" : "board.mode.validated")}</span>
                <span className="block text-sm text-muted">
                  {t(m === "free" ? "board.mode.free.hint" : "board.mode.validated.hint")}
                </span>
              </span>
            </button>
          ))}
        </div>
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
