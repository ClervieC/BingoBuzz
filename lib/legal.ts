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
  publisher: "Clervie CAUSER",
  publisherAddress: "Particulier, coordonnées communiquées à l'hébergeur",
  /** adresse pour exercer ses droits RGPD */
  contactEmail: "clervie@bluedays.com",

  /** région du projet Supabase (Dashboard → Project Settings → General) */
  dataRegion: "West EU (Ireland) eu-west-1",
} as const;
