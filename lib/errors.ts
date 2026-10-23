import type { MessageKey } from "@/lib/i18n";

const KNOWN = [
  "not_enough_phrases",
  "game_not_found",
  "game_finished",
  "validated_mode",
  "invalid_nickname",
  "board_not_found",
  "not_authenticated",
] as const;

/**
 * Traduit une erreur Supabase / Postgres en clé i18n.
 * Les fonctions SQL lèvent des exceptions dont le message est un code
 * (ex. `raise exception 'game_finished'`).
 */
export function errorKey(error: unknown): MessageKey {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  for (const code of KNOWN) {
    if (message.includes(code)) return `errors.${code}`;
  }
  if (/anonymous sign-ins are disabled/i.test(message)) return "errors.anonymous_disabled";
  if (/failed to fetch|network|load failed/i.test(message)) return "errors.network";
  if (/JWT|not authenticated|permission denied/i.test(message)) return "errors.not_authenticated";
  return "errors.generic";
}
