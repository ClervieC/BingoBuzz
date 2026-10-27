import type { MessageKey } from "@/lib/i18n";
import type { PlayerStats } from "@/types/bingo";

export interface Badge {
  id: string;
  emoji: string;
  /** clés i18n : badges.<id> et badges.<id>.hint */
  name: MessageKey;
  hint: MessageKey;
  /** valeur actuelle et objectif */
  value: number;
  goal: number;
}

const DEFS: { id: string; emoji: string; stat: keyof PlayerStats; goal: number }[] = [
  { id: "first_game", emoji: "🎟️", stat: "games_played", goal: 1 },
  { id: "first_bingo", emoji: "🎉", stat: "bingos", goal: 1 },
  { id: "winner", emoji: "🏆", stat: "wins", goal: 3 },
  { id: "full_card", emoji: "💯", stat: "full_cards", goal: 1 },
  { id: "host", emoji: "🎤", stat: "hosted", goal: 5 },
  { id: "creator", emoji: "✍️", stat: "boards", goal: 3 },
  { id: "eagle_eye", emoji: "🦅", stat: "claims_confirmed", goal: 10 },
  { id: "reporter", emoji: "📸", stat: "photos", goal: 5 },
  { id: "referee", emoji: "⚖️", stat: "confirmations_given", goal: 10 },
  { id: "muse", emoji: "💡", stat: "phrases_contributed", goal: 5 },
  { id: "star", emoji: "🌟", stat: "reactions_received", goal: 20 },
  { id: "social", emoji: "🤝", stat: "friends", goal: 10 },
  { id: "marathon", emoji: "🏃", stat: "games_played", goal: 25 },
];

/** Badges calculés à partir des statistiques (gagnés d'abord). */
export function computeBadges(stats: PlayerStats): Badge[] {
  return DEFS.map((d) => ({
    id: d.id,
    emoji: d.emoji,
    name: `badges.${d.id}` as MessageKey,
    hint: `badges.${d.id}.hint` as MessageKey,
    value: Number(stats[d.stat] ?? 0),
    goal: d.goal,
  })).sort((a, b) => Number(b.value >= b.goal) - Number(a.value >= a.goal));
}
