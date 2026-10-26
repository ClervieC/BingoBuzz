// Génère toutes les déclinaisons du logo à partir de assets/brand/logo-source.png.
// Usage : npm run brand   (à relancer si le logo source change)
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets/brand/logo-source.png");
const out = (p) => {
  const file = join(ROOT, p);
  mkdirSync(dirname(file), { recursive: true });
  return file;
};

// zones mesurées dans l'image source (1254×1254, fond transparent)
const ICON = { left: 358, top: 186, width: 620, height: 593 };
const WORDMARK = { left: 82, top: 830, width: 1090, height: 218 };
const FULL = { left: 82, top: 186, width: 1090, height: 862 };
const BACKGROUND = "#f3eefe"; // fond des icônes opaques (iOS, maskable)
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Icône recadrée dans un carré transparent (marge `pad` en proportion). */
async function squareIcon(size, pad = 0.04) {
  const inner = Math.round(size * (1 - pad * 2));
  const icon = await sharp(SOURCE).extract(ICON).resize(inner, inner, { fit: "contain", background: TRANSPARENT }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: icon, gravity: "center" }])
    .png();
}

/** Icône posée sur un fond opaque (iOS refuse la transparence ; Android « maskable »). */
async function opaqueIcon(size, scale) {
  const inner = Math.round(size * scale);
  const icon = await sharp(SOURCE).extract(ICON).resize(inner, inner, { fit: "contain", background: TRANSPARENT }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: icon, gravity: "center" }])
    .flatten({ background: BACKGROUND })
    .png();
}

/** Version pour fond sombre : le mot « bingo » (violet très foncé) passe en clair. */
async function lightenDarkText(region) {
  const { data, info } = await sharp(SOURCE).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (data[i + 3] > 0 && lum < 45) {
      data[i] = 241;
      data[i + 1] = 238;
      data[i + 2] = 251;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

const tasks = [
  // icône seule
  ["public/brand/icon.png", (await squareIcon(256, 0)).toBuffer()],
  ["app/icon.png", (await squareIcon(256, 0.02)).toBuffer()],
  // texte « bingoBuzz » (hauteur 96 px = net jusqu'à 3x pour un affichage à 32 px)
  ["public/brand/wordmark.png", sharp(SOURCE).extract(WORDMARK).resize({ height: 96 }).png().toBuffer()],
  ["public/brand/wordmark-dark.png", (await lightenDarkText(WORDMARK)).resize({ height: 96 }).png().toBuffer()],
  // logo complet empilé
  ["public/brand/logo.png", sharp(SOURCE).extract(FULL).resize({ width: 600 }).png().toBuffer()],
  ["public/brand/logo-dark.png", (await lightenDarkText(FULL)).resize({ width: 600 }).png().toBuffer()],
  // iOS : écran d'accueil (180×180, opaque)
  ["app/apple-icon.png", (await opaqueIcon(180, 0.78)).toBuffer()],
  // PWA / Android
  ["public/icons/icon-192.png", (await squareIcon(192)).toBuffer()],
  ["public/icons/icon-512.png", (await squareIcon(512)).toBuffer()],
  ["public/icons/maskable-512.png", (await opaqueIcon(512, 0.62)).toBuffer()],
];

for (const [path, buffer] of tasks) {
  await sharp(await buffer).toFile(out(path));
  console.log("✓", path);
}
