"use client";

import { useEffect, useState } from "react";

/** QR code SVG (bibliothèque `qrcode` chargée à la demande). */
export function QrCode({ value, label, size = 200 }: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) => QR.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      role="img"
      aria-label={label}
      className="grid place-items-center rounded-2xl bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
      style={{ width: size, height: size }}
      // SVG généré localement par la bibliothèque qrcode à partir de notre propre URL
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
