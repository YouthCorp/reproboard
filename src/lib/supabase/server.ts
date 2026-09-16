import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, type NextResponse } from "next/server";
import type { Database } from "./database.types";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export async function createServerSupabase() {
  const values = config();
  if (!values) return null;
  const jar = await cookies();
  return createServerClient<Database>(values.url, values.key, {
    cookies: { getAll: () => jar.getAll() },
  });
}

// Route/Proxy cookie writes and cache headers travel with the exact response returned.
export function createRouteSupabase(request: NextRequest) {
  const values = config();
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const headers = new Headers({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
  const client = values ? createServerClient<Database>(values.url, values.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, cacheHeaders) {
        for (const item of items) {
          request.cookies.set(item.name, item.value);
          writes.set(item.name, item);
        }
        for (const [key, value] of Object.entries(cacheHeaders)) headers.set(key, value);
      },
    },
  }) : null;
  return { client, finish(response: NextResponse) {
    for (const { name, value, options } of writes.values()) response.cookies.set(name, value, options);
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } };
}
