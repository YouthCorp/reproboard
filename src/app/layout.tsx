import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReproBoard", template: "%s | ReproBoard" },
  description: "소규모 팀을 위한 버그 재현·트리아지·재검증 보드. 현재 개발 중입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <header className="site-header">
          <Link className="brand" href="/board" aria-label="ReproBoard 보드">
            <span className="brand-mark" aria-hidden="true">r<span>.</span></span>
            ReproBoard
          </Link>
          <nav aria-label="주 메뉴">
            <Link href="/board">보드</Link>
            <Link className="nav-login" href="/login">로그인</Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>Reproduce. Resolve. Recheck.</span>
          <span>개발 중 · 화면 골격</span>
        </footer>
      </body>
    </html>
  );
}
