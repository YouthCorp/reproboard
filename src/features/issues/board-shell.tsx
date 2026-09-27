import { boardColumns } from "./fields";

export function BoardShell() {
  return (
    <div className="board-grid" aria-label="이슈 보드 미리보기">
      {boardColumns.map((column, index) => (
        <section className={`board-column tone-${column.tone}`} key={column.id} aria-labelledby={`column-${column.id}`}>
          <header className="column-header">
            <div><span className="status-dot" aria-hidden="true" /><h3 id={`column-${column.id}`}>{column.name}</h3></div>
            <span className="column-index" aria-hidden="true">0{index + 1}</span>
          </header>
          <p className="column-description">{column.description}</p>
          <div className="column-empty">
            <span className="empty-symbol" aria-hidden="true">＋</span>
            <strong>로그인 후 이용할 수 있어요</strong>
          </div>
        </section>
      ))}
    </div>
  );
}
