import { NextResponse, type NextRequest } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/lib/auth/navigation";

export async function GET(request: NextRequest) {
  const { client, finish } = createRouteSupabase(request);
  const origin = siteOrigin();
  if (!origin) return finish(NextResponse.json({ error: "로그인 주소 설정을 확인하세요." }, { status: 503 }));
  const next = safeNext(request.cookies.get("reproboard-auth-next")?.value);
  const code = request.nextUrl.searchParams.get("code");
  let destination = `/login?reason=callback-error&next=${encodeURIComponent(next)}`;
  if (client && code && !request.nextUrl.searchParams.has("error")) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) destination = next;
  }
  // Never display OAuth error_description, code, tokens or provider response text.
  const response = finish(NextResponse.redirect(new URL(destination, origin)));
  response.cookies.set("reproboard-auth-next", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}
