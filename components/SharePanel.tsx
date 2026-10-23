"use client";

import { useEffect, useState } from "react";
import { useShare } from "@/hooks/useShare";
import { gameUrl } from "@/lib/site";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { QrCode } from "./QrCode";

/** Code de partie, lien, QR code et partage natif. */
export function SharePanel({ code, title }: { code: string; title: string }) {
  const t = useT();
  const { share, copy } = useShare();
  // l'URL dépend de window.location : calculée après le montage
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => setUrl(gameUrl(code)), [code]);

  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-sm font-semibold text-muted">{t("game.share.code")}</p>
        <p className="mt-1 font-mono text-4xl font-black tracking-[0.25em] select-all" aria-label={code.split("").join(" ")}>
          {code}
        </p>
      </div>

      {url && (
        <div className="flex flex-col items-center gap-2">
          <QrCode value={url} label={t("game.share.qr")} size={208} />
          <p className="text-sm text-muted">{t("game.share.qr")}</p>
        </div>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!url}
          onClick={() => url && share({ title, text: t("game.share.text", { title, code }), url })}
        >
          <Icon name="share" size={20} />
          {t("common.share")}
        </button>
        <button type="button" className="btn btn-ghost w-full" disabled={!url} onClick={() => url && copy(url)}>
          <Icon name="link" size={20} />
          {t("common.copyLink")}
        </button>
        {url && <p className="truncate text-sm text-muted">{url.replace(/^https?:\/\//, "")}</p>}
      </div>
    </div>
  );
}
