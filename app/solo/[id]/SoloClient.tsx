"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BingoGrid } from "@/components/BingoGrid";
import { ExportImageButton } from "@/components/ExportImageButton";
import { GridFrame } from "@/components/GridFrame";
import { useT } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { VictoryOverlay } from "@/components/Victory";
import { useSoloGame } from "@/hooks/useSoloGame";
import { themeStyle } from "@/lib/themes";
import type { BoardWithPhrases } from "@/types/bingo";

/** Bouton-tuile : icône au-dessus d'un libellé court (jamais tronqué). */
const TOOL_CLASS =
  "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface px-1 py-2 text-xs font-bold leading-tight text-center transition active:scale-95";

function ToolButton({ icon, label, onClick }: { icon: IconName; label: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`${TOOL_CLASS} wiggle-parent`} onClick={onClick}>
      <span className="wiggle inline-flex text-accent">
        <Icon name={icon} size={22} />
      </span>
      {label}
    </button>
  );
}

export function SoloClient({ board }: { board: BoardWithPhrases }) {
  const t = useT();
  const toast = useToast();
  const frameRef = useRef<HTMLDivElement>(null);
  const game = useSoloGame(board);
  const total = board.grid_size * board.grid_size;
  const progress = game.ready ? game.count / total : 0;

  const { gridChanged, dismissGridChanged } = game;
  useEffect(() => {
    if (!gridChanged) return;
    toast.show(t("solo.gridChanged"));
    dismissGridChanged();
  }, [gridChanged, dismissGridChanged, toast, t]);

  return (
    <div className="themed min-h-dvh" style={themeStyle(board.theme)}>
      <AppHeader back={`/boards/${board.id}`} backLabel={t("common.back")} />

      <main className="page pb-safe stagger space-y-4 pt-2 pb-10">
        <GridFrame
          ref={frameRef}
          title={board.title}
          theme={board.theme}
          subtitle={
            game.ready ? (
              <span aria-live="polite" className="flex items-center gap-2">
                <span key={game.count} className="animate-pop inline-block">
                  {t("solo.progress", { count: game.count, total })}
                </span>
                {game.missing === 1 && (
                  <span className="animate-pulse rounded-full bg-accent px-2 py-0.5 text-xs font-black text-accent-fg">
                    {t("solo.oneLeft")}
                  </span>
                )}
              </span>
            ) : (
              " "
            )
          }
        >
          {/* progression */}
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {game.ready ? (
            <BingoGrid grid={game.grid} checked={game.checked} onToggle={game.toggle} />
          ) : (
            <div
              className="mx-auto aspect-square animate-pulse rounded-2xl bg-surface-2"
              style={{ width: "min(100%, max(300px, calc(100dvh - 230px)))" }}
            />
          )}
        </GridFrame>

        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted">
          <span aria-hidden>👆</span>
          {t("grid.longPressHint")}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <ToolButton
            icon="refresh"
            label={t("solo.newGrid")}
            onClick={() => {
              if (window.confirm(t("solo.newGrid.confirm"))) game.newGrid();
            }}
          />
          <ToolButton
            icon="close"
            label={t("solo.restart")}
            onClick={() => {
              if (window.confirm(t("solo.reset.confirm"))) game.reset();
            }}
          />
          <ExportImageButton
            targetRef={frameRef}
            title={board.title}
            className={`${TOOL_CLASS} [&>svg]:text-accent`}
            label={t("solo.share")}
            icon="share"
          />
        </div>
        <p className="text-center text-xs text-muted">{t("solo.share.hint")}</p>

        <Link
          href={`/boards/${board.id}`}
          className="lift flex items-center gap-4 rounded-3xl bg-accent-soft p-4 transition active:scale-[0.98]"
        >
          <span className="text-3xl" aria-hidden>
            👯
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{t("solo.group.title")}</span>
            <span className="block text-sm text-muted">{t("solo.group.body")}</span>
          </span>
          <span className="shrink-0 rounded-full bg-accent px-3 py-2 text-sm font-bold text-accent-fg">
            {t("solo.group.cta")}
          </span>
        </Link>
      </main>

      <VictoryOverlay kind={game.victory} onClose={game.closeVictory}>
        <ExportImageButton
          targetRef={frameRef}
          title={board.title}
          className="btn btn-secondary w-full"
          label={t("victory.share")}
          icon="share"
        />
      </VictoryOverlay>
    </div>
  );
}
