"use client";

import { useCallback } from "react";
import { useT } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // repli pour les contextes non sécurisés / anciens navigateurs
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Partage natif (Web Share API) avec repli sur la copie du lien.
 * Renvoie `true` si le contenu a été partagé ou copié.
 */
export function useShare() {
  const t = useT();
  const toast = useToast();

  const copy = useCallback(
    async (url: string) => {
      const ok = await copyText(url);
      toast.show(ok ? t("common.copied") : t("errors.generic"), { tone: ok ? "success" : "error" });
      return ok;
    },
    [t, toast],
  );

  const share = useCallback(
    async (data: { title?: string; text?: string; url: string }) => {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share(data);
          return true;
        } catch (error) {
          // annulé par l'utilisateur : ne rien faire
          if (error instanceof DOMException && error.name === "AbortError") return false;
        }
      }
      return copy(data.url);
    },
    [copy],
  );

  return { share, copy };
}
