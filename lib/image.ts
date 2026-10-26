"use client";

/**
 * Redimensionne et ré-encode une photo en JPEG avant envoi.
 * - poids divisé par 10 environ (les photos de téléphone font plusieurs Mo) ;
 * - l'orientation EXIF est appliquée, puis les métadonnées sont perdues au
 *   ré-encodage : la position GPS de la photo n'est jamais envoyée.
 */
export async function compressImage(file: Blob, maxSide = 1280, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("toBlob");
    return blob;
  } finally {
    bitmap.close();
  }
}
