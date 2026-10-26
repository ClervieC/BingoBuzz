"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { BoardTile } from "@/components/BoardTile";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import type { Board } from "@/types/bingo";

/** Grille « Mes bingos » : tuile de création, recherche (si la collection est grande), tuiles. */
export function LibraryGrid({ boards }: { boards: Board[] }) {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? boards.filter((b) => b.title.toLocaleLowerCase().includes(q)) : boards;
  }, [boards, query]);

  return (
    <div className="space-y-4">
      {boards.length > 6 && (
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t("library.search")}
          </label>
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          />
          <input
            id={searchId}
            type="search"
            className="input rounded-full pl-11"
            placeholder={t("library.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
        </div>
      )}

      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!query && (
          <li>
            <Link
              href="/create"
              className="wiggle-parent lift flex h-full min-h-[136px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/40 bg-surface p-4 text-center font-extrabold text-accent transition active:scale-[0.97]"
            >
              <span className="wiggle grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-fg">
                <Icon name="plus" />
              </span>
              {t("library.new")}
            </Link>
          </li>
        )}
        {filtered.map((board) => (
          <li key={board.id}>
            <BoardTile
              board={board}
              meta={t("library.updated", { date: dateFormat.format(new Date(board.updated_at)) })}
            />
          </li>
        ))}
      </ul>

      {query && filtered.length === 0 && (
        <p className="animate-rise py-6 text-center text-muted">{t("library.noResults", { query: query.trim() })}</p>
      )}
    </div>
  );
}
