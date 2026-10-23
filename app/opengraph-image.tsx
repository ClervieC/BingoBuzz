import { createTranslator, DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";
import { OG_SIZE, renderDefaultOg } from "@/lib/og";

export const alt = "BingoBuzz";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const t = createTranslator(getDictionary(DEFAULT_LOCALE));
  return renderDefaultOg({ tagline: t("app.tagline") });
}
