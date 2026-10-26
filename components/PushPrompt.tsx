"use client";

import { useEffect, useState } from "react";
import { usePush } from "@/hooks/usePush";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

/** Encart proposant d'activer les notifications (masquable, une seule fois). */
export function PushPrompt() {
  const t = useT();
  const toast = useToast();
  const { state, busy, enable } = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readJson<boolean>(storageKeys.pushDismissed) === true);
  }, []);

  if (dismissed || (state !== "off" && state !== "install")) return null;

  const dismiss = () => {
    writeJson(storageKeys.pushDismissed, true);
    setDismissed(true);
  };

  return (
    <section className="animate-rise card flex items-start gap-3 p-4" aria-labelledby="push-prompt-title">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl">
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="push-prompt-title" className="font-extrabold">
          {t("push.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{state === "install" ? t("push.ios") : t("push.body")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "off" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() =>
                void enable()
                  .then((ok) => ok && toast.show(t("push.enabled"), { tone: "success" }))
                  .catch(() => toast.show(t("push.error"), { tone: "error" }))
              }
            >
              <Icon name="bell" size={18} />
              {t("push.enable")}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
            {t("push.dismiss")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Réglage des notifications de l'appareil courant (page Réglages). */
export function PushSetting() {
  const t = useT();
  const toast = useToast();
  const { state, busy, enable, disable } = usePush();

  if (state === "loading") return <div className="h-12 animate-pulse rounded-xl bg-surface-2" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("push.body")}</p>
      {state === "unsupported" && <p className="text-sm font-semibold">{t("push.unsupported")}</p>}
      {state === "install" && <p className="text-sm font-semibold">{t("push.ios")}</p>}
      {state === "denied" && <p className="text-sm font-semibold">{t("push.denied")}</p>}
      {state === "on" && (
        <>
          <p className="text-sm font-semibold">{t("push.enabled")}</p>
          <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => void disable()}>
            {t("push.disable")}
          </button>
        </>
      )}
      {state === "off" && (
        <button
          type="button"
          className="btn btn-secondary w-full"
          disabled={busy}
          onClick={() => void enable().catch(() => toast.show(t("push.error"), { tone: "error" }))}
        >
          <Icon name="bell" size={20} />
          {t("push.enable")}
        </button>
      )}
    </div>
  );
}
