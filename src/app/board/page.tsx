import type { Metadata } from "next";
import { BoardShell } from "@/features/issues/board-shell";
import { QueryProvider } from "@/lib/query/query-provider";
import { BoardLoginLink, BoardSession } from "@/features/auth/board-session";

export const metadata: Metadata = { title: "버그 보드" };
export const dynamic = "force-dynamic";

export default function BoardPage() {
  return (
    <div className="board-page">
      <QueryProvider><BoardSession>
      <div className="page-eyebrow"><span className="small-square" /> 작업 흐름 미리보기</div>
      <div className="page-heading">
        <div><h1>버그 보드</h1><p>재현부터 재검증까지, 한 흐름으로.</p></div>
        <button className="button button-primary" disabled aria-describedby="connection-note">
          <span aria-hidden="true">＋</span> 버그 등록
        </button>
      </div>
      <aside className="connection-notice" aria-labelledby="connection-title">
        <span className="notice-icon" aria-hidden="true">i</span>
        <div>
          <h2 id="connection-title">로그인하고 팀의 버그를 확인하세요</h2>
          <p id="connection-note">아래는 5단계 작업 흐름을 보여주는 미리보기입니다. 로그인하면 팀의 실제 버그를 확인하고 등록할 수 있습니다.</p>
        </div>
        <BoardLoginLink />
      </aside>
      <div className="board-caption"><h2>진행 현황</h2><span>5단계 작업 흐름</span></div>
      <BoardShell />
      <p className="board-footnote">수정을 마친 뒤 실제 환경에서 다시 확인하세요. 검증 통과 기록이 있어야 완료로 이동합니다.</p>
      </BoardSession></QueryProvider>
    </div>
  );
}
