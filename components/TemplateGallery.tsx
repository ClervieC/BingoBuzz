"use client";

import { useState } from "react";
import { TEMPLATE_CATEGORIES, type Board, type TemplateCategory } from "@/types/bingo";
import { BoardTile } from "./BoardTile";
import { useT } from "./I18nProvider";

const CATEGORY_EMOJI: Record<TemplateCategory, string> = {
  work: "💼",
  party: "🥳",
  family: "👪",
  sport: "⚽",
  tv: "📺",
  travel: "✈️",
};

/** Modèles fournis, filtrables par catégorie. */
export function TemplateGallery({ templates }: { templates: Board[] }) {
  const t = useT();
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const available = TEMPLATE_CATEGORIES.filter((c) => templates.some((b) => b.category === c));
  const shown = category ? templates.filter((b) => b.category === category) : templates;

  return (
    <>
      {available.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("library.templates")}>
          {[null, ...available].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-[40px] shrink-0 rounded-full border-2 px-3 text-sm font-bold transition active:scale-95 ${
                category === c ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"
              }`}
            >
              {c ? `${CATEGORY_EMOJI[c]} ${t(`category.${c}`)}` : t("category.all")}
            </button>
          ))}
        </div>
      )}
      <ul
        key={category ?? "all"}
        className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>li:last-child:nth-child(odd)]:col-span-2"
      >
        {shown.map((board) => (
          <li key={board.id}>
            <BoardTile board={board} />
          </li>
        ))}
      </ul>
    </>
  );
}
