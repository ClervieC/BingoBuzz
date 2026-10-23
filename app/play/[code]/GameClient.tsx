"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BingoGrid } from "@/components/BingoGrid";
import { BottomSheet } from "@/components/BottomSheet";
import { ExportImageButton } from "@/components/ExportImageButton";
import { GridFrame } from "@/components/GridFrame";
import { HostPanel } from "@/components/HostPanel";
import { useT } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/Icon";
import { JoinForm } from "@/components/JoinForm";
import { Leaderboard, rankPlayers } from "@/components/Leaderboard";
import { SharePanel } from "@/components/SharePanel";
import { useToast } from "@/components/Toast";
import { VictoryOverlay, victoryKindFromLine, type VictoryKind } from "@/components/Victory";
import { useGame } from "@/hooks/useGame";
import { cellsToBingo, countChecked, detectBingo, sizeFromLength } from "@/lib/bingo";
import { fireConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import type { MessageKey } from "@/lib/i18n";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { themeStyle } from "@/lib/themes";
import type { GamePlayer, PublicGame } from "@/types/bingo";

type Tab = "grid" | "ranking" | "host" | "invite";

const TAB_META: Record<Tab, { icon: IconName; label: MessageKey }> = {
  grid: { icon: "grid", label: "game.tabs.grid" },
  ranking: { icon: "trophy", label: "game.tabs.ranking" },
  host: { icon: "megaphone", label: "game.tabs.host" },
  invite: { icon: "share", label: "game.tabs.invite" },
};

export function GameClient({ publicGame }: { publicGame: PublicGame }) {
  const t = useT();
  const toast = useToast();
  const g = useGame(publicGame);
  const frameRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [victory, setVictory] = useState<VictoryKind | null>(null);

  const title = publicGame.title;
  const theme = publicGame.theme;
  const finished = g.game?.status === "finished";
  const mode = g.game?.mode ?? publicGame.mode;

  // ---- onglets disponibles ------------------------------------------------
  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [];
    if (g.me) list.push("grid");
    if (g.isHost) list.push("host");
    list.push("ranking", "invite");
    return list;
  }, [g.me, g.isHost]);
  const activeTab: Tab = tab && tabs.includes(tab) ? tab : tabs[0];

  // ---- alerte quand un autre joueur fait BINGO ----------------------------
  const { notice } = g;
  useEffect(() => {
    if (!notice) return;
    haptics.alert();
    void fireConfetti("small");
    toast.show(t("game.bingoAlert", { name: notice.player.nickname }), {
      tone: "bingo",
      duration: 8000,
      action: { label: t("game.bingoAlert.view"), onClick: () => setViewedId(notice.player.id) },
    });
  }, [notice, toast, t]);

  // ---- ma victoire (aussi en mode validé, quand l'hôte coche pour moi) -----
  const myChecked = g.me?.checked;
  const myGridLength = g.me?.grid.length;
  const gameId = g.game?.id;
  useEffect(() => {
    if (!myChecked || !myGridLength || !gameId) return;
    const result = detectBingo(myChecked, sizeFromLength(myGridLength));
    const key = storageKeys.celebrated(gameId);
    const stored = readJson<{ lines: number; full: boolean }>(key) ?? { lines: 0, full: false };
    if (result.isFullCard && !stored.full) {
      setVictory("full");
    } else if (result.lines.length > stored.lines) {
      setVictory(victoryKindFromLine(result.lines[result.lines.length - 1].kind));
    }
    writeJson(key, { lines: result.lines.length, full: result.isFullCard });
  }, [myChecked, myGridLength, gameId]);

  const viewed: GamePlayer | null = viewedId ? (g.players.find((p) => p.id === viewedId) ?? null) : null;
  const winners = useMemo(() => rankPlayers(g.players).filter((r) => r.bingo), [g.players]);

  // ------------------------------------------------------------------------

  const header = (
    <AppHeader
      back="/"
      backLabel={t("common.home")}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{theme.emoji}</span>
          <span className="truncate">{title}</span>
        </span>
      }
      actions={
        g.phase === "ready" && activeTab !== "invite" ? (
          <button type="button" className="icon-btn" aria-label={t("game.tabs.invite")} onClick={() => setTab("invite")}>
            <Icon name="users" />
          </button>
        ) : undefined
      }
    />
  );

  if (g.phase === "loading") {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page space-y-4 pt-4" aria-busy="true" aria-label={t("common.loading")}>
          <div className="h-10 w-2/3 animate-pulse rounded-xl bg-surface-2" />
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-surface-2" />
        </main>
      </div>
    );
  }

  if (g.phase === "error") {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page space-y-4 pt-10 text-center">
          <p className="text-muted">{t("errors.generic")}</p>
          <button type="button" className="btn btn-primary" onClick={() => void g.reload()}>
            {t("common.retry")}
          </button>
        </main>
      </div>
    );
  }

  if (g.phase === "join") {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page pb-safe space-y-6 pt-6">
          <div className="text-center">
            <span aria-hidden className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent-soft text-5xl">
              {theme.emoji}
            </span>
            <h1 className="mt-4 text-2xl font-black text-balance">{t("game.join.title", { title })}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span className="chip">{t(mode === "validated" ? "game.mode.validated" : "game.mode.free")}</span>
              <span>
                {publicGame.grid_size}×{publicGame.grid_size}
              </span>
              <span>·</span>
              <span>{t("game.join.players", { count: publicGame.player_count })}</span>
            </div>
          </div>
          <div className="card p-5">
            {publicGame.status === "finished" ? (
              <p className="text-center font-semibold text-muted">{t("game.finished")}</p>
            ) : (
              <JoinForm onJoin={g.join} />
            )}
          </div>
          {mode === "validated" && <p className="text-center text-sm text-muted">{t("game.validated.hint")}</p>}
        </main>
      </div>
    );
  }

  // ---- partie en cours ----------------------------------------------------

  const me = g.me;
  const size = me ? sizeFromLength(me.grid.length) : publicGame.grid_size;
  const missing = me ? cellsToBingo(me.checked, size) : size;

  return (
    <div className="themed min-h-dvh" style={themeStyle(theme)}>
      {header}

      {g.connection !== "live" && g.connection !== "connecting" && (
        <div
          role="status"
          className="sticky z-20 flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 text-sm font-semibold"
          style={{ top: "calc(var(--safe-top) + 3.5rem)" }}
        >
          <Icon name={g.connection === "offline" ? "wifiOff" : "refresh"} size={16} className={g.connection === "reconnecting" ? "animate-spin" : ""} />
          {g.connection === "offline" ? t("game.offline") : t("game.reconnecting")}
        </div>
      )}

      <main className="page space-y-5 pt-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 96px)" }}>
        {finished && (
          <section className="card border-gold bg-gold/10 p-4 text-center">
            <p className="text-lg font-black">🏁 {t("game.ended.title")}</p>
            <p className="mt-1 text-muted">
              {winners.length > 0
                ? t("game.ended.winner", { name: winners.map((w) => w.player.nickname).join(", ") })
                : t("game.ended.noWinner")}
            </p>
          </section>
        )}

        {activeTab === "grid" && me && (
          <>
            <GridFrame
              ref={frameRef}
              title={title}
              theme={theme}
              subtitle={
                <span aria-live="polite">
                  {countChecked(me.checked)} / {me.grid.length}
                  {missing === 1 && !finished && (
                    <span className="ml-2 font-bold text-accent">· {t("game.ranking.oneLeft")}</span>
                  )}
                </span>
              }
            >
              <BingoGrid
                grid={me.grid}
                checked={me.checked}
                onToggle={g.toggle}
                readOnly={mode === "validated" || finished}
              />
            </GridFrame>
            <p className="text-center text-sm text-muted">
              {mode === "validated" ? t("game.validated.hint") : t("grid.longPressHint")}
            </p>
            <div className="flex justify-center gap-2">
              <ExportImageButton targetRef={frameRef} title={title} />
              {!g.isHost && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-muted"
                  onClick={() => {
                    if (window.confirm(t("game.leave.confirm"))) void g.leave();
                  }}
                >
                  {t("game.leave")}
                </button>
              )}
            </div>
          </>
        )}

        {activeTab === "ranking" && (
          <section>
            <h2 className="mb-3 text-lg font-extrabold">{t("game.tabs.ranking")}</h2>
            <Leaderboard
              players={g.players}
              userId={g.userId}
              hostId={g.game?.host_id ?? null}
              online={g.online}
              onSelect={(p) => setViewedId(p.id)}
            />
          </section>
        )}

        {activeTab === "host" && g.game && (
          <>
            <HostPanel
              game={g.game}
              board={g.board}
              validatedIds={g.validatedIds}
              onTogglePhrase={(id) => void g.togglePhrase(id)}
              onEnd={() => void g.endGame()}
            />
            {!me && !finished && (
              <section className="card p-5">
                <h2 className="mb-3 font-extrabold">{t("game.host.alsoPlay")}</h2>
                <JoinForm onJoin={g.join} submitLabel={t("game.host.alsoPlay")} />
              </section>
            )}
          </>
        )}

        {activeTab === "invite" && (
          <section className="card p-5">
            <h2 className="mb-4 text-center text-lg font-extrabold">{t("game.share.title")}</h2>
            <SharePanel code={publicGame.code} title={title} />
          </section>
        )}
      </main>

      {/* Onglets en bas, au-dessus de l'indicateur d'accueil iOS */}
      <nav
        aria-label={title}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md"
      >
        <div className="page grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((id) => {
            const active = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon name={TAB_META[id].icon} size={22} />
                {t(TAB_META[id].label)}
              </button>
            );
          })}
        </div>
      </nav>

      <BottomSheet
        open={viewed !== null}
        onClose={() => setViewedId(null)}
        title={viewed ? t("game.playerGrid", { name: viewed.nickname }) : undefined}
      >
        {viewed && <BingoGrid grid={viewed.grid} checked={viewed.checked} readOnly compact />}
      </BottomSheet>

      <VictoryOverlay kind={victory} onClose={() => setVictory(null)}>
        <ExportImageButton
          targetRef={frameRef}
          title={title}
          className="btn btn-secondary w-full"
          label={t("victory.share")}
        />
      </VictoryOverlay>
    </div>
  );
}
