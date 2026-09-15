"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LiveBoard } from "@/features/issues/live-board";

export function BoardSession({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [client] = useState(getBrowserSupabase);
  const cache = useQueryClient();
  useEffect(() => {
    if (!client) return;
    let userId: string | undefined;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (userId !== next?.user.id) {
        // Consume AbortSignals in reads, then discard data/drafts across identities.
        void cache.cancelQueries();
        cache.clear();
        userId = next?.user.id;
      }
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, [client, cache]);
  return client && session ? <LiveBoard key={session.user.id} client={client} user={session.user} /> : children;
}
