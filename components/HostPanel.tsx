"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { BoardWithPhrases, Game } from "@/types/bingo";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

/** Panneau de l'hôte : validation des phrases (mode validé) et fin de partie. */
export function HostPanel({
  game,
  board,
  validatedIds,
  onTogglePhrase,
  onEnd,
  edit,
}: {
  game: Game;
  board: BoardWithPhrases | null;
  validatedIds: ReadonlySet<string>;
  onTogglePhrase: (phraseId: string) => void;
  onEnd: () => void;
  /** l’hôte possède le bingo : lien d’édition, verrouillé dès qu’un joueur a rejoint */
  edit?: { href: string; locked: boolean };
}) {
  const t = useT();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const finished = game.status === "finished";

  const phrases = useMemo(() => {
    const list = board?.phrases ?? [];
    const q = query.trim().toLocaleLowerCase();
    const filtered = q ? list.filter((p) => p.text.toLocaleLowerCase().includes(q)) : list;
    // phrases non validées d'abord, l'ordre du bingo ensuite
    return [...filtered].sort(
      (a, b) => Number(validatedIds.has(a.id)) - Number(validatedIds.has(b.id)) || a.position - b.position,
    );
  }, [board, query, validatedIds]);

  return (
    <div className="space-y-5">
      <p className="chip">
        <Icon name="megaphone" size={16} />
        {t("game.host.youAreHost")}
      </p>

      {edit && !finished &&
        (edit.locked ? (
          <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">{t("game.host.locked")}</p>
        ) : (
          <div className="card flex items-center gap-3 p-4">
            <p className="min-w-0 flex-1 text-sm text-muted">{t("game.host.edit.hint")}</p>
            <Link href={edit.href} className="btn btn-secondary btn-sm shrink-0">
              <Icon name="edit" size={18} />
              {t("game.host.edit")}
            </Link>
          </div>
        ))}

      {game.mode === "validated" ? (
        <section>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-extrabold">{t("game.host.validate.title")}</h2>
            <span className="text-sm font-bold text-muted">
              {t("game.host.validatedCount", { count: validatedIds.size })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{t("game.host.validate.hint")}</p>

          <label htmlFor={searchId} className="sr-only">
            {t("game.host.validate.search")}
          </label>
          <div className="relative mt-3">
            <Icon name="search" size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              id={searchId}
              type="search"
              className="input pl-10"
              placeholder={t("game.host.validate.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              enterKeyHint="search"
            />
          </div>

          {!board ? (
            <div className="mt-3 h-40 animate-pulse rounded-2xl bg-surface-2" />
          ) : (
            <ul className="mt-3 space-y-2">
              {phrases.map((p) => {
                const done = validatedIds.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={done}
                      disabled={finished}
                      onClick={() => onTogglePhrase(p.id)}
                      className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left transition active:scale-[0.99] ${
                        done ? "border-accent/50 bg-accent-soft" : "border-border bg-surface"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                          done ? "border-accent bg-accent text-accent-fg" : "border-border"
                        }`}
                      >
                        {done && <Icon name="check" size={16} strokeWidth={3} />}
                      </span>
                      <span className={`flex-1 ${done ? "text-muted line-through decoration-2" : "font-semibold"}`}>
                        {p.text}
                      </span>
                      {done && <span className="sr-only">{t("game.host.validated")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <p className="card p-4 text-muted">
          {t(game.mode === "peer" ? "game.host.peerMode" : "game.host.freeMode")}
        </p>
      )}

      {!finished && (
        <button
          type="button"
          className="btn btn-danger w-full"
          onClick={() => {
            if (window.confirm(t("game.host.end.confirm"))) onEnd();
          }}
        >
          <Icon name="flag" size={20} />
          {t("game.host.end")}
        </button>
      )}
    </div>
  );
}
