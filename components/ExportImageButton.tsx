"use client";

import { useState, type RefObject } from "react";
import { useT } from "./I18nProvider";
import { Icon, type IconName } from "./Icon";
import { useToast } from "./Toast";

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "bingo"
  );
}

/**
 * Exporte un nœud DOM en PNG (html-to-image), format adapté aux stories.
 * Sur mobile : feuille de partage native avec le fichier ; sinon téléchargement.
 */
export function ExportImageButton({
  targetRef,
  title,
  className = "btn btn-ghost btn-sm",
  label,
  icon = "image",
}: {
  targetRef: RefObject<HTMLElement | null>;
  title: string;
  className?: string;
  label?: string;
  icon?: IconName;
}) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exportImage() {
    const node = targetRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const background = getComputedStyle(document.body).backgroundColor;
      const blob = await toBlob(node, {
        pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        backgroundColor: background,
        cacheBust: true,
        // retire les animations en cours de la capture
        style: { animation: "none" },
      });
      if (!blob) throw new Error("toBlob");

      const file = new File([blob], `${slug(title)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.show(t("export.error"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={exportImage} disabled={busy} aria-busy={busy}>
      <Icon name={icon} size={20} />
      {label ?? t("export.image")}
    </button>
  );
}
