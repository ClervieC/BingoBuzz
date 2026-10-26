import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import type { Translator } from "@/lib/i18n";
import { THEME_COLORS } from "@/lib/themes";
import type { BoardWithPhrases } from "@/types/bingo";

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">
      {children}
    </span>
  );
}

/** En-tête aux couleurs du bingo : emoji, titre, pastilles d’infos. */
export function BoardHero({ board, gamesCount, t }: { board: BoardWithPhrases; gamesCount: number; t: Translator }) {
  const palette = THEME_COLORS[board.theme.color];
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${palette.light}, #1c1830)` }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-6 -right-4 text-[7rem] leading-none opacity-15">
        {board.theme.emoji}
      </span>
      <span aria-hidden className="animate-bounce-in inline-block text-6xl leading-none">
        {board.theme.emoji}
      </span>
      {board.is_template && (
        <span className="mt-3 block w-fit rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-black">
          {t("board.template")}
        </span>
      )}
      <h1 className="relative mt-3 text-[1.75rem] leading-tight font-black break-words text-balance">
        {board.title}
      </h1>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <Pill>
          <Icon name="grid" size={16} />
          {board.grid_size}×{board.grid_size}
        </Pill>
        <Pill>{t("board.chip.phrases", { count: board.phrases.length })}</Pill>
        {board.free_center && <Pill>⭐ {t("board.chip.free")}</Pill>}
        {gamesCount > 0 && <Pill>🎮 {t("board.stats.games", { count: gamesCount })}</Pill>}
      </div>
    </section>
  );
}
