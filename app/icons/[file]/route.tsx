import { notFound } from "next/navigation";
import { renderAppIcon } from "@/lib/og";

/** Icônes PNG du manifest PWA, générées au build. */
const ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type IconFile = keyof typeof ICONS;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const icon = ICONS[file as IconFile];
  if (!icon) notFound();
  return renderAppIcon(icon.size, { maskable: icon.maskable });
}
