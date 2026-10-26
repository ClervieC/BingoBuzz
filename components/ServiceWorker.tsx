"use client";

import { useEffect } from "react";

/** Enregistre /sw.js (notifications push, page hors ligne) en production. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // pas de service worker : l'appli fonctionne sans push ni page hors ligne
    });
  }, []);
  return null;
}
