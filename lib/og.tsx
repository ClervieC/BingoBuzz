import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { THEME_COLORS } from "@/lib/themes";
import type { ThemeColor } from "@/types/bingo";

export const OG_SIZE = { width: 1200, height: 630 };

/** Logo (version texte clair, pour fond sombre) en data URL, lu une seule fois. */
const brand = (async () => {
  const read = async (file: string) =>
    `data:image/png;base64,${(await readFile(join(process.cwd(), "public/brand", file))).toString("base64")}`;
  const [icon, wordmark, logo] = await Promise.all([read("icon.png"), read("wordmark-dark.png"), read("logo-dark.png")]);
  return { icon, wordmark, logo };
})();

/** Mini-grille décorative ; les cases « cochées » forment des diagonales. */
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

export async function renderGameOg({
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
  const { icon, wordmark } = await brand;
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} width={64} height={64} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmark} height={44} width={220} alt="bingoBuzz" />
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
            <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>
              {playersLabel.replace("{count}", String(players))}
            </div>
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

export async function renderDefaultOg({ tagline }: { tagline: string }) {
  const palette = THEME_COLORS.violet;
  const { logo } = await brand;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 560 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={420} height={332} alt="bingoBuzz" />
          <div style={{ fontSize: 40, lineHeight: 1.2, opacity: 0.92, display: "flex" }}>{tagline}</div>
        </div>
        <DecorGrid accent={palette.dark} cell={76} />
      </div>
    ),
    { ...OG_SIZE, emoji: "twemoji" },
  );
}
