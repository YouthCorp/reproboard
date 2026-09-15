"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DevAccount } from "@/lib/dev/accounts.server";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function DevLogin({ accounts }: { accounts: DevAccount[] }) {
  const router = useRouter();
  const [role, setRole] = useState("owner");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserSupabase();
    const account = accounts.find((item) => item.role === role);
    if (!client || !account) { setError("로컬 계정 설정을 확인하세요."); return; }
    setPending(true);
    setError("");
    try {
      const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (result.error) { setError("개발 계정 로그인에 실패했습니다. 로컬 Supabase와 계정 준비 상태를 확인하세요."); return; }
      router.push("/board");
      router.refresh();
    } catch { setError("로그인 서버에 연결하지 못했습니다."); }
    finally { setPending(false); }
  }
  return <form className="dev-login" onSubmit={login}>
    <h3>로컬 합성 계정</h3>
    <p>개발 환경 전용입니다. 실제 Supabase 세션으로 합성 팀의 데이터를 저장합니다.</p>
    <label htmlFor="dev-role">개발 계정</label>
    <select id="dev-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={pending}>
      {accounts.map((account) => <option key={account.role} value={account.role}>{account.label}</option>)}
    </select>
    <button className="button button-primary" disabled={pending}>{pending ? "로그인 중…" : "개발 계정으로 로그인"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
