"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { siteOrigin, safeNext } from "@/lib/auth/navigation";
import type { GithubStatus } from "@/lib/auth/github.server";

export function GithubLogin({ status, next }: { status: GithubStatus; next: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function login() {
    const client = getBrowserSupabase();
    const origin = siteOrigin();
    if (!client || !origin || window.location.origin !== origin) {
      setMessage("설정된 앱 주소로 접속한 뒤 다시 로그인하세요."); return;
    }
    setPending(true);
    setMessage("");
    document.cookie = `reproboard-auth-next=${encodeURIComponent(safeNext(next))}; Path=/; Max-Age=600; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${origin}/auth/callback` } });
      if (error) { setMessage("GitHub 로그인을 시작하지 못했습니다. 잠시 후 다시 시도하세요."); setPending(false); }
    } catch { setMessage("로그인 서버에 연결하지 못했습니다."); setPending(false); }
  }
  return <>
    <button className="button button-dark" onClick={login} disabled={status !== "ready" || pending} aria-describedby="login-note">
      {pending ? "GitHub로 이동 중…" : "GitHub로 로그인"}
    </button>
    <p id="login-note" className="login-note">{status === "ready" ? "GitHub 인증 후 참여한 팀으로 이동합니다." :
      status === "disabled" ? "GitHub OAuth 앱 설정이 필요합니다. 로컬 개발은 아래 합성 계정으로 계속할 수 있습니다." :
      status === "unavailable" ? "로그인 서버 상태를 확인할 수 없습니다. 잠시 후 새로고침하세요." : "로그인 환경 설정이 필요합니다. README의 인증 설정을 확인하세요."}</p>
    {message && <p role="alert">{message}</p>}
  </>;
}
