"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/auth/navigation";

export function useAuthSession() {
  const [client] = useState(getBrowserSupabase);
  const [state, setState] = useState<{ session: Session | null; ready: boolean }>({ session: null, ready: !client });
  const [signOutError, setSignOutError] = useState("");
  const intentionalSignOut = useRef(false);
  const cache = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const next = safeNext(`${pathname}?${params.toString()}`);
  useEffect(() => {
    if (!client) return;
    let userId: string | undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const expired = !!userId && !session && !intentionalSignOut.current;
      if (userId !== session?.user.id) {
        void cache.cancelQueries();
        cache.clear();
        userId = session?.user.id;
      }
      setState({ session, ready: true });
      if (expired) router.replace(`/login?reason=session-expired&next=${encodeURIComponent(next)}`);
    });
    return () => data.subscription.unsubscribe();
  }, [client, cache, router, next]);

  async function signOut() {
    if (!client) return;
    intentionalSignOut.current = true;
    setSignOutError("");
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/login?reason=signed-out");
      router.refresh();
    } catch {
      intentionalSignOut.current = false;
      setSignOutError("로그아웃하지 못했습니다. 다시 시도하세요.");
    }
  }
  return { client, ...state, signOut, signOutError };
}
