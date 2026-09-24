"use client";
import { useEffect, useRef, useState } from "react";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import { priorities, severities } from "./fields";
import { normalizeBoardParams, parseBoardParams, type BoardParams, type RawBoardParams } from "./board-url";

export const searchDelay = 300;
export function BoardFilters({ client, workspaceId, state, change }: {
  client: AppSupabase; workspaceId: string; state: BoardParams; change: (patch: Partial<RawBoardParams>) => void;
}) {
  const members = useMembers(client, workspaceId);
  // Only the not-yet-committed input lives here; URL owns every applied condition.
  const [draft, setDraft] = useState(state.q), [observed, setObserved] = useState(state.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), composing = useRef(false);
  if (observed !== state.q) { setObserved(state.q); setDraft(state.q); }
  useEffect(() => {
    const cancel = () => {
      clearTimeout(timer.current); composing.current = false;
      setDraft(normalizeBoardParams(parseBoardParams(new URLSearchParams(window.location.search))).q);
    };
    window.addEventListener("popstate", cancel);
    return () => { clearTimeout(timer.current); window.removeEventListener("popstate", cancel); };
  }, []);
  useEffect(() => { clearTimeout(timer.current); }, [state.q]);
  function schedule(value: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => change({ q: value }), searchDelay);
  }
  function reset() {
    clearTimeout(timer.current); composing.current = false; setDraft("");
    change({ q: "", severity: "", priority: "", assignee: "", sort: "updated" });
  }
  const unknownAssignee = state.assignee && state.assignee !== "none" && members.isSuccess && !members.data.some((member) => member.user_id === state.assignee);
  return <section className="board-filters" aria-label="이슈 검색과 필터">
    <label className="board-search">제목·이슈키 검색
      <input type="search" value={draft} placeholder="제목 또는 RB-번호" aria-describedby="board-search-help"
        onChange={(event) => { setDraft(event.target.value); if (!composing.current) schedule(event.target.value); }}
        onCompositionStart={() => { composing.current = true; clearTimeout(timer.current); }}
        onCompositionEnd={(event) => { composing.current = false; setDraft(event.currentTarget.value); schedule(event.currentTarget.value); }} />
    </label>
    <div className="board-filter-control"><label htmlFor="filter-severity">심각도 필터</label><select id="filter-severity" value={state.severity} onChange={(event) => change({ severity: event.target.value })}>
      <option value="">전체 심각도</option>{Object.entries(severities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
    <div className="board-filter-control"><label htmlFor="filter-priority">우선순위 필터</label><select id="filter-priority" value={state.priority} onChange={(event) => change({ priority: event.target.value })}>
      <option value="">전체 우선순위</option>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
    <div className="board-filter-control"><label htmlFor="filter-assignee">담당자 필터</label><select id="filter-assignee" value={state.assignee} onChange={(event) => change({ assignee: event.target.value })}>
      <option value="">모든 담당자</option><option value="none">담당자 미지정</option>
      {state.assignee && state.assignee !== "none" && !members.data?.some((member) => member.user_id === state.assignee) && <option value={state.assignee}>담당자 확인 필요</option>}
      {members.data?.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
    </select></div>
    <div className="board-filter-control"><label htmlFor="filter-sort">이슈 정렬</label><select id="filter-sort" value={state.sort} onChange={(event) => change({ sort: event.target.value })}>
      <option value="updated">최근 수정 순</option><option value="priority">우선순위 순</option>
    </select></div>
    <button type="button" className="button button-secondary" onClick={reset}>검색·필터 초기화</button>
    <p id="board-search-help" className="form-hint">제목·이슈키의 일부를 검색합니다. 최대 120자, 앞뒤 공백 제외. 입력을 마치면 조건이 주소에 반영됩니다.</p>
    {members.isError && <p role="alert">담당자 목록을 불러오지 못했습니다. <button onClick={() => members.refetch()}>필터 담당자 다시 조회</button></p>}
    {unknownAssignee && <p role="status">선택한 담당자가 이 팀에 없거나 조회할 수 없습니다. 담당자 필터를 변경하세요.</p>}
  </section>;
}
