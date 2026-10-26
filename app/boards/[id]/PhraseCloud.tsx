"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Icon } from "@/components/Icon";
import { frenchSpacing } from "@/lib/phrases";
import type { Phrase } from "@/types/bingo";

/** Phrases du bingo : repliées par défaut, en petites pastilles discrètes. */
export function PhraseCloud({ phrases }: { phrases: Phrase[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between text-sm font-bold text-muted"
      >
        <span>
          {t("board.phrases.title")} ({phrases.length})
        </span>
        <Icon name="back" size={18} className={`transition ${open ? "rotate-90" : "-rotate-90"}`} />
      </button>
      {open && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {phrases.map((p, i) => (
            <li
              key={p.id}
              className="animate-rise rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted"
              style={{ animationDelay: `${Math.min(i, 20) * 15}ms` }}
            >
              {frenchSpacing(p.text)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
