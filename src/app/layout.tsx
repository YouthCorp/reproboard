import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "../features/issues/workspace.css";

export const metadata: Metadata = {
  title: { default: "ReproBoard", template: "%s | ReproBoard" },
  description: "버그 제보부터 수정 후 재검증까지. 작은 팀의 버그 작업 공간, ReproBoard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head><link rel="preload" href="/fonts/SUIT-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <header className="site-header">
          <Link className="brand" href="/board" aria-label="ReproBoard 보드">
            <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M12 5H5v22h7M20 5h7v10M13 19l4 4 10-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" /></svg></span>
            ReproBoard
          </Link>
          <nav aria-label="주 메뉴">
            <Link href="/board">보드</Link>
            <Link className="nav-login" href="/login">로그인</Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>재현을 남기고, 해결을 확인하다.</span>
          <span>ReproBoard · 버그 재현과 재검증</span>
        </footer>
      </body>
    </html>
  );
}
