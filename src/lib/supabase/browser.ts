"use client";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createBrowserClient<Database>(url, key, { global: { fetch: async (input, init) => {
    // Bound HTTP reads as well as commands. A timeout never proves a write was rejected.
    const response = await fetch(input, { ...init, signal: AbortSignal.any([
      ...(init?.signal ? [init.signal] : []), AbortSignal.timeout(10_000),
    ]) });
    if (response.status === 401 && String(input).includes("/rest/v1/")) window.dispatchEvent(new Event("reproboard:auth-check"));
    return response;
  } } });
  return client;
}

export type AppSupabase = SupabaseClient<Database>;
