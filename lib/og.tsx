import { ImageResponse } from "next/og";
import { THEME_COLORS } from "@/lib/themes";
import type { ThemeColor } from "@/types/bingo";

export const OG_SIZE = { width: 1200, height: 630 };

/** Mini-grille décorative ; les cases « cochées » forment une diagonale. */
function DecorGrid({ accent, cell }: { accent: string; cell: number }) {
  const size = 5;
  const checked = new Set([0, 6, 12, 18, 24, 3, 9, 15]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: size * (cell + 10), gap: 10 }}>
      {Array.from({ length: size * size }, (_, i) => (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            borderRadius: cell * 0.22,
            background: checked.has(i) ? accent : "rgba(255,255,255,0.9)",
            border: checked.has(i) ? "none" : "3px solid rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {i === 12 && (
            <div style={{ width: cell * 0.36, height: cell * 0.36, borderRadius: 999, background: "white" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function renderGameOg({
  title,
  emoji,
  color,
  code,
  players,
  joinLabel,
  playersLabel,
}: {
  title: string;
  emoji: string;
  color: ThemeColor;
  code: string;
  players: number;
  joinLabel: string;
  playersLabel: string;
}) {
  const palette = THEME_COLORS[color];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 64,
          background: `linear-gradient(135deg, ${palette.light} 0%, #1c1830 100%)`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800, opacity: 0.9 }}>
            BingoBuzz
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 110, lineHeight: 1 }}>{emoji}</div>
            <div
              style={{
                fontSize: title.length > 28 ? 60 : 76,
                fontWeight: 900,
                lineHeight: 1.05,
                maxWidth: 640,
                display: "flex",
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 34, opacity: 0.85, display: "flex" }}>{joinLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                display: "flex",
                background: "white",
                color: "#1c1830",
                borderRadius: 24,
                padding: "14px 30px",
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: 10,
              }}
            >
              {code}
            </div>
            <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>{playersLabel.replace("{count}", String(players))}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <DecorGrid accent={palette.dark} cell={70} />
        </div>
      </div>
    ),
    { ...OG_SIZE, emoji: "twemoji" },
  );
}

export function renderDefaultOg({ tagline }: { tagline: string }) {
  const palette = THEME_COLORS.violet;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 80,
          background: `linear-gradient(135deg, ${palette.light} 0%, #1c1830 100%)`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 600 }}>
          <div style={{ fontSize: 96, fontWeight: 900, display: "flex" }}>BingoBuzz</div>
          <div style={{ fontSize: 44, lineHeight: 1.2, opacity: 0.9, display: "flex" }}>{tagline}</div>
        </div>
        <DecorGrid accent={palette.dark} cell={76} />
      </div>
    ),
    { ...OG_SIZE, emoji: "twemoji" },
  );
}

/** Icône de l'application (PWA, Apple touch icon). `maskable` : zone de sécurité de 20 %. */
export function renderAppIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const accent = THEME_COLORS.violet.light;
  const inner = maskable ? size * 0.6 : size * 0.72;
  const gap = inner * 0.06;
  const cell = (inner - gap * 2) / 3;
  const checked = new Set([0, 4, 8]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", width: inner, height: inner, gap }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                width: cell,
                height: cell,
                borderRadius: cell * 0.24,
                background: checked.has(i) ? "#fbbf24" : "rgba(255,255,255,0.95)",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
