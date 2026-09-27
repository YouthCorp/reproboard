import type { Metadata } from "next";
import Link from "next/link";
import { readDevAccounts } from "@/lib/dev/accounts.server";
import { DevLogin } from "@/features/auth/dev-login";
import { GithubLogin } from "@/features/auth/github-login";
import { githubStatus } from "@/lib/auth/github.server";
import { safeNext } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [accounts, status, params] = await Promise.all([readDevAccounts(), githubStatus(), searchParams]);
  const next = safeNext(params.next);
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
        <span className="outline-badge">{accounts ? "로컬 체험 · 합성 데이터" : "팀 작업 공간"}</span>
        <h2 id="login-title">팀의 보드로 시작하기</h2>
        <p>GitHub 계정으로 로그인하고 팀에 참여하세요.</p>
        {params.reason === "session-expired" && <p role="alert">세션이 만료되었거나 종료됐습니다. 다시 로그인하세요.</p>}
        {params.reason === "callback-error" && <p role="alert">GitHub 로그인이 취소되었거나 인증을 완료하지 못했습니다. 다시 시도하세요.</p>}
        {params.reason === "signed-out" && <p role="status">로그아웃했습니다.</p>}
        <GithubLogin status={status} next={next} />
        {accounts && <DevLogin accounts={accounts} next={next} />}
        <div className="login-divider" />
        <Link className="preview-link" href="/board">보드 화면 미리보기 <span aria-hidden="true">→</span></Link>
        <p className="preview-note">로그인 전에 5단계 작업 흐름을 살펴보세요.</p>
      </section>
    </div>
  );
}
