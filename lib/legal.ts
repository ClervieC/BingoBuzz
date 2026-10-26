/**
 * Informations légales affichées dans la politique de confidentialité et les
 * conditions d'utilisation.
 *
 * ⚠️ À COMPLÉTER avant la mise en ligne : les champs entre crochets.
 * Ces textes sont un point de départ ; faites-les relire par un juriste.
 */
export const LEGAL = {
  /** version des conditions : changer la date oblige chacun à les ré-accepter (voir proxy) */
  version: "2026-10-26",
  updatedAt: "2026-10-26",

  /** éditeur du service (personne physique ou société) */
  publisher: "[Nom ou raison sociale de l'éditeur]",
  publisherAddress: "[Adresse postale]",
  /** adresse pour exercer ses droits RGPD */
  contactEmail: "[contact@votre-domaine.fr]",

  /** région du projet Supabase (Dashboard → Project Settings → General) */
  dataRegion: "[Union européenne — ex. Francfort (eu-central-1)]",
} as const;

export const PROCESSORS = [
  { name: "Supabase Inc.", role: "auth+db", url: "https://supabase.com/privacy" },
  { name: "Vercel Inc.", role: "hosting", url: "https://vercel.com/legal/privacy-policy" },
  { name: "Google LLC", role: "google", url: "https://policies.google.com/privacy" },
] as const;
