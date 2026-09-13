import type { Metadata } from "next";
import Link from "next/link";
import { BoardShell } from "@/features/issues/board-shell";
import { QueryProvider } from "@/lib/query/query-provider";

export const metadata: Metadata = { title: "버그 보드" };

export default function BoardPage() {
  return (
    <div className="board-page">
      <div className="page-eyebrow"><span className="small-square" /> WORKSPACE / 미연결</div>
      <div className="page-heading">
        <div><h1>버그 보드</h1><p>재현부터 재검증까지, 한 흐름으로.</p></div>
        <button className="button button-primary" disabled aria-describedby="connection-note">
          <span aria-hidden="true">＋</span> 이슈 등록
        </button>
      </div>
      <aside className="connection-notice" aria-labelledby="connection-title">
        <span className="notice-icon" aria-hidden="true">i</span>
        <div>
          <h2 id="connection-title">아직 워크스페이스에 연결되지 않았습니다</h2>
          <p id="connection-note">현재는 화면 골격입니다. 로그인과 데이터 저장은 준비 중이며, 아래는 실제 조회 결과가 아닙니다.</p>
        </div>
        <Link href="/login">로그인 안내 <span aria-hidden="true">↗</span></Link>
      </aside>
      <div className="board-caption"><h2>이슈 진행 현황</h2><span>5단계 작업 흐름</span></div>
      <QueryProvider><BoardShell /></QueryProvider>
      <p className="board-footnote">완료의 기준은 수정 이후의 재검증입니다. 재검증 기록이 있어야 Done으로 이동합니다.</p>
    </div>
  );
}
