/** URL publique du site, sans slash final. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  if (typeof window !== "undefined") return window.location.origin;
  return "https://bingobuzz.vercel.app";
}

/** Côté navigateur, l'origine réelle prime (aperçus Vercel, réseau local…). */
export function getClientOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : getSiteUrl();
}

export function gameUrl(code: string): string {
  return `${getClientOrigin()}/play/${code}`;
}
