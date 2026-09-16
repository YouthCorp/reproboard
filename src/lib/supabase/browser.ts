"use client";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createBrowserClient<Database>(url, key);
  return client;
}

export type AppSupabase = SupabaseClient<Database>;
