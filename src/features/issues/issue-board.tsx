import type { Issue } from "./commands";
import { boardColumns, completeness } from "./fields";

export function IssueBoard({ issues, select }: { issues: Issue[]; select: (id: string) => void }) {
  return <div className="board-grid live-board-grid">{boardColumns.map((column) => {
    const rows = issues.filter((issue) => issue.status === column.id);
    return <section key={column.id} className={`board-column tone-${column.tone}`} aria-labelledby={`column-${column.id}`}>
      <div className="column-header"><div><span className="status-dot" /><h3 id={`column-${column.id}`}>{column.name}</h3></div><span className="column-count" aria-label={`${rows.length}개 이슈`}>{rows.length}</span></div>
      <p className="column-description">{column.description}</p>
      {rows.length === 0 ? <p className="column-empty">이 상태의 이슈가 없습니다.</p> : <ul className="issue-list">{rows.map((issue) => {
        const fulfilled = completeness(issue);
        return <li className="issue-card" key={issue.id}><button type="button" className="issue-card-link" onClick={() => select(issue.id)} aria-label={`${issue.issue_key} ${issue.title} 상세 열기`}>
          <span className="issue-key">{issue.issue_key}</span><h4>{issue.title}</h4>
          <span className="issue-classification">{issue.severity === "unset" ? "심각도 미설정" : issue.severity} · {issue.priority === "unset" ? "우선순위 미설정" : issue.priority}</span>
          <strong className="card-completeness">재현 정보 {fulfilled.count}/4 충족</strong>
          <span className="card-missing">{fulfilled.missing.length ? `누락: ${fulfilled.missing.join(" · ")}` : "재현 정보 입력 완료"}</span>
        </button></li>;
      })}</ul>}
    </section>;
  })}</div>;
}
