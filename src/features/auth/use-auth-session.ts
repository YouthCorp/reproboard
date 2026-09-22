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
  const returnPath = useRef(next);
  useEffect(() => { returnPath.current = next; }, [next]);
  useEffect(() => {
    if (!client) return;
    let userId: string | undefined;
    let active = true, checking = false;
    async function checkSession() {
      if (!userId || checking || !navigator.onLine || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const { error } = await client!.auth.getUser();
        // Network failures keep the draft/session. Only a server auth rejection expires it.
        if (active && error && [400, 401, 403].includes(error.status ?? 0)) {
          void cache.cancelQueries(); cache.clear();
          setState({ session: null, ready: true });
          router.replace(`/login?reason=session-expired&next=${encodeURIComponent(returnPath.current)}`);
          await client!.auth.signOut({ scope: "local" });
        }
      } catch { /* A failed transport is not proof of session expiry. */ }
      finally { checking = false; }
    }
    const check = () => { void checkSession(); };
    window.addEventListener("online", check); window.addEventListener("focus", check);
    window.addEventListener("reproboard:auth-check", check);
    const timer = setInterval(check, 60_000);
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const expired = !!userId && !session && !intentionalSignOut.current;
      if (userId !== session?.user.id) {
        void cache.cancelQueries();
        cache.clear();
        userId = session?.user.id;
      }
      setState({ session, ready: true });
      if (expired) router.replace(`/login?reason=session-expired&next=${encodeURIComponent(returnPath.current)}`);
    });
    return () => {
      active = false; clearInterval(timer); data.subscription.unsubscribe();
      window.removeEventListener("online", check); window.removeEventListener("focus", check);
      window.removeEventListener("reproboard:auth-check", check);
    };
  }, [client, cache, router]);

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
