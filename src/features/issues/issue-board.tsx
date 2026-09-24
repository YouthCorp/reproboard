"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "zustand";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import type { BoardCommand, Issue } from "./commands";
import { boardColumns, completeness, issueValues } from "./fields";
import { displayedStatus, issueCommandKey, type PendingCommand } from "./command-store";
import { useIssueCommands } from "./issue-commands";
import { canTransition, needsReason, needsVerification, stateFieldErrors } from "./state-rules";
import { TransitionDialog } from "./transition-menu";
import { useConnection } from "./issue-realtime";

function Card({ issue, pending, message, canWrite, select, retry }: { issue: Issue; pending?: PendingCommand; message?: string; canWrite: boolean; select: (id: string) => void; retry: (command: BoardCommand) => void }) {
  const { setNodeRef, setActivatorNodeRef, isDragging, attributes, listeners } = useDraggable({ id: issue.id, disabled: !canWrite || !!pending });
  const fulfilled = completeness(issue);
  return <li ref={setNodeRef} className={`issue-card${isDragging ? " is-dragging" : ""}`} data-issue-id={issue.id}>
    {canWrite && <button ref={setActivatorNodeRef} type="button" className="drag-handle" {...attributes} {...listeners}
      aria-label={`${issue.issue_key} 드래그로 상태 이동`} aria-describedby="board-drag-help" disabled={!!pending}>⠿ 상태 이동</button>}
    <button type="button" className="issue-card-link" onClick={() => select(issue.id)} aria-label={`${issue.issue_key} ${issue.title} 상세 열기`}>
      <span className="issue-key">{issue.issue_key}</span><h4>{issue.title}</h4>
      <span className="issue-classification">{issue.severity === "unset" ? "심각도 미설정" : issue.severity} · {issue.priority === "unset" ? "우선순위 미설정" : issue.priority}</span>
      <strong className="card-completeness">재현 정보 {fulfilled.count}/4 충족</strong>
      <span className="card-missing">{fulfilled.missing.length ? `누락: ${fulfilled.missing.join(" · ")}` : "재현 정보 입력 완료"}</span>
    </button>
    {pending && <div className={`card-command ${pending.phase}`}>
      <p role="status">{pending.phase === "pending" ? "저장 중…" : "결과 확인 중 · 저장됐을 수 있습니다."}</p>
      {pending.phase === "uncertain" && <button type="button" className="button button-secondary" disabled={!canWrite} onClick={() => retry(pending.command)}>같은 요청으로 결과 확인</button>}
    </div>}
    {!pending && message && <p className="card-command-message" role="status">{message}</p>}
  </li>;
}

function Column({ column, children, count }: { column: (typeof boardColumns)[number]; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return <section ref={setNodeRef} className={`board-column tone-${column.tone}${isOver ? " drop-target" : ""}`} aria-labelledby={`column-${column.id}`} data-status={column.id}>
    <div className="column-header"><div><span className="status-dot" /><h3 id={`column-${column.id}`}>{column.name}</h3></div><span className="column-count" aria-label={`${count}개 이슈`}>{count}</span></div>
    <p className="column-description">{column.description}</p>{children}
  </section>;
}

export function IssueBoard({ client, workspaceId, issues, canWrite, select }: { client: AppSupabase; workspaceId: string; issues: Issue[]; canWrite: boolean; select: (id: string) => void }) {
  const { store, run } = useIssueCommands();
  const connection = useConnection();
  const allowMove = canWrite && connection?.online !== false;
  const requests = useStore(store, (state) => state.requests);
  const messages = useStore(store, (state) => state.messages);
  const members = useMembers(client, workspaceId);
  const [dragged, setDragged] = useState<{ id: string; version: number } | null>(null);
  const [dialog, setDialog] = useState<{ issueId: string; target: string } | null>(null);
  const [message, setMessage] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const mutation = useMutation({ mutationFn: run, retry: false, networkMode: "always" });
  function send(command: BoardCommand) { mutation.mutate(command, { onError: (error) => {
    if (error.message === "OFFLINE") setMessage("오프라인이라 이동 요청을 보내지 않았습니다.");
  } }); }
  function drop({ active, over }: DragEndEvent) {
    setDragged(null);
    const issue = issues.find((row) => row.id === active.id);
    if (!allowMove || !issue || !over || over.id === issue.status || requests[issueCommandKey(issue.workspace_id, issue.id)]) return;
    if (dragged?.version !== issue.version) { setMessage("드래그 중 내용이 바뀌었습니다. 최신 내용을 확인하고 다시 이동하세요."); return; }
    const target = String(over.id);
    if (!canTransition(issue.status, target)) { setMessage("허용되지 않은 상태 이동입니다. 상세의 상태 이동 메뉴에서 가능한 경로를 확인하세요."); return; }
    const assigneeValid = !!members.data?.some((member) => member.user_id === issue.assignee_id && (member.role === "owner" || member.role === "member"));
    const missing = stateFieldErrors(target, issueValues(issue), assigneeValid);
    if (needsReason(issue.status, target) || needsVerification(issue.status, target) || Object.keys(missing).length) {
      setDialog({ issueId: issue.id, target }); return;
    }
    send({ operation: "transition", workspaceId: issue.workspace_id, issueId: issue.id, expectedVersion: issue.version, requestId: crypto.randomUUID(), payload: { target_status: target } });
  }
  const dialogIssue = issues.find((row) => row.id === dialog?.issueId);
  const activeIssue = issues.find((row) => row.id === dragged?.id);
  return <>
    <p id="board-drag-help" className="form-hint">{canWrite ? "카드의 이동 손잡이를 다른 열로 드래그하세요. 키보드는 상세의 상태 이동 메뉴를 이용하세요. 열 내부 순서는 선택한 정렬을 따릅니다." : "Viewer는 이슈를 조회할 수 있습니다."}</p>
    <p className="board-move-message" role="status">{message}</p>
    <DndContext id="issue-board-dnd" sensors={sensors} collisionDetection={pointerWithin}
      accessibility={{ screenReaderInstructions: { draggable: "상태 이동은 카드 상세의 상태 이동 메뉴에서 키보드로 할 수 있습니다." }, announcements: {
        onDragStart: ({ active }) => `${issues.find((row) => row.id === active.id)?.issue_key ?? "카드"} 이동 중입니다.`,
        onDragOver: ({ over }) => over ? `${boardColumns.find((column) => column.id === over.id)?.name ?? "열"} 위입니다.` : "상태 열 밖입니다.",
        onDragEnd: () => "드래그를 마쳤습니다. 입력 안내와 저장 상태를 확인하세요.",
        onDragCancel: () => "드래그를 취소했습니다.",
      } }}
      onDragStart={({ active }) => { const row = issues.find((issue) => issue.id === active.id); setMessage(""); if (row) setDragged({ id: row.id, version: row.version }); }}
      onDragCancel={() => setDragged(null)} onDragEnd={drop}>
      <div className="board-grid live-board-grid">{boardColumns.map((column) => {
        const rows = issues.filter((issue) => displayedStatus(issue, canWrite ? requests[issueCommandKey(issue.workspace_id, issue.id)] : undefined) === column.id);
        return <Column key={column.id} column={column} count={rows.length}>
          {rows.length === 0 ? <p className="column-empty">이 상태의 이슈가 없습니다.</p> : <ul className="issue-list">{rows.map((issue) => {
            const key = issueCommandKey(issue.workspace_id, issue.id);
            return <Card key={issue.id} issue={issue} canWrite={allowMove} pending={requests[key]} message={messages[key]} select={select} retry={send} />;
          })}</ul>}
        </Column>;
      })}</div>
      <DragOverlay dropAnimation={null}>{activeIssue ? <div className="drag-preview"><strong>{activeIssue.issue_key}</strong><p>{activeIssue.title}</p></div> : null}</DragOverlay>
    </DndContext>
    {dialog && dialogIssue && <TransitionDialog client={client} issue={dialogIssue} target={dialog.target} close={() => setDialog(null)} />}
  </>;
}
