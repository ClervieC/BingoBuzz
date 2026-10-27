import type { CSSProperties } from "react";
import { CARD_STYLES, type BoardTheme, type CardStyle, type ThemeColor } from "@/types/bingo";

interface Palette {
  /** couleur d'accent en mode clair / sombre */
  light: string;
  dark: string;
  /** fond doux (cases cochées, badges) */
  softLight: string;
  softDark: string;
}

export const THEME_COLORS: Record<ThemeColor, Palette> = {
  violet: { light: "#7c3aed", dark: "#a78bfa", softLight: "#ede9fe", softDark: "#2e1f5e" },
  blue: { light: "#2563eb", dark: "#60a5fa", softLight: "#dbeafe", softDark: "#172b54" },
  teal: { light: "#0f766e", dark: "#2dd4bf", softLight: "#ccfbf1", softDark: "#123b38" },
  green: { light: "#15803d", dark: "#4ade80", softLight: "#dcfce7", softDark: "#163a24" },
  orange: { light: "#c2410c", dark: "#fb923c", softLight: "#ffedd5", softDark: "#45230f" },
  red: { light: "#dc2626", dark: "#f87171", softLight: "#fee2e2", softDark: "#4a1717" },
  pink: { light: "#db2777", dark: "#f472b6", softLight: "#fce7f3", softDark: "#4a1630" },
  slate: { light: "#334155", dark: "#cbd5e1", softLight: "#e2e8f0", softDark: "#273244" },
};

export const THEME_COLOR_NAMES = Object.keys(THEME_COLORS) as ThemeColor[];

export const THEME_EMOJIS = [
  "🎉", "💼", "💍", "🎄", "🎤", "✈️", "📺", "🏫", "⚽", "🍕",
  "🎂", "🏖️", "🎮", "🐶", "🍷", "🎓", "🚗", "🏠", "💬", "🔥",
];

export const DEFAULT_THEME: BoardTheme = { emoji: "🎉", color: "violet" };

export function normalizeTheme(theme: Partial<BoardTheme> | null | undefined): BoardTheme {
  const color = theme?.color && theme.color in THEME_COLORS ? theme.color : DEFAULT_THEME.color;
  const emoji = typeof theme?.emoji === "string" && theme.emoji.length > 0 ? theme.emoji : DEFAULT_THEME.emoji;
  const style: CardStyle =
    theme?.style && (CARD_STYLES as readonly string[]).includes(theme.style) ? theme.style : "classic";
  return { emoji, color, style };
}

/**
 * Variables CSS d'un thème. À combiner avec la classe `themed` (globals.css)
 * qui choisit la variante claire ou sombre selon prefers-color-scheme.
 */
export function themeStyle(theme: Partial<BoardTheme> | null | undefined): CSSProperties {
  const palette = THEME_COLORS[normalizeTheme(theme).color];
  return {
    "--accent-l": palette.light,
    "--accent-d": palette.dark,
    "--accent-soft-l": palette.softLight,
    "--accent-soft-d": palette.softDark,
  } as CSSProperties;
}
