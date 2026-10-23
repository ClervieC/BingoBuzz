import { renderAppIcon } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS arrondit lui-même les coins : icône pleine
  return renderAppIcon(180, { maskable: true });
}
