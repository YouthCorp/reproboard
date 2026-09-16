"use client";

import { LiveBoard } from "@/features/issues/live-board";
import { useAuthSession } from "./use-auth-session";
import { LoadingState } from "@/components/loading-state";

export function BoardSession({ children }: { children: React.ReactNode }) {
  const { client, session, ready, signOut, signOutError } = useAuthSession();
  if (!ready) return <LoadingState />;
  return client && session ? <LiveBoard key={session.user.id} client={client} user={session.user}
    signOut={signOut} signOutError={signOutError} /> : children;
}
