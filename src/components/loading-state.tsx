export function LoadingState() {
  return (
    <div className="feedback-state" role="status">
      <span className="loading-ring" aria-hidden="true" />
      <p>화면을 불러오고 있습니다</p>
    </div>
  );
}
