"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import { useConnection } from "@/features/issues/issue-realtime";
import { validateComment } from "./commands";
import { useCommentCommand } from "./use-comment-command";

export function Comments({ client, workspaceId, issueId, canWrite }: { client: AppSupabase; workspaceId: string; issueId: string; canWrite: boolean }) {
  const members = useMembers(client, workspaceId), connection = useConnection();
  const command = useCommentCommand(client);
  const [body, setBody] = useState(""), [mentions, setMentions] = useState<string[]>([]), [validation, setValidation] = useState("");
  const [retained, setRetained] = useState(canWrite);
  const input = useRef<HTMLTextAreaElement>(null);
  const comments = useQuery({ queryKey: ["comments", workspaceId, issueId], queryFn: async ({ signal }) => {
    const rows = [];
    for (let offset = 0; ; offset += 200) {
      const result = await client.from("comments").select("*").eq("workspace_id", workspaceId).eq("issue_id", issueId)
        .order("created_at").order("id").range(offset, offset + 199).abortSignal(signal).retry(false);
      if (result.error) throw new Error("댓글을 불러오지 못했습니다.");
      rows.push(...result.data); if (result.data.length < 200) return rows;
    }
  } });
  const activity = useQuery({ queryKey: ["activity", workspaceId, issueId], queryFn: async ({ signal }) => {
    const result = await client.from("activity_events").select("id,actor_id,event_type,created_at").eq("workspace_id", workspaceId).eq("issue_id", issueId)
      .order("created_at", { ascending: false }).order("id").limit(50).abortSignal(signal).retry(false);
    if (result.error) throw new Error("활동을 불러오지 못했습니다."); return result.data;
  } });
  const name = (id: string) => members.data?.find((m) => m.user_id === id)?.display_name ?? "팀 멤버";
  if (canWrite && !retained) setRetained(true);
  const frozen = command.pending || !!command.unconfirmed;
  async function submit() {
    if (!canWrite) return;
    const error = validateComment(body, mentions); setValidation(error);
    if (error) { input.current?.focus(); return; }
    if (await command.run({ operation: "add", workspaceId, issueId, requestId: crypto.randomUUID(), body, mentions })) {
      setBody(""); setMentions([]); input.current?.focus();
    }
  }
  return <section className="comments-section" aria-label="댓글과 활동"><h3>댓글</h3>
    {comments.isPending && <p role="status">댓글을 불러오는 중…</p>}
    {comments.isError && <p role="alert">댓글을 불러오지 못했습니다. <button onClick={() => comments.refetch()}>댓글 다시 조회</button></p>}
    {comments.data?.length === 0 && <p>아직 댓글이 없습니다.</p>}
    <ol className="comment-list">{comments.data?.map((comment) => <li key={comment.id}>
      <strong>{name(comment.actor_id)}</strong><p className="comment-body">{comment.body}</p>
      {comment.mention_ids.length > 0 && <p className="form-hint">멘션: {comment.mention_ids.map(name).join(" · ")}</p>}
      <time className="form-hint">{new Date(comment.created_at).toLocaleString("ko-KR")}</time>
    </li>)}</ol>
    {retained ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label htmlFor="comment-body">댓글 내용</label>
      <textarea id="comment-body" ref={input} rows={3} value={body} onChange={(event) => setBody(event.target.value)} readOnly={!canWrite || frozen}
        aria-invalid={!!validation} aria-describedby="comment-help comment-error" />
      <p id="comment-help" className="form-hint">일반 텍스트 · 공백 제거 후 {Array.from(body.trim()).length}/4,000자 · 이슈 본문 수정과 별도로 저장됩니다.</p>
      <p id="comment-error" role={validation ? "alert" : undefined}>{validation}</p>
      <fieldset disabled={!canWrite || frozen}><legend>멘션할 팀 멤버 (최대 8명)</legend>
        {members.isPending && <p>멤버 조회 중…</p>}
        {members.isError && <p role="alert">멤버를 불러오지 못했습니다. <button type="button" onClick={() => members.refetch()}>멤버 다시 조회</button></p>}
        <div className="mention-options">{members.data?.map((member) => <label key={member.user_id}>
          <input type="checkbox" checked={mentions.includes(member.user_id)} disabled={!mentions.includes(member.user_id) && mentions.length >= 8}
            onChange={(event) => setMentions(event.target.checked ? [...mentions, member.user_id] : mentions.filter((id) => id !== member.user_id))} />{member.display_name}
        </label>)}</div>
      </fieldset>
      {!canWrite && <p>댓글 작성 권한이 없습니다. 작성 중인 입력은 유지됩니다.</p>}
      {command.message && <p role="status">{command.message}</p>}
      <button className="button" disabled={!canWrite || command.pending || connection?.online === false}>
        {command.pending ? "댓글 저장 중…" : command.unconfirmed ? "같은 댓글 요청 확인" : "댓글 등록"}
      </button>
    </form> : <p>Viewer는 댓글을 읽을 수 있습니다.</p>}
    <details className="comment-activity"><summary>최근 활동 (최대 50건)</summary>
      {activity.isPending && <p>활동 조회 중…</p>}
      {activity.isError && <p role="alert">활동을 불러오지 못했습니다. <button onClick={() => activity.refetch()}>활동 다시 조회</button></p>}
      {activity.data?.length === 0 && <p>아직 활동이 없습니다.</p>}
      <ol>{activity.data?.map((event) => <li key={event.id}>{name(event.actor_id)} · {event.event_type === "comment_added" ? "댓글 등록" : event.event_type === "issue_created" ? "이슈 생성" : event.event_type === "issue_status_changed" ? "상태 이동" : "본문 수정"} · {new Date(event.created_at).toLocaleString("ko-KR")}</li>)}</ol>
    </details>
  </section>;
}
