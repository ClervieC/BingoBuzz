"use client";

import { useId, useState } from "react";
import { frenchSpacing } from "@/lib/phrases";
import { requiredPhraseCount } from "@/lib/random";
import type { BoardWithPhrases, GamePlayer } from "@/types/bingo";
import { BottomSheet } from "./BottomSheet";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { JoinForm } from "./JoinForm";
import { PlayerAvatar } from "./PlayerAvatar";
import { SharePanel } from "./SharePanel";

/**
 * Salle de préparation : les membres ajoutent des phrases au bingo, l'hôte
 * lance la partie quand il y en a assez (chacun reçoit alors sa grille).
 */
export function LobbyView({
  code,
  title,
  board,
  players,
  userId,
  hostId,
  isMember,
  onAdd,
  onRemove,
  onEdit,
  onStart,
  onCancel,
  onJoin,
  onLeave,
  onOpenSettings,
}: {
  code: string;
  title: string;
  board: BoardWithPhrases | null;
  players: GamePlayer[];
  userId: string | null;
  hostId: string;
  /** a une place dans la partie (l'hôte peut aussi ne faire qu'animer) */
  isMember: boolean;
  onAdd: (text: string) => Promise<boolean>;
  onRemove: (phraseId: string) => void;
  /** modifier une phrase (l'hôte toutes, chacun les siennes) ; true si enregistrée */
  onEdit: (phraseId: string, text: string) => Promise<boolean>;
  onStart: () => Promise<boolean>;
  onCancel: () => void;
  onJoin: (nickname: string, avatar: string) => Promise<void>;
  onLeave: () => void;
  /** hôte : mode, fin, durée, modification du bingo */
  onOpenSettings: () => void;
}) {
  const t = useT();
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const me = players.find((p) => p.user_id === userId) ?? null;

  const isHost = userId === hostId;
  const phrases = board?.phrases ?? [];
  const required = board ? requiredPhraseCount(board.grid_size, board.free_center) : 0;
  const missing = Math.max(0, required - phrases.length);
  const nameOf = (uid: string | null | undefined) => players.find((p) => p.user_id === uid)?.nickname ?? null;
  const hostName = nameOf(hostId) ?? t("lobby.hostFallback");
  // les plus récentes en haut : on voit tout de suite ce que les autres ajoutent
  const ordered = [...phrases].sort((a, b) => b.position - a.position);

  async function submit() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    if (await onAdd(text)) setDraft("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {/* avancement */}
      <section className="animate-rise card p-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-black">✍️ {t("lobby.title")}</h2>
          <span className="font-black tabular-nums">
            {phrases.length}/{required}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${required ? Math.min(100, (phrases.length / required) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          {missing > 0
            ? t("lobby.missing", { count: missing })
            : isHost
              ? t("lobby.ready.host")
              : t("lobby.ready", { name: hostName })}
        </p>
      </section>

      {/* ajout d'une phrase */}
      {isMember || isHost ? (
        <form
          className="card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor={inputId} className="label">
            {t("lobby.add.label")}
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              className="input min-w-0 flex-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("editor.phrases.add.placeholder")}
              maxLength={120}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary shrink-0 px-4" disabled={!draft.trim() || adding}>
              <Icon name="plus" size={20} />
              <span className="sr-only sm:not-sr-only">{t("editor.phrases.add")}</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{t("lobby.add.hint")}</p>
        </form>
      ) : null}

      {/* phrases du bingo */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted uppercase">
          {t("lobby.phrases", { count: phrases.length })}
        </h2>
        {phrases.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("lobby.empty")}</p>
        ) : (
          <ul className="card divide-y divide-border">
            {ordered.map((phrase) => {
              const author = phrase.added_by && phrase.added_by !== hostId ? nameOf(phrase.added_by) : null;
              const mine = phrase.added_by === userId;
              const removable = isHost || mine;
              if (editing?.id === phrase.id) {
                return (
                  <li key={phrase.id} className="px-3 py-2">
                    <form
                      className="flex items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = editing.text.trim();
                        if (!text || text === phrase.text || (await onEdit(phrase.id, text))) setEditing(null);
                      }}
                    >
                      <input
                        className="input min-w-0 flex-1 py-2 text-sm"
                        value={editing.text}
                        onChange={(e) => setEditing({ id: phrase.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                        }}
                        maxLength={120}
                        aria-label={t("lobby.edit", { text: phrase.text })}
                        autoFocus
                        enterKeyHint="done"
                      />
                      <button type="submit" className="icon-btn shrink-0 text-accent" aria-label={t("common.save")}>
                        <Icon name="check" size={20} strokeWidth={3} />
                      </button>
                      <button type="button" className="icon-btn -mr-1 shrink-0 text-muted" aria-label={t("common.close")} onClick={() => setEditing(null)}>
                        <Icon name="close" size={18} />
                      </button>
                    </form>
                  </li>
                );
              }
              return (
                <li key={phrase.id} className="animate-rise flex min-h-[48px] items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm font-semibold">{frenchSpacing(phrase.text)}</span>
                  {(author || mine) && (
                    <span className={`chip shrink-0 ${mine ? "" : "bg-surface-2 text-muted"}`}>
                      {mine ? t("game.ranking.you") : author}
                    </span>
                  )}
                  {removable && (
                    <button
                      type="button"
                      className="icon-btn shrink-0 text-muted"
                      aria-label={t("lobby.edit", { text: phrase.text })}
                      onClick={() => setEditing({ id: phrase.id, text: phrase.text })}
                    >
                      <Icon name="edit" size={18} />
                    </button>
                  )}
                  {removable && (
                    <button
                      type="button"
                      className="icon-btn -mr-1 shrink-0 text-muted"
                      aria-label={t("editor.phrases.remove", { text: phrase.text })}
                      onClick={() => onRemove(phrase.id)}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* membres */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-extrabold">{t("lobby.members", { count: players.length })}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInviteOpen(true)}>
            <Icon name="share" size={18} />
            {t("game.tabs.invite")}
          </button>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted">{t("lobby.members.empty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {players.map((p) =>
              p.user_id === userId ? (
                // moi : touche pour changer de pseudo ou d'emoji tant que la partie n'a pas commencé
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="animate-bounce-in chip gap-1.5 pl-1 ring-2 ring-accent"
                    aria-label={t("lobby.profile.edit")}
                  >
                    <PlayerAvatar userId={p.user_id} avatar={p.avatar} size={24} />
                    {p.nickname}
                    {p.user_id === hostId && <span aria-hidden> 👑</span>}
                    <Icon name="edit" size={14} />
                  </button>
                </li>
              ) : (
                <li key={p.id} className="animate-bounce-in chip gap-1.5 pl-1">
                  <PlayerAvatar userId={p.user_id} avatar={p.avatar} size={24} />
                  {p.nickname}
                  {p.user_id === hostId && <span aria-hidden> 👑</span>}
                </li>
              ),
            )}
          </ul>
        )}
        {me && <p className="mt-2 text-xs text-muted">{t("lobby.profile.hint")}</p>}
      </section>

      {/* hôte : jouer aussi, lancer, annuler */}
      {isHost ? (
        <>
          {!isMember && (
            <section className="card p-4">
              <h2 className="mb-3 font-extrabold">{t("game.host.alsoPlay")}</h2>
              <JoinForm onJoin={onJoin} submitLabel={t("game.host.alsoPlay")} />
            </section>
          )}
          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full text-lg"
              disabled={missing > 0 || starting}
              onClick={async () => {
                setStarting(true);
                if (!(await onStart())) setStarting(false);
              }}
            >
              🚀 {starting ? t("lobby.starting") : t("lobby.start")}
            </button>
            {missing > 0 && <p className="text-center text-xs text-muted">{t("lobby.start.disabled", { count: missing })}</p>}
            <button type="button" className="btn btn-ghost w-full" onClick={onOpenSettings}>
              <Icon name="settings" size={20} />
              {t("game.settings")}
            </button>
            <div className="flex justify-center">
              <button
                type="button"
                className="min-h-[44px] px-3 text-xs font-semibold text-muted underline-offset-2 hover:underline"
                onClick={() => {
                  if (window.confirm(t("lobby.cancel.confirm"))) onCancel();
                }}
              >
                {t("lobby.cancel")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold text-muted">⏳ {t("lobby.waiting", { name: hostName })}</p>
          <button
            type="button"
            className="min-h-[44px] px-3 text-xs font-semibold text-muted underline-offset-2 hover:underline"
            onClick={() => {
              if (window.confirm(t("game.leave.confirm"))) onLeave();
            }}
          >
            {t("game.leave")}
          </button>
        </div>
      )}

      <BottomSheet open={profileOpen && me !== null} onClose={() => setProfileOpen(false)} title={t("lobby.profile.edit")}>
        {me && (
          <JoinForm
            initialNickname={me.nickname}
            initialAvatar={me.avatar}
            submitLabel={t("common.save")}
            onJoin={async (name, avatar) => {
              await onJoin(name, avatar);
              setProfileOpen(false);
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t("game.share.title")}>
        <SharePanel code={code} title={title} />
      </BottomSheet>
    </div>
  );
}
