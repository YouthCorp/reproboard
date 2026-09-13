import Link from "next/link";

export default function NotFound() {
  return (
    <section className="feedback-state">
      <p className="page-eyebrow">404 / NOT FOUND</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 보드에서 다시 시작해 주세요.</p>
      <Link className="button button-primary" href="/board">보드로 돌아가기</Link>
    </section>
  );
}
