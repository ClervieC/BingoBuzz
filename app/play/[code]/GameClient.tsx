"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BingoGrid } from "@/components/BingoGrid";
import { BottomSheet } from "@/components/BottomSheet";
import { ClaimsPanel } from "@/components/ClaimsPanel";
import { HostPanel } from "@/components/HostPanel";
import { useI18n, useT } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/Icon";
import { JoinForm } from "@/components/JoinForm";
import { ProofGallery } from "@/components/ProofGallery";
import { ProgressRing } from "@/components/ProgressRing";
import { ProposeSheet } from "@/components/ProposeSheet";
import { PushPrompt } from "@/components/PushPrompt";
import { ReactionBar } from "@/components/ReactionBar";
import { Leaderboard, rankPlayers } from "@/components/Leaderboard";
import { GameSettingsSheet } from "@/components/GameSettingsSheet";
import { LobbyView } from "@/components/LobbyView";
import { SharePanel } from "@/components/SharePanel";
import { useToast } from "@/components/Toast";
import { VictoryOverlay, victoryKindFromLine, type VictoryKind } from "@/components/Victory";
import { useGame } from "@/hooks/useGame";
import { cellsToBingo, countChecked, detectBingo, sizeFromLength } from "@/lib/bingo";
import { fireConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import type { MessageKey } from "@/lib/i18n";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { THEME_COLORS, themeStyle } from "@/lib/themes";
import type { GameClaim, GameMode, GamePlayer, PublicGame } from "@/types/bingo";

/** « dans 3 jours », « in 5 hours »… */
function relativeTime(iso: string, locale: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(seconds) < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

type Tab = "grid" | "ranking" | "photos" | "host" | "invite";

const TAB_META: Record<Tab, { icon: IconName; label: MessageKey }> = {
  grid: { icon: "grid", label: "game.tabs.grid" },
  ranking: { icon: "trophy", label: "game.tabs.ranking" },
  host: { icon: "settings", label: "game.tabs.host" },
  photos: { icon: "image", label: "game.tabs.photos" },
  invite: { icon: "share", label: "game.tabs.invite" },
};

const MODE_LABEL: Record<GameMode, MessageKey> = {
  free: "game.mode.free",
  validated: "game.mode.validated",
  peer: "game.mode.peer",
};
const MODE_HINT: Record<GameMode, MessageKey> = {
  free: "grid.longPressHint",
  validated: "game.validated.hint",
  peer: "game.peer.hint",
};

export function GameClient({ publicGame }: { publicGame: PublicGame }) {
  const t = useT();
  const { locale } = useI18n();
  const toast = useToast();
  const g = useGame(publicGame);
  const [tab, setTab] = useState<Tab | null>(null);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [victory, setVictory] = useState<VictoryKind | null>(null);
  // mode groupe : case dont on prépare la proposition (fenêtre « J'ai vu ça ! »)
  const [proposing, setProposing] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const title = publicGame.title;
  const theme = publicGame.theme;
  const palette = THEME_COLORS[theme.color];
  const finished = g.game?.status === "finished";
  const mode: GameMode = g.game?.mode ?? publicGame.mode;

  // ---- onglets disponibles ------------------------------------------------
  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [];
    if (g.me) list.push("grid");
    list.push("ranking");
    // galerie des preuves : seulement en mode « validé par le groupe »
    if ((g.game?.mode ?? publicGame.mode) === "peer") list.push("photos");
    if (g.isHost) list.push("host");
    list.push("invite");
    return list;
  }, [g.me, g.isHost, g.game?.mode, publicGame.mode]);
  // partie terminée : on arrive sur le classement final
  const activeTab: Tab =
    tab && tabs.includes(tab) ? tab : finished ? "ranking" : g.me ? "grid" : g.isHost ? "host" : tabs[0];

  // texte d'une phrase (bingo chargé, sinon grilles des joueurs)
  const phraseText = useCallback(
    (id: string) =>
      g.board?.phrases.find((p) => p.id === id)?.text ??
      g.players.flatMap((p) => p.grid).find((c) => c.id === id)?.text ??
      "…",
    [g.board, g.players],
  );
  const nameOf = useCallback(
    (uid: string | null) => g.players.find((p) => p.user_id === uid)?.nickname ?? "?",
    [g.players],
  );

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

  // ---- mode groupe : nouvelle proposition / ma proposition traitée --------
  const { claimNotice, resolveClaim } = g;
  useEffect(() => {
    if (!claimNotice) return;
    const { claim, kind } = claimNotice;
    const text = phraseText(claim.phrase_id);
    if (kind === "new") {
      haptics.alert();
      toast.show(t("game.peer.toast", { name: nameOf(claim.claimed_by), text }), {
        duration: 8000,
        action: { label: t("game.peer.confirm"), onClick: () => void resolveClaim(claim.id, true) },
      });
    } else if (kind === "confirmed") {
      toast.show(t("game.peer.confirmed", { text, name: nameOf(claim.resolved_by) }), { tone: "success" });
    } else {
      toast.show(t("game.peer.rejected", { text, name: nameOf(claim.resolved_by) }), { tone: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une notification par événement
  }, [claimNotice]);

  // ---- ma victoire (aussi en modes validés, quand d'autres cochent pour moi) --
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

  // cases de ma grille proposées et en attente (mode groupe)
  const me = g.me;
  const pendingCells = useMemo(() => {
    const set = new Set<number>();
    if (!me) return set;
    for (const claim of g.claims) {
      if (claim.status !== "pending") continue;
      const index = me.grid.findIndex((c) => c.id === claim.phrase_id);
      if (index >= 0) set.add(index);
    }
    return set;
  }, [g.claims, me]);
  const toConfirmCount = g.claims.filter((c) => c.status === "pending" && c.claimed_by !== g.userId).length;

  /** Toucher une case : coche (mode libre) ; proposition ou annulation (mode groupe). */
  const { toggle, cancelClaim, proposeClaim } = g;
  const onCellTap = useCallback(
    (index: number) => {
      if (mode !== "peer") {
        toggle(index);
        return;
      }
      if (!me || me.checked[index] || !me.grid[index]?.id) return;
      const pendingClaim = g.claims.find((c) => c.status === "pending" && c.phrase_id === me.grid[index].id);
      if (pendingClaim) {
        // ma proposition : je l'annule ; celle d'un autre : à confirmer dans le panneau
        if (pendingClaim.claimed_by === g.userId) void cancelClaim(pendingClaim);
        return;
      }
      setProposing(index);
    },
    [mode, toggle, me, g.claims, g.userId, cancelClaim],
  );

  const { reactions, toggleReaction, userId } = g;
  const claimReactions = useCallback(
    (claim: GameClaim) => (
      <ReactionBar
        reactions={reactions}
        targetType="claim"
        targetId={claim.id}
        userId={userId}
        onToggle={(emoji) => void toggleReaction("claim", claim.id, emoji)}
      />
    ),
    [reactions, toggleReaction, userId],
  );

  // ------------------------------------------------------------------------

  const header = (
    <AppHeader
      back="/"
      backLabel={t("common.home")}
      actions={
        g.phase === "ready" && activeTab !== "invite" ? (
          <button type="button" className="icon-btn" aria-label={t("game.tabs.invite")} onClick={() => setTab("invite")}>
            <Icon name="users" />
          </button>
        ) : undefined
      }
    />
  );

  /** Bandeau aux couleurs du bingo : emoji, titre, mode, code, joueurs en ligne. */
  const banner = (
    <section
      className="relative overflow-hidden rounded-3xl p-4 text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${palette.light}, #1c1830)` }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-4 -right-3 text-[5.5rem] leading-none opacity-15">
        {theme.emoji}
      </span>
      <div className="relative flex items-center gap-3">
        <span aria-hidden className="animate-bounce-in grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-3xl">
          {theme.emoji}
        </span>
        <h1 className="min-w-0 flex-1 text-xl leading-tight font-black text-balance">{title}</h1>
      </div>
      <div className="relative mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/15 px-2.5 py-1">{t(MODE_LABEL[mode])}</span>
        <button
          type="button"
          onClick={() => setTab("invite")}
          className="rounded-full bg-white/15 px-2.5 py-1 font-mono tracking-widest"
          aria-label={t("game.tabs.invite")}
        >
          {publicGame.code}
        </button>
        {g.game && !finished && g.game.auto_end !== "manual" && (
          <span className="rounded-full bg-white/15 px-2.5 py-1">🏁 {t(`game.end.${g.game.auto_end}`)}</span>
        )}
        {g.game?.ends_at && !finished && (
          <span className="rounded-full bg-white/15 px-2.5 py-1">
            ⏱ {t("game.end.in", { time: relativeTime(g.game.ends_at, locale) })}
          </span>
        )}
        {g.phase === "ready" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            {t("game.online", { count: g.online.size })}
          </span>
        )}
      </div>
    </section>
  );

  if (g.phase === "loading") {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page space-y-4 pt-4" aria-busy="true" aria-label={t("common.loading")}>
          {banner}
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
        <main className="page pb-safe stagger space-y-5 pt-4">
          {banner}
          <div className="card p-5">
            <h2 className="mb-1 text-lg font-black">
              {publicGame.status === "lobby" ? t("lobby.join.title", { title }) : t("game.join.title", { title })}
            </h2>
            {publicGame.status === "lobby" && <p className="mb-2 text-sm">✍️ {t("lobby.join.hint")}</p>}
            <p className="mb-4 text-sm text-muted">
              {publicGame.grid_size}×{publicGame.grid_size} · {t("game.join.players", { count: publicGame.player_count })}
            </p>
            {publicGame.status === "finished" ? (
              <p className="text-center font-semibold text-muted">{t("game.finished")}</p>
            ) : !g.userId ? (
              // connexion obligatoire : retour automatique sur cette partie ensuite
              <div className="space-y-3 text-center">
                <p className="text-muted">{t("game.join.loginRequired")}</p>
                <a href={`/?next=${encodeURIComponent(`/play/${publicGame.code}`)}`} className="btn btn-primary w-full">
                  <Icon name="user" size={20} />
                  {t("game.join.login")}
                </a>
              </div>
            ) : (
              <JoinForm onJoin={g.join} submitLabel={publicGame.status === "lobby" ? t("lobby.join.submit") : undefined} />
            )}
          </div>
          {mode !== "free" && <p className="text-center text-sm text-muted">{t(MODE_HINT[mode])}</p>}
        </main>
      </div>
    );
  }

  /** Paramètres de la partie (hôte) : réglages, bingo en brouillon, remise à zéro. */
  const settingsSheet =
    g.isHost && g.game ? (
      <GameSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        game={g.game}
        editHref={
          g.game.status === "lobby" && g.board?.owner_id === g.userId
            ? `/boards/${publicGame.board_id}/edit?next=${encodeURIComponent(`/play/${publicGame.code}`)}`
            : undefined
        }
        onSave={g.updateSettings}
        onReset={g.resetGame}
        onReopen={g.board?.owner_id === g.userId ? g.reopenLobby : undefined}
      />
    ) : null;

  // ---- en préparation : phrases à ajouter, l'hôte lance ---------------------

  if (g.game?.status === "lobby") {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page pb-safe stagger space-y-4 pt-4 pb-12">
          {banner}
          <LobbyView
            code={publicGame.code}
            title={title}
            board={g.board}
            players={g.players}
            userId={g.userId}
            hostId={g.game.host_id}
            isMember={Boolean(g.me)}
            onAdd={g.addPhrase}
            onRemove={(id) => void g.removePhrase(id)}
            onStart={g.startGame}
            onCancel={() =>
              void g.cancelLobby().then((ok) => {
                if (ok) window.location.assign(`/boards/${publicGame.board_id}`);
              })
            }
            onJoin={g.join}
            onLeave={() => void g.leave()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <PushPrompt />
        </main>
        {settingsSheet}
      </div>
    );
  }

  // ---- lancement : les grilles arrivent (quelques instants) -----------------

  if (me && me.grid.length === 0) {
    return (
      <div className="themed min-h-dvh" style={themeStyle(theme)}>
        {header}
        <main className="page space-y-4 pt-4" aria-busy="true" aria-label={t("common.loading")}>
          {banner}
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-surface-2" />
        </main>
      </div>
    );
  }

  // ---- partie en cours ----------------------------------------------------

  const size = me ? sizeFromLength(me.grid.length) : publicGame.grid_size;
  const missing = me ? cellsToBingo(me.checked, size) : size;
  // message d'encouragement selon l'avancement
  const myResult = me ? detectBingo(me.checked, size) : null;
  const checkedCount = me ? countChecked(me.checked) : 0;
  const status = finished
    ? t("game.status.finished")
    : myResult?.isFullCard
      ? t("game.status.full")
      : myResult?.hasBingo
        ? t("game.status.bingo")
        : missing === 1
          ? t("game.status.one")
          : checkedCount <= (me?.grid.some((c) => c.free) ? 1 : 0)
            ? t("game.status.start")
            : t("game.status.missing", { count: missing });

  return (
    <div className="themed min-h-dvh" style={themeStyle(theme)}>
      {header}

      {g.connection !== "live" && g.connection !== "connecting" && (
        <div
          role="status"
          className="sticky z-20 flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 text-sm font-semibold"
          style={{ top: "calc(var(--safe-top) + 3.5rem)" }}
        >
          <Icon
            name={g.connection === "offline" ? "wifiOff" : "refresh"}
            size={16}
            className={g.connection === "reconnecting" ? "animate-spin" : ""}
          />
          {g.connection === "offline" ? t("game.offline") : t("game.reconnecting")}
        </div>
      )}

      <main className="page space-y-4 pt-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 104px)" }}>
        {/* le bandeau (nom, mode, code) n'apparaît pas sur la grille : place au jeu */}
        {activeTab !== "grid" && banner}

        {finished && (
          <section className="animate-bounce-in card border-gold bg-gold/10 p-4 text-center">
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
            {/* la carte de bingo : progression + message + grille */}
            <section className="animate-rise rounded-[2rem] bg-gradient-to-b from-accent-soft to-surface p-3 shadow-lg shadow-violet-900/10 ring-1 ring-accent/15 sm:p-4">
              <div aria-live="polite" className="flex items-center gap-3 px-1 pb-3">
                <ProgressRing value={countChecked(me.checked)} total={me.grid.length} />
                <p key={status} className={`animate-rise min-w-0 flex-1 leading-tight font-black ${missing <= 1 && !finished ? "text-accent" : ""}`}>
                  {status}
                </p>
              </div>
              <BingoGrid
                grid={me.grid}
                checked={me.checked}
                onToggle={onCellTap}
                readOnly={mode === "validated" || finished}
                pending={pendingCells}
              />
            </section>

            {/* sous la grille : la grille ne bouge pas quand une proposition arrive ou part */}
            {mode === "peer" && !finished && (
              <ClaimsPanel
                claims={g.claims}
                players={g.players}
                userId={g.userId}
                phraseText={phraseText}
                onResolve={(id, accept) => void resolveClaim(id, accept)}
                onCancel={(claim) => void cancelClaim(claim)}
                renderReactions={claimReactions}
              />
            )}

            <PushPrompt />

            <p className="mx-auto w-fit rounded-full bg-surface-2 px-3 py-1.5 text-center text-xs font-semibold text-muted">
              💡 {t(MODE_HINT[mode])}
            </p>
            {!g.isHost && (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="min-h-[44px] px-3 text-xs font-semibold text-muted underline-offset-2 hover:underline"
                  onClick={() => {
                    if (window.confirm(t("game.leave.confirm"))) void g.leave();
                  }}
                >
                  {t("game.leave")}
                </button>
              </div>
            )}
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
              renderExtra={(player, bingo) =>
                bingo ? (
                  <ReactionBar
                    className="mt-1.5 pl-3"
                    reactions={reactions}
                    targetType="bingo"
                    targetId={player.id}
                    userId={userId}
                    onToggle={(emoji) => void toggleReaction("bingo", player.id, emoji)}
                  />
                ) : null
              }
            />
          </section>
        )}

        {activeTab === "host" && g.game && (
          <>
            <p className="text-sm text-muted">{t("game.host.intro")}</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="card lift flex min-h-[64px] w-full items-center gap-3 p-3 text-left transition active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Icon name="settings" size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{t("game.settings")}</span>
                <span className="block text-xs text-muted">{t("game.settings.hint")}</span>
              </span>
              <Icon name="back" size={18} className="rotate-180 text-muted" />
            </button>
            {mode === "peer" && !finished && (
              <ClaimsPanel
                claims={g.claims}
                players={g.players}
                userId={g.userId}
                phraseText={phraseText}
                onResolve={(id, accept) => void resolveClaim(id, accept)}
                onCancel={(claim) => void cancelClaim(claim)}
                renderReactions={claimReactions}
                showEmpty
              />
            )}
            <HostPanel
              game={g.game}
              board={g.board}
              validatedIds={g.validatedIds}
              onTogglePhrase={(id) => void g.togglePhrase(id)}
              onEnd={() => void g.endGame()}
              edit={
                g.board && g.board.owner_id === g.userId
                  ? {
                      href: `/boards/${g.board.id}/edit?next=${encodeURIComponent(`/play/${publicGame.code}`)}`,
                      // même règle que la base : verrouillé dès qu’un joueur a rejoint
                      locked: g.players.length > 0,
                    }
                  : undefined
              }
            />
            {!me && !finished && (
              <section className="card p-5">
                <h2 className="mb-3 font-extrabold">{t("game.host.alsoPlay")}</h2>
                {/* le premier joueur verrouille le bingo : l'hôte doit le savoir avant */}
                {g.board?.owner_id === g.userId && g.players.length === 0 && (
                  <p className="mb-3 rounded-xl bg-gold/15 p-3 text-sm font-semibold">⚠️ {t("game.host.alsoPlay.warning")}</p>
                )}
                <JoinForm onJoin={g.join} submitLabel={t("game.host.alsoPlay")} />
              </section>
            )}
          </>
        )}

        {activeTab === "photos" && (
          <ProofGallery
            claims={g.claims}
            players={g.players}
            phraseText={phraseText}
            renderReactions={claimReactions}
          />
        )}

        {activeTab === "invite" && (
          <section className="card animate-rise p-5">
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
        <div className="page grid gap-1 pt-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((id) => {
            const active = id === activeTab;
            const badge = id === "grid" && mode === "peer" ? toConfirmCount : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold transition active:scale-95 ${
                  active ? "bg-accent-soft text-accent" : "text-muted"
                }`}
              >
                <Icon name={TAB_META[id].icon} size={22} />
                {t(TAB_META[id].label)}
                {badge > 0 && (
                  <span className="animate-bounce-in absolute top-1 right-[calc(50%-22px)] grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-black text-on-status">
                    {badge}
                  </span>
                )}
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

      <ProposeSheet
        phrase={proposing !== null && me ? (me.grid[proposing]?.text ?? null) : null}
        onClose={() => setProposing(null)}
        onSubmit={(photo) => (proposing === null ? Promise.resolve(false) : proposeClaim(proposing, photo))}
      />

      <VictoryOverlay kind={victory} onClose={() => setVictory(null)} />
      {settingsSheet}
    </div>
  );
}
