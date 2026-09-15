import type { Metadata } from "next";
import Link from "next/link";
import { readDevAccounts } from "@/lib/dev/accounts.server";
import { DevLogin } from "@/features/auth/dev-login";

export const metadata: Metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const accounts = await readDevAccounts();
  return (
    <div className="login-page">
      <section className="login-intro" aria-labelledby="login-intro-title">
        <p className="page-eyebrow">A CLEAR PATH TO DONE</p>
        <h1 id="login-intro-title">문제를 함께 재현하고,<br />해결을 확인하세요.</h1>
        <p>흩어진 버그 제보를 한곳에 모으고,<br />재현 정보부터 수정 후 재검증까지 이어갑니다.</p>
        <ol className="login-steps">
          <li><span>01</span><div><strong>재현 정보를 갖추고</strong><p>단계, 기대 결과, 실제 결과, 환경</p></div></li>
          <li><span>02</span><div><strong>수정 내용을 남기고</strong><p>무엇을 고쳤는지, 어느 버전인지</p></div></li>
          <li><span>03</span><div><strong>다시 확인한 뒤 완료</strong><p>통과·실패와 검증 환경을 기록</p></div></li>
        </ol>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <span className="outline-badge">개발 중</span>
        <h2 id="login-title">팀의 보드로 시작하기</h2>
        <p>GitHub 계정으로 로그인할 수 있도록 준비하고 있습니다.</p>
        <button className="button button-dark" disabled aria-describedby="login-note">GitHub 로그인 · 준비 중</button>
        <p id="login-note" className="login-note">GitHub 로그인은 아직 연결되지 않았습니다. 로컬 개발 환경에서는 합성 계정으로 제목 저장 흐름을 확인할 수 있습니다.</p>
        {accounts && <DevLogin accounts={accounts} />}
        <div className="login-divider" />
        <Link className="preview-link" href="/board">보드 화면 미리보기 <span aria-hidden="true">→</span></Link>
        <p className="preview-note">데이터가 없는 화면 골격을 둘러보세요.</p>
      </section>
    </div>
  );
}
