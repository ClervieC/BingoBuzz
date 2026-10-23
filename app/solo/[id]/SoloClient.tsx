"use client";

import { useEffect, useRef } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BingoGrid } from "@/components/BingoGrid";
import { ExportImageButton } from "@/components/ExportImageButton";
import { GridFrame } from "@/components/GridFrame";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { VictoryOverlay } from "@/components/Victory";
import { themeStyle } from "@/lib/themes";
import type { BoardWithPhrases } from "@/types/bingo";
import { useSoloGame } from "@/hooks/useSoloGame";

export function SoloClient({ board }: { board: BoardWithPhrases }) {
  const t = useT();
  const toast = useToast();
  const frameRef = useRef<HTMLDivElement>(null);
  const game = useSoloGame(board);
  const total = board.grid_size * board.grid_size;

  const { gridChanged, dismissGridChanged } = game;
  useEffect(() => {
    if (!gridChanged) return;
    toast.show(t("solo.gridChanged"));
    dismissGridChanged();
  }, [gridChanged, dismissGridChanged, toast, t]);

  return (
    <div className="themed min-h-dvh" style={themeStyle(board.theme)}>
      <AppHeader back={`/boards/${board.id}`} backLabel={t("common.back")} />

      <main className="page pb-safe pt-2">
        <GridFrame
          ref={frameRef}
          title={board.title}
          theme={board.theme}
          subtitle={
            game.ready ? (
              <span aria-live="polite">
                {t("solo.progress", { count: game.count, total })}
                {game.missing === 1 && (
                  <span className="ml-2 font-bold text-accent">· {t("solo.oneLeft")}</span>
                )}
              </span>
            ) : (
              " "
            )
          }
        >
          {game.ready ? (
            <BingoGrid grid={game.grid} checked={game.checked} onToggle={game.toggle} />
          ) : (
            <div
              className="mx-auto aspect-square animate-pulse rounded-2xl bg-surface-2"
              style={{ width: "min(100%, max(300px, calc(100dvh - 230px)))" }}
            />
          )}
        </GridFrame>

        <p className="mt-2 text-center text-sm text-muted">{t("grid.longPressHint")}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm(t("solo.newGrid.confirm"))) game.newGrid();
            }}
          >
            <Icon name="refresh" size={20} />
            <span className="truncate">{t("solo.newGrid")}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm(t("solo.reset.confirm"))) game.reset();
            }}
          >
            <Icon name="close" size={20} />
            <span className="truncate">{t("solo.reset")}</span>
          </button>
          <ExportImageButton targetRef={frameRef} title={board.title} />
        </div>
      </main>

      <VictoryOverlay kind={game.victory} onClose={game.closeVictory}>
        <ExportImageButton
          targetRef={frameRef}
          title={board.title}
          className="btn btn-secondary w-full"
          label={t("victory.share")}
        />
      </VictoryOverlay>
    </div>
  );
}
