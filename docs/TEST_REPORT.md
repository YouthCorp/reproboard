# 테스트 실행 보고서

현재 상태: **D2 / P02 로컬 최소 저장 흐름 PASS, V02 독립 검증 대기.** V01의 기존 검증 기록은 아래에 보존한다. README의 지속 실행 상태 단정은 D2에서 수정했고 D1 이전 파일 보존 독립 증명은 여전히 NOT_RUN이다.

## D2 실제 결과 — 2026-09-14

Windows 25H2 / PowerShell 7.6.5 / Node 24.19.0 / pnpm 11.19.0 / Supabase CLI 2.117.0 / PostgreSQL 17.6 / Docker 서버 29.7.2. Next 16.3.5·React 19.3.0 유지, Supabase JS 2.116.0·pg 8.23.0 추가. 합성 계정 Owner/Member/Viewer/다른 팀 Owner, 팀 2개. hosted 환경·실제 사용자 데이터는 사용하지 않았다.

| 명령/검증 | 결과 | 실제 확인과 한계 |
|---|---|---|
| `pnpm db:start`, `pnpm db:migrate` | PASS | 로컬 스택 기동 후 `20260914000100_d2_issue_commands.sql` 적용. 기존 데이터를 지우는 명령 없이 최초 적용 |
| `pnpm db:seed`, `pnpm db:env`, `pnpm db:types` | PASS | 합성 계정 4개·팀 2개, 공개 env 생성, 실제 DB에서 public 타입 생성. `.local/.env.local`은 비공개 로컬 파일 |
| `pnpm db:reset --confirm-local-reproboard` → seed/types | PASS | 먼저 실제 사용자 0·이슈 0·이번 합성 팀 2개를 확인. 고정 loopback·Docker 식별자 검사를 통과한 로컬 DB에서 migration 재적용·계정 재준비. 운영/공유 DB reset 없음 |
| `pnpm test:local-tools` | PASS 2/2 | 원격 API/DB·다른 포트/DB/컨테이너/작업 경로 거부. 확인 없는 reset·target override는 DB 실행 전에 거부 |
| `pnpm test:db` | PASS 14/14 | 실제 password 로그인 토큰으로 아래 권한/경합/재전송/롤백 검증. 증거 조회와 테스트 fixture 준비만 postgres 사용 |
| RLS·직접 DML | PASS | Owner/Member/Viewer 같은 팀 읽기, 타팀 rows 0, anon 읽기/RPC 거부. 모든 역할의 직접 issues insert·4테이블 update/delete 42501. Viewer/타팀 RPC 쓰기 거부 |
| 권한·payload | PASS | 타팀 issueId 주입/없는 id 모두 NOT_FOUND. title 외 status/created_by/version·잘못된 타입·길이 거부. auth.uid 없는 authenticated SQL 호출 거부. private receipt/내부 함수 접근 거부 |
| version·멱등성 | PASS | 두 실제 세션의 동시 수정 성공 1/CONFLICT 1·version +1. 동시 중복 create/update는 동일 결과·activity/receipt 1건. 이후 수정 뒤 과거 receipt 재전송도 추가 효과 0. 같은 requestId/다른 payload·operation 거부 |
| 트랜잭션·현재 권한 | PASS | 테스트 전용 requestId의 activity insert 예외로 이슈/version 롤백·receipt 0. 거부 경로 성공 기록 0. Member→Viewer 변경 후 과거 성공 요청 재전송도 FORBIDDEN |
| Unicode·용량 | PASS | JS trim과 같은 공백 제거, 120개 단일 이모지 허용. 합성 499개에서 동시 생성 2건 중 1건만 성공해 정확히 500개. 용량 테스트 팀/행은 정리, 성능 측정 아님 |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | PASS | ESLint·Next 타입/tsc·기존 Vitest 1건·production build. 테스트 삭제/skip 없음 |
| 고정 설치·비밀 값 대조 | PASS | `pnpm install --frozen-lockfile` exit 0. 실제 합성 비밀번호·로컬 JWT/secret/service 키를 메모리에서만 읽어 소스 후보 65개와 production server/static 파일 162개 대조: 일치 0. 값 자체는 출력하지 않음 |
| `pnpm test:e2e` | PASS 5/5 | production 3100: 기존 4개 smoke 유지, 개발 계정 UI와 fixture 이메일 미노출 추가. 실제 OAuth 검증 아님 |
| `pnpm test:db-ui` | PASS 3/3 | development 3000: 실제 생성→수정→reload·DB version 2, Viewer/타팀/로그아웃, 별도 context Owner/Member의 충돌 초안 보존→최신 확인→version 3. 390px overflow 없음·기본 저장 흐름 pageerror 0 |
| 별도 V02·원격 CI·OAuth·전체 AC01~16 | NOT_RUN | D2 최소 제목 흐름만 해당. 초대/다른 필드/상태 전환/Realtime/응답 유실 주입/전체 수용 기준은 미구현·미실행 |

- 중간 FAIL 후 수정: JS 테스트의 브라우저 전역 선언·finally 오류 전달, SDK의 `abortSignal`/`maybeSingle` 호출 순서. 최종 lint/typecheck PASS.
- DB UI 최초 실행은 기존 Next dev PID의 잠금으로 FAIL. 경로 확인 후 자식 종료를 시도했으나 부모가 재기동했다. 동일 3000 서버를 재사용하도록 구성 후 3건 PASS. PowerShell Stop-Process 실패는 성공으로 집계하지 않았다.
- 실제 캡처: `playwright-db-report/index.html`의 `d2-saved-inbox`, `d2-stale-title`. DB UI trace/storageState는 저장하지 않는다. 보고서 폴더는 gitignore이며 재실행으로 생성한다.
- 테스트 정리: API 테스트와 브라우저 테스트가 만든 UUID만 삭제. activity 오류 주입 trigger/function과 임시 용량 팀은 finally에서 제거. 원래 개발자의 이슈를 삭제하지 않는다.
- 정리 후 실제 DB 조회: issues/activity/receipts 각각 0, 합성 팀 2개, 테스트 오류 주입 함수 0. 기존 미커밋 V01 진행 기록·검증 본문은 작업 전 사본과 문자 단위 대조해 동일함을 확인했다. AGENTS 변경 없음.
- AC01/03/07/08/14/15의 D2 일부 위험을 검증했으며 전체 AC 통과로 올리지 않았다. 전송 실패 후 같은 요청 확인 UI는 있지만 DB commit 후 응답 유실 주입은 D6에서 별도로 검증해야 한다.

## D2 재개 확인 — 2026-09-15

- PASS: 정지된 Docker Desktop을 `docker desktop start --timeout 45`, 기존 Supabase를 `pnpm db:start`로 기동(exit 0). 재설치·reset·seed·migration 재실행 없음.
- PASS: Node 24.19.0/pnpm 11.19.0으로 `pnpm dev` Ready. Docker 서버 29.7.2, 프로젝트 컨테이너 8개 실행, healthcheck가 있는 7개 healthy.
- PASS: login(3000)·Auth(54321)·Studio(54323) HTTP 200. 실제 SQL 조회로 합성 팀 2개, 이슈/receipt 각각 0개 확인. 비밀 값·응답 본문 출력 없음.
- 수정/PASS: 최종 Git 검사에서 생성 타입의 마지막 빈 줄 검출. 생성 도구에 끝 공백 정규화를 추가한 뒤 `pnpm db:types`, `pnpm lint`, `pnpm typecheck` exit 0. 실제 DB 타입 차이는 마지막 빈 줄 제거뿐이다.
- NOT_RUN: 09-14 통과한 앱/DB 테스트 25건·빌드를 오늘 다시 실행하지 않음. 앱/SQL 동작 변경 없이 기동·문서·타입 출력 공백만 정리했으며, 별도 V02는 다음 단계다.

## D1 실행 환경 (당시 기록)

- 실제 실행일: 2026-09-13 (Asia/Seoul), D1 최초 로컬 변경. 커밋 식별자는 최종 보고/`git log` 참조.
- Windows 25H2 (빌드 26200.9445), PowerShell 7.6.5. CPU·메모리 성능 비교는 미측정.
- Node 24.19.0 / pnpm 11.19.0 / Next 16.3.5 / React 19.3.0 / TypeScript 5.9.3.
- Supabase CLI 2.117.0 / PostgreSQL 17.6 / Docker Desktop 4.90.0·엔진 29.7.2 / WSL 2.6.3.0.
- Playwright 1.63.0 / Chromium 153.0.8010.12 (build 1243) / Vitest 5.0.0 + jsdom 30.0.1.
- local: dev 127.0.0.1:3000, production smoke 127.0.0.1:3100. Hosted 환경은 미사용.
- 데이터 없는 골격·비로그인 상태. 제품 테이블/개발 계정 없음. HTTP/WS 장애 주입·실제 협업·성능 측정은 NOT_RUN.
- 일반 사용자 PATH의 Node 24.12.0과 Codex 런타임 24.19.0이 달랐다. 검증 프로세스의 PATH를 후자로 고정했고 전역 Node 설정은 변경하지 않았다. 외부 OAuth 설정 없음.

## V01 독립 검증 — 2026-09-14

| 검증 항목 | 결과 | 실제 확인과 한계 |
|---|---|---|
| 기존 파일 손실 | NOT_RUN (과거 기준) / PASS (현재 커밋 기준) | 검수 시작 전 working tree는 clean, 추적 파일 49개, HEAD 이후 삭제 0개였다. 그러나 저장소 이력은 부모 없는 최초 커밋 `177c5b8` 1개뿐이어서 P01 전 파일 목록·해시와 독립 비교할 기준이 없다. 현재 필수 문서는 모두 존재하지만 기존 파일 무손실이라는 과거 주장은 Git만으로 재검증할 수 없다. |
| 클라이언트 경계 | PASS | `use client`는 Next 오류 경계 2개, 클릭 재시도 컴포넌트, `/board` 하위 Query provider에만 있다. Root layout·`/`·`/board`·`/login`·보드 골격은 Server Component이며 앱 전체 client 전환은 없다. |
| 패키지 매니저·스크립트 | PASS | `pnpm-lock.yaml`만 존재하고 packageManager/engines는 pnpm 11.19.0·Node 24.19.0으로 일치한다. README/CI가 참조하는 package script는 모두 존재한다. `pnpm install --frozen-lockfile --prefer-offline`도 exit 0이었다. |
| 필수 명령 | PASS | `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm build` exit 0. `pnpm dev`는 127.0.0.1:3000에서 705ms에 Ready가 되었고 검수 후 종료했다. |
| 첫 페이지 런타임 | PASS | 실제 브라우저에서 `/`→`/board`, 제목 `버그 보드 | ReproBoard`, readyState `complete`, 새로고침 후 Next 오류 dialog 0, console warn/error 0. 서버 로그의 `/`, `/board` 요청은 모두 200이었다. Next 개발 도구 portal 존재는 오류 overlay로 계산하지 않았다. |
| 비밀 값 커밋 위험 | PASS (현재 단일 커밋 범위) | 추적된 env 파일은 빈 값의 `.env.example`만이고 `.env*`·storageState·Supabase temp는 ignore된다. HEAD에서 Supabase secret/JWT/GitHub/OpenAI/private-key 형식 검출은 없었고 `service_role`은 금지 설명문에만 있었다. 외부 secret scanner와 삭제된 과거 이력 검사는 이력이 1개라 별도 수행하지 않았다. |
| README 설치·앱 기동·환경 변수 | PASS | 고정 Node/pnpm, frozen install, `pnpm dev`, `/` redirect, D1은 env·Docker 불필요라는 설명이 코드·실행과 맞는다. 세 env 이름은 `.env.example`과 같고 앱이 아직 읽지 않는다는 설명도 맞다. |
| README 로컬 스택 현재 상태 | FAIL (문서 정확성) | README의 2026-09-13 기동 성공 기록은 과거 결과로 보존 가능하지만 “현재 로컬 스택을 실행 상태로 두었다”는 2026-09-14 실제 상태와 다르다. Docker CLI 29.7.2는 있으나 Linux 엔진 pipe가 없고 Auth/Studio 포트도 연결 거부였다. 지속 상태를 현재형으로 주장하지 않도록 후속 문서 수정이 필요하다. |
| Docker / Supabase / OAuth 구분 | NOT_RUN·미설정 분리 | Docker: CLI 설치, 엔진 정지. Supabase: CLI 2.117.0·config 존재, 스택 정지; migration 디렉터리·seed·앱 client 없음. OAuth: GitHub provider section·콜백 코드·로컬 비밀 env 모두 없음. OAuth는 D3 범위이며 D2의 외부 선행 조건이 아니다. |

V01은 D1 앱 골격을 PASS로 판정한다. 실제 이슈 생성·조회·수정, RLS/RPC, 개발 사용자, 권한·version·멱등성·협업은 전부 NOT_RUN이며 골격 통과에 포함하지 않는다. D2/P02 실행 전 Docker Desktop Linux 엔진을 시작해 서버 버전을 확인하고 `pnpm db:start`/`pnpm db:status`를 성공시켜야 한다. 이후 migration·로컬 개발 사용자·보호된 seed/reset·일반 사용자 세션의 앱 DB 연결을 P02에서 구현한다. GitHub OAuth·원격 저장소·배포는 D2 선행 조건이 아니다.

## 실제 결과

| AC | 테스트/명령·수동 절차 | 결과 | 기대/실제·증거 | 미검증/결함 |
|---|---|---|---|---|
| D1 설치 | `pnpm install --frozen-lockfile` | PASS | 정확한 버전·lockfile 설치 exit 0 | 새 clone 재현은 NOT_RUN |
| D1 정적 검사 | `pnpm lint`, `pnpm typecheck` | PASS | ESLint 경고 0, Next 타입 생성·tsc exit 0 | 전체 제품 규칙 검증 아님 |
| D1 UI 복구 | `pnpm test` | PASS | 1파일·1테스트. 오류 세부 정보 미노출, 키보드 재시도 1회, 복귀 링크 | Next의 실제 throw→경계 통합 주입은 NOT_RUN |
| D1 빌드 | `pnpm build` | PASS | Next production build exit 0 | 공개 배포 NOT_RUN |
| D1 개발 | `pnpm dev`, 내장 브라우저 `/board` 로딩·콘솔 조회 | PASS | dev 서버 실행·실제 화면 표시, 조회한 콘솔 error/warn 0 | 전체 제품 탐색 검사는 별도 V01 범위 |
| D1 production smoke | `pnpm exec playwright install chromium`, `pnpm test:e2e` | PASS | 4/4: 보드↔로그인·reload, 404 복귀, skip link, 390px overflow. 기본 탐색의 pageerror 0 | Chromium 1종. 실제 로그인/저장 아님 |
| D1 화면 | 위 E2E의 screenshot 첨부 + 이미지 직접 열기 | PASS | 데스크톱/모바일 보드·로그인 4장 확인, HTML 리포트에 첨부 | 사용자 관찰·시연 영상 아님 |
| D1 DB 준비 | `pnpm exec supabase --version`, `pnpm exec supabase init`, `pnpm db:start` | PASS | CLI 2.117.0, 설정 생성·시작 exit 0 | migration·seed·RPC 없음 |
| D1 Docker/WSL | Windows/Ubuntu `docker version`, Ubuntu 소켓 존재 검사 | PASS (복구 후) | Client/Server 29.7.2, backend.sock·docker.sock 존재 | 발생한 프록시 오류의 근본 원인 미확정 |
| D1 DB 기동 | `docker ps`, 아래 SQL·HTTP 조회 | PASS | 8개 실행, healthcheck 있는 7개 healthy. PG 17.6·Auth HTTP 200·Studio HTTP 200 | REST 컨테이너는 healthcheck 상태 표시 없음. 제품 쓰기·RLS 검증 아님 |
| D1 기본 CI | `.github/workflows/ci.yml` 작성 | NOT_RUN | install/lint/typecheck/test/build/Chromium smoke 구성 | GitHub 원격·실제 workflow 실행 없음 |
| AC01~AC16 | 전체 제품 수용 기준 | NOT_RUN | D1 smoke는 AC14/15의 일부 기반만 점검 | DB 기능·권한·충돌·복구·OAuth 등 미구현 |

자동화 테스트 개수·PASS 수·FAIL 수·NOT_RUN은 실제 로그가 있을 때 집계한다. 범위 제외는 합의된 제품 축소인지 함께 기록한다. 로컬 통과를 CI 통과로 적지 않는다.

실행한 비밀 값 없는 DB 점검: `docker exec supabase_db_reproboard psql -U postgres -d postgres -Atc 'show server_version'`, `GET http://127.0.0.1:54321/auth/v1/health`, `GET http://127.0.0.1:54323`. Supabase 시작 원문 로그에는 로컬 키가 포함될 수 있어 결과 전체를 저장소에 넣지 않았다.

증거: 로컬 `playwright-report/index.html` 및 첨부 PNG 4장(리포트는 gitignore). `pnpm build` 후 `pnpm test:e2e`로 재생성한다. 테스트 trace는 실패 때만 보존하도록 설정했으며 이번 최종 실행에는 실패 trace가 없다.

## D1에서 발견한 문제와 현재 상태

- Docker: P00 엔진 파이프 연결 FAIL, 이후 Ubuntu 프록시에서 `backend.sock` 부재로 FAIL. 2026-09-13 22:52 KST 이후 Windows/Ubuntu 엔진·소켓과 실제 Supabase 기동을 재검증해 PASS. 재설치·factory reset·WSL 배포판 제거는 수행하지 않았다. 이전 재시작 명령의 완료 결과는 대화 중단으로 확보하지 못해 복구 원인을 단정하지 않는다. 첫 `componentsVersion.json` 메시지는 경고이고 마지막 치명적 메시지는 backend 소켓 연결 실패다.
- 도구 경로: 다른 Node 버전의 검증 프로세스는 엔진 조건을 만족하지 못했다. 고정 런타임 PATH를 사용한 frozen install 및 모든 앱 검증은 PASS. 일반 터미널에서도 README의 버전 확인 필요.
- ESLint: 9 계열 지원 종료·Next 통합 React 플러그인 peer 제약을 확인하고 ESLint 10 + 호환되는 공식 Next/TS/Hooks 플러그인 조합으로 수정. 최종 lint PASS. peer 무시나 테스트 skip 없음.
- 문서 보존: Next 개발 서버가 AGENTS.md에 안내를 자동 추가했다. `agentRules: false`로 차단하고 작업 전 SHA-256과 같은 원본으로 복구했다. 기존 19개 파일 중 의도한 README·CONTRIBUTING·PROGRESS·TEST_REPORT 4개만 변경, 나머지 15개 동일, 삭제 0개. 기존 테스트 삭제 없음.
- 남은 한계: 정상 정적 페이지여서 실제 지연/throw를 발생시킨 Next 경계 통합 검증은 아직 없음. 로딩 컴포넌트 파일 존재를 실제 통신 복구 통과로 처리하지 않는다.

## 결함 양식

- ID / 발견 단계 / 관련 AC:
- 현상과 사용자 영향:
- 환경·사전 조건:
- 재현 단계:
- 기대 결과 / 실제 결과:
- 원인 확인 여부:
- 수정 내용·관련 커밋:
- 재검증·회귀 결과:
- 공개 가능한 캡처·trace:

## 측정 양식

| 관찰 항목 | 조건·표본 수 | 목표 | 실제 측정 | 해석·한계 |
|---|---|---|---|---|
| 변경 전파 시간 | 100개 이슈·사용자 2명·20회 이상 | 초기 2초 이내 | 미측정 | 운영 보장 아님 |
| 저장 응답 전 이동 | 응답 1초 지연 | 먼저 이동+저장 중 표시 | 미실행 | 최종 저장 성공과 구분 |

## 최종 판정

D1/V01 및 D2/P02의 명시한 범위는 PASS. D2에서 로컬 스택 기동·migration 재적용·실제 세션 제목 저장까지 검증했다. 지속 실행 상태는 다음 작업 때 다시 확인한다. V02 독립 검증 뒤 P03 진행 가능하며 제품 MVP 전체 릴리스 판정은 아직 하지 않는다. P01 이전 파일 보존 독립 증명은 기준 이력 부재로 NOT_RUN이다.

공개 저장소·공개 배포·영상 제작·OAuth 검증은 모두 NOT_RUN. 테스트와 캡처에 실제 사용자 데이터는 없다.
