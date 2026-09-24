"use client";

import { LiveBoard } from "@/features/issues/live-board";
import { useAuthSession } from "./use-auth-session";
import { LoadingState } from "@/components/loading-state";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/auth/navigation";

export function BoardLoginLink() {
  const params = useSearchParams();
  const next = safeNext(`/board?${params.toString()}`);
  return <Link href={next === "/board" ? "/login" : `/login?next=${encodeURIComponent(next)}`}>로그인 안내 <span aria-hidden="true">↗</span></Link>;
}

export function BoardSession({ children }: { children: React.ReactNode }) {
  const { client, session, ready, signOut, signOutError } = useAuthSession();
  if (!ready) return <LoadingState />;
  return client && session ? <LiveBoard key={session.user.id} client={client} user={session.user}
    signOut={signOut} signOutError={signOutError} /> : children;
}
