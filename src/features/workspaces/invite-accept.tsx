"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/features/auth/use-auth-session";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useWorkspaceCommand } from "./use-workspace-command";

const storageKey = "reproboard:pending-invite";
function inviteSnapshot() {
  try {
    const stored = sessionStorage.getItem(storageKey) || "";
    const value = window.location.hash.slice(1) || stored;
    return /^[0-9a-f]{64}$/.test(value) ? value : "";
  } catch { return "storage-error"; }
}
function subscribeInvite(change: () => void) {
  window.addEventListener("hashchange", change);
  window.addEventListener("reproboard:invite", change);
  return () => { window.removeEventListener("hashchange", change); window.removeEventListener("reproboard:invite", change); };
}

function AcceptForm({ client, token }: { client: AppSupabase; token: string }) {
  const command = useWorkspaceCommand(client);
  const router = useRouter();
  return <>
    <button className="button button-primary" disabled={command.pending} onClick={async () => {
      const result = await command.run({ operation: "accept_invite", requestId: crypto.randomUUID(), token });
      if (result) {
        sessionStorage.removeItem(storageKey);
        router.replace(`/board?workspace=${result.data.workspaceId}`);
      }
    }}>{command.pending ? "참여 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : "초대 수락하고 Member로 참여"}</button>
    <p role="status">{command.message}</p>
  </>;
}

export function InviteAccept() {
  const { client, session, ready, signOut, signOutError } = useAuthSession();
  const token = useSyncExternalStore(subscribeInvite, inviteSnapshot, () => null);
  useEffect(() => {
    // Fragment tokens never travel in HTTP URLs, OAuth next parameters or server logs.
    const fragment = window.location.hash.slice(1);
    try {
      if (/^[0-9a-f]{64}$/.test(fragment)) sessionStorage.setItem(storageKey, fragment);
      else if (fragment) sessionStorage.removeItem(storageKey);
      if (fragment) window.history.replaceState(null, "", "/invite");
    } catch { /* The external snapshot reports unavailable storage. */ }
    window.dispatchEvent(new Event("reproboard:invite"));
  }, []);
  return <section className="invite-page" aria-labelledby="invite-title">
    <p className="page-eyebrow">WORKSPACE INVITATION</p><h1 id="invite-title">팀 초대 수락</h1>
    <p>초대는 24시간 동안 한 번만 사용할 수 있습니다. 로그인한 계정이 Member로 참여합니다.</p>
    {token === null ? <p role="status">초대 링크를 확인하는 중…</p> : token === "storage-error" ? <p role="alert">브라우저 저장 공간을 사용할 수 없습니다. 이 사이트의 저장을 허용한 뒤 초대 링크를 다시 여세요.</p> : !token ?
      <p role="alert">올바른 초대 링크가 없습니다. Owner에게 받은 링크를 다시 여세요.</p> : !ready ? <p role="status">로그인을 확인하는 중…</p> :
      !client || !session ? <Link className="button button-primary" href="/login?next=%2Finvite">로그인하고 초대 계속하기</Link> : <>
        <p>현재 계정: {typeof session.user.user_metadata.display_name === "string" ? session.user.user_metadata.display_name : "로그인한 사용자"}</p>
        <AcceptForm key={`${session.user.id}/${token}`} client={client} token={token} />
        <button className="button button-secondary" onClick={signOut}>로그아웃</button>
        {signOutError && <p role="alert">{signOutError}</p>}
      </>}
    <p><Link href="/board">보드로 돌아가기</Link></p>
  </section>;
}
