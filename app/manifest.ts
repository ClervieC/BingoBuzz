import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BingoBuzz",
    short_name: "BingoBuzz",
    description: "Le bingo des phrases qu'on entend partout : réunions, mariages, soirées télé.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4fb",
    theme_color: "#7c3aed",
    categories: ["games", "entertainment", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Créer un bingo", url: "/create" },
      { name: "Mes bingos", url: "/library" },
    ],
  };
}
