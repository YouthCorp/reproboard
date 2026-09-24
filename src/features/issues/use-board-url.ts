"use client";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { boardHref, normalizeBoardParams, parseBoardParams, serializeBoardParams, type RawBoardParams } from "./board-url";

export function useBoardUrl(defaultWorkspaceId: string) {
  const params = useSearchParams();
  const raw = params.toString();
  const state = normalizeBoardParams(parseBoardParams(params));
  if (!state.workspace) state.workspace = defaultWorkspaceId;
  const canonical = serializeBoardParams(state).toString();
  useEffect(() => {
    // An older render must not overwrite a newer user navigation.
    if (new URLSearchParams(window.location.search).toString() === raw && canonical !== raw) {
      window.history.replaceState(null, "", `/board${canonical ? `?${canonical}` : ""}`);
    }
  }, [canonical, raw]);
  const change = useCallback((patch: Partial<RawBoardParams>, mode: "push" | "replace" = "replace") => {
    // Read at action time: a debounced search must preserve a newer filter/detail selection.
    const current = normalizeBoardParams(parseBoardParams(new URLSearchParams(window.location.search)));
    const next = normalizeBoardParams({ ...current, workspace: current.workspace || defaultWorkspaceId, ...patch });
    const href = boardHref(next);
    if (`${window.location.pathname}${window.location.search}` === href) return;
    // Next's native History integration updates useSearchParams without an RSC/data refetch.
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", href);
  }, [defaultWorkspaceId]);
  return { state, change };
}
