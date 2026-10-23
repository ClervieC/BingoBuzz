"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

export type BrowserSupabase = SupabaseClient<Database>;

let client: BrowserSupabase | undefined;

/** Client Supabase du navigateur (singleton). Session stockée en cookies, partagée avec le serveur. */
export function getSupabaseBrowserClient(): BrowserSupabase {
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
