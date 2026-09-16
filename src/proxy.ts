import { NextResponse, type NextRequest } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/lib/auth/navigation";

export async function proxy(request: NextRequest) {
  const hadSession = request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
  const { client, finish } = createRouteSupabase(request);
  if (client && request.nextUrl.pathname !== "/auth/callback") {
    const { data, error } = await client.auth.getClaims();
    const origin = siteOrigin();
    if (hadSession && !data?.claims && error?.name !== "AuthRetryableFetchError" && origin
      && ["/board", "/invite"].includes(request.nextUrl.pathname)) {
      const login = new URL("/login", origin);
      login.searchParams.set("reason", "session-expired");
      login.searchParams.set("next", safeNext(request.nextUrl.pathname + request.nextUrl.search));
      return finish(NextResponse.redirect(login));
    }
  }
  return finish(NextResponse.next({ request }));
}

export const config = { matcher: ["/board/:path*", "/login", "/invite", "/auth/:path*"] };
