import Link from "next/link";
import { themeStyle } from "@/lib/themes";
import type { Board } from "@/types/bingo";
import { Icon } from "./Icon";

/** Tuile colorée aux couleurs d'un bingo (accueil, bibliothèque). */
export function BoardTile({ board, meta }: { board: Board; meta?: string }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="themed wiggle-parent lift flex h-full min-h-[136px] flex-col justify-between rounded-3xl bg-accent-soft p-4 transition active:scale-[0.97]"
      style={themeStyle(board.theme)}
    >
      <span aria-hidden className="wiggle inline-block w-fit text-4xl leading-none">
        {board.theme.emoji}
      </span>
      <span>
        <span className="line-clamp-2 leading-tight font-extrabold">{board.title}</span>
        <span className="mt-1 flex items-center gap-2 text-xs font-bold text-accent">
          <span className="inline-flex items-center gap-1">
            <Icon name="grid" size={14} />
            {board.grid_size}×{board.grid_size}
          </span>
          {meta && <span className="truncate font-semibold text-muted">· {meta}</span>}
        </span>
      </span>
    </Link>
  );
}
