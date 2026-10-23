import Link from "next/link";
import { themeStyle } from "@/lib/themes";
import type { Board } from "@/types/bingo";

export function BoardCard({ board, subtitle }: { board: Board; subtitle?: string }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="themed card flex min-h-[72px] items-center gap-3 p-3 transition active:scale-[0.98]"
      style={themeStyle(board.theme)}
    >
      <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl">
        {board.theme.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{board.title}</span>
        <span className="block truncate text-sm text-muted">
          {board.grid_size}×{board.grid_size}
          {subtitle ? ` · ${subtitle}` : ""}
        </span>
      </span>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
    </Link>
  );
}
