import { LEGAL } from "@/lib/legal";

/**
 * Accueil terminé et version actuelle des conditions acceptée
 * (lu dans user_metadata du JWT ; changer LEGAL.version oblige à ré-accepter).
 */
export function hasCompletedOnboarding(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  return Boolean(meta.onboarded_at) && meta.terms_version === LEGAL.version;
}
