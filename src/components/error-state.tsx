"use client";

import Link from "next/link";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="feedback-state" aria-labelledby="error-title">
      <p className="page-eyebrow">잠시 문제가 생겼습니다</p>
      <h1 id="error-title">화면을 불러오지 못했습니다</h1>
      <p role="alert">다시 시도하거나 보드로 이동해 주세요.</p>
      <div className="feedback-actions">
        <button className="button button-primary" onClick={onRetry}>다시 시도</button>
        <Link className="button button-secondary" href="/board">보드로 이동</Link>
      </div>
    </section>
  );
}
