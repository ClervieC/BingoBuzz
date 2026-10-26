"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image";
import { frenchSpacing } from "@/lib/phrases";
import { BottomSheet } from "./BottomSheet";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

/**
 * Mode « validé par le groupe » : « J'ai vu ça ! » avec une photo de preuve
 * facultative (appareil photo ou galerie, compressée avant l'envoi).
 */
export function ProposeSheet({
  phrase,
  onClose,
  onSubmit,
}: {
  /** texte de la phrase ; null = fenêtre fermée */
  phrase: string | null;
  onClose: () => void;
  onSubmit: (photo: Blob | null) => Promise<boolean>;
}) {
  const t = useT();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // réinitialise à chaque ouverture
  useEffect(() => {
    if (phrase === null) {
      setPhoto(null);
      setBusy(false);
    }
  }, [phrase]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
    } catch {
      toast.show(t("errors.invalid_photo"), { tone: "error" });
    }
  }

  async function submit() {
    setBusy(true);
    const ok = await onSubmit(photo);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <BottomSheet open={phrase !== null} onClose={onClose} title={`👀 ${t("game.peer.sheet.title")}`}>
      {phrase !== null && (
        <div className="space-y-4">
          <p className="text-2xl leading-snug font-black">« {frenchSpacing(phrase)} »</p>
          <p className="text-sm text-muted">{t("game.peer.sheet.hint")}</p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {preview ? (
            <div className="animate-bounce-in relative overflow-hidden rounded-2xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={t("game.peer.photo.preview")} className="max-h-[40dvh] w-full object-contain" />
              <div className="absolute right-2 bottom-2 flex gap-2">
                <button type="button" className="btn btn-sm bg-surface/90 backdrop-blur" onClick={() => inputRef.current?.click()}>
                  <Icon name="image" size={18} />
                  {t("game.peer.photo.change")}
                </button>
                <button type="button" className="btn btn-sm bg-surface/90 text-danger backdrop-blur" onClick={() => setPhoto(null)}>
                  <Icon name="trash" size={18} />
                  {t("game.peer.photo.remove")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="wiggle-parent flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 py-6 font-bold text-accent transition active:scale-[0.98]"
            >
              <span className="wiggle text-2xl" aria-hidden>
                📷
              </span>
              {t("game.peer.photo.add")}
            </button>
          )}

          <button type="button" className="btn btn-primary w-full" onClick={submit} disabled={busy}>
            {busy && photo ? t("game.peer.uploading") : photo ? t("game.peer.submitWithPhoto") : t("game.peer.submit")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
