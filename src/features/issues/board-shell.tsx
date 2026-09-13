const columns = [
  { id: "inbox", name: "Inbox", description: "재현 정보를 모으는 단계", hint: "어떤 문제가 발생했나요?", tone: "neutral" },
  { id: "ready", name: "Ready", description: "재현과 우선순위 확인", hint: "작업할 준비를 마쳤어요", tone: "blue" },
  { id: "in-progress", name: "In Progress", description: "담당자가 문제를 수정", hint: "해결 방법을 찾고 있어요", tone: "amber" },
  { id: "verify", name: "Verify", description: "수정한 버전에서 재검증", hint: "같은 문제를 다시 확인해요", tone: "violet" },
  { id: "done", name: "Done", description: "재검증을 통과한 이슈", hint: "검증 기록과 함께 마무리", tone: "green" },
] as const;

export function BoardShell() {
  return (
    <div className="board-grid" aria-label="이슈 보드 미리보기">
      {columns.map((column, index) => (
        <section className={`board-column tone-${column.tone}`} key={column.id} aria-labelledby={`column-${column.id}`}>
          <header className="column-header">
            <div><span className="status-dot" aria-hidden="true" /><h3 id={`column-${column.id}`}>{column.name}</h3></div>
            <span className="column-index" aria-hidden="true">0{index + 1}</span>
          </header>
          <p className="column-description">{column.description}</p>
          <div className="column-empty">
            <span className="empty-symbol" aria-hidden="true">＋</span>
            <strong>연결 대기</strong>
            <p>{column.hint}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
