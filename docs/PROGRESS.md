# 진행 기록

현재 상태: D6 / P06 DnD·요청별 낙관적 이동·거부/미확정 결과 복구 로컬 구현 및 관련 검증 완료. D5의 필수 조건·권한·version·원자적 검증 기록을 유지한다. 실제 GitHub OAuth는 외부 앱 미설정으로 NOT_RUN.

현재 단계: D6 / P06 로컬 PASS, V06 독립 검증 대기 (2026-09-21, Asia/Seoul). 사용자의 D6 지시에 따라 진행했으며 별도 V03/V04/V05는 여전히 NOT_RUN이다.

선행 조건: D5 migration·타입을 그대로 사용하고 D6의 정확한 패키지/lockfile을 설치했다. Docker/Supabase와 합성 4계정의 실제 세션을 확인했으며 기존 데이터는 보존했다. 다음 실행 때 엔진 상태를 재확인하며 V06으로 롤백·중복 방지를 독립 검증한 뒤 P07로 진행한다. 실제 GitHub smoke에는 README의 외부 앱 설정이 필요하다.

## 범위와 근거

- 14일·70시간은 계획 예산이며 실제 투입 시간·성과로 계산하지 않는다. 시작 기준일은 2026-09-13, 연속 진행 시 D14는 2026-09-26이다.
- 3~8명 팀, 워크스페이스당 500개 이슈 이하, 합성 100개 기준을 유지한다. 상태 전환·권한·version·멱등성은 DB에서 강제하고 실제 두 사용자·실패·복구 검증을 핵심으로 둔다.
- 서버 데이터는 Query, 공유 임시 UI는 Zustand, 검색·필터·정렬·상세 선택은 URL이 소유한다. Realtime는 재조회 신호다.
- 범위 축소는 아직 없음. 지연 시 ROADMAP의 멘션/알림·초대 UI·장식·공개 배포 축소 규칙을 적용하고 PRD/ACCEPTANCE/README를 함께 맞춘다. ADR은 낙관적 UI·충돌·재연결 3건에 집중한다.
- P00 당시 필수 문서 5종과 AGENTS.md, PROMPTS.md가 모두 있었고 기존 18개 파일은 문서·LICENSE·GitHub 템플릿뿐이었다. 누락된 키트 문서는 없었다. D1의 현재 코드는 아래 실제 경로로 매핑한다.
- P00 당시 `.git`이 없었다. P01에서 `main` 저장소를 초기화했다. 원격 연결·push·공개는 수행하지 않았다.

## 단계 현황

| 단계 | 구현 | 검증 | 근거/미해결 |
|---|---|---|---|
| D1 환경·골격 | DONE: P00/P01 | V01 PASS | README의 지속 실행 상태 단정은 D2에서 수정. P01 전 파일 보존 독립 증명은 여전히 NOT_RUN |
| D2 DB·명령 | DONE: P02 | V02 PASS | reset/migration 재적용·실제 세션 UI/reload·직접 DML 거부·경합·멱등성·거부 원자성 독립 확인. TEST_REPORT 참조 |
| D3 인증·권한 | DONE: P03 로컬 구현 | 로컬 PASS / V03·실제 OAuth NOT_RUN | SSR/PKCE·팀 생성·초대·역할 UI·프로필/RLS. DB 25·DB UI 7건 회귀 PASS. 검증/댓글은 권한표만, 기능은 D5/D9 |
| D4 보드·폼 | DONE: P04 로컬 구현 | 로컬 PASS / V04 NOT_RUN | 5열 Query 보드·URL 상세·구조화 폼·충족/누락·초안 보존. DB 29·DB UI 10건 및 캡처 2장. 상태 이동은 없음 |
| D5 상태·검증 | DONE: P05 로컬 구현 | 로컬 PASS / V05 NOT_RUN | 순수 규칙·전환 RPC·원자적 통과/실패·재오픈·편집 우회 차단. DB 38·DB UI 13건 및 캡처 2장 |
| D6 낙관적 UI | DONE: P06 로컬 구현 | 로컬 PASS / V06 NOT_RUN | DnD·이슈별 잠금·overlay·최신 version 병합, A 실패/B 성공·commit 후 응답 유실·타임아웃 확인. WebM 2개 |
| D7 실시간·충돌 | TODO | 전체 NOT_RUN | D4 구조화 필드 version 경합·초안 유지 검증 PASS. Realtime 구독·변경 전파 없음 |
| D8 연결 복구 | TODO | NOT_RUN | 재연결·HTTP/WS 장애 처리 코드 없음 |
| D9 댓글·알림 | TODO | NOT_RUN | 댓글·알림 코드 없음 |
| D10 URL | TODO | 전체 NOT_RUN | D4 팀/상세 `?workspace=&issue=` 복원·뒤로가기만 구현. 검색·필터·정렬 없음 |
| D11 접근성·UX | TODO | 핵심 흐름 NOT_RUN | D1 skip link·오류 재시도·좁은 화면 smoke만 PASS |
| D12 회귀·CI | TODO | 전체 제품 회귀·원격 CI NOT_RUN | D6까지 Vitest 39·보호 2·DB 38·production smoke 6·DB UI 17건. CI는 정적/보호/production smoke 구성 |
| D13 재현·시연 | TODO | NOT_RUN | D1~D5 캡처·D6 장애 재현 영상 2개. 전체 제품 시연·새 clone 검증 없음 |
| D14 문서·릴리스 | TODO | NOT_RUN | 문서 키트 존재는 구현·릴리스 완료 근거가 아님 |

## 환경 확인 — P00 당시 기록 (현재 결과는 아래 D1 및 TEST_REPORT)

| 항목 | 실제 명령/관찰 | 결과 |
|---|---|---|
| OS·셸 | `$PSVersionTable`, OSVersion, Windows 버전 레지스트리 | PASS: Windows NT 10.0.26200.0 / 25H2, PowerShell Core 7.6.5. OS 제품명 필드는 Windows 10 Home으로 반환 |
| Node | `node --version` | PASS: v24.19.0, Codex 제공 런타임. `.node-version`에 24.19.0 고정 |
| 패키지 매니저 | `pnpm --version`, `Get-Command` | PASS: pnpm 11.19.0, Codex 제공 wrapper. npm/yarn/corepack은 현재 PATH에서 미발견 |
| Git | `git --version`; `git status --short` | CLI PASS: 2.45.0.windows.1 / 저장소 상태 FAIL: `.git` 없음 |
| Docker CLI·Compose | `docker --version`; `docker compose version` | PASS: 29.2.1 / v5.0.2. 이것만으로 컨테이너 기동 성공은 아님 |
| Docker 엔진 | `docker info --format '{{.ServerVersion}}'` | FAIL: 제한 환경의 config 접근 거부 후 권한 확장 읽기 재시도에서도 dockerDesktopLinuxEngine 파이프 없음 |
| WSL | `wsl --status` | PASS: 권한 확장 읽기 조회에서 기본 배포 Ubuntu / 기본 버전 2. 제한 환경에서는 E_ACCESSDENIED. 배포판 실제 실행은 NOT_RUN |
| Supabase CLI | `Get-Command supabase` 및 프로젝트 파일 조사 | NOT_RUN: PATH에 CLI 없고 프로젝트 로컬 설치도 없음. DB 스택·migration 실행 불가 |
| 브라우저 | computer-use의 내장 브라우저로 Node 릴리스 페이지 생성·접근성 트리 확인 | PASS: 실제 페이지 제목·본문 로딩. Playwright 설치·앱 E2E는 NOT_RUN |
| 앱 검증 | package.json·앱·tests 부재 확인 | NOT_RUN: dev/lint/typecheck/test/build, AC01~AC16, CI, OAuth, 화면 캡처·영상·사용자 관찰 |

버전 기준: 설치되어 실제 실행된 [Node 24.19.0 LTS](https://nodejs.org/en/blog/release/v24.19.0)와 [pnpm 11.19.0 정식 릴리스](https://github.com/pnpm/pnpm/releases/tag/v11.19.0)를 선택한다. [pnpm 호환표](https://pnpm.io/installation#compatibility)는 Node 24 + pnpm 11을 지원한다. 최신 버전이라는 주장은 하지 않는다.

[Next.js 설치 문서](https://nextjs.org/docs/app/getting-started/installation)는 Windows와 Node 20.9 이상을 지원한다. [Supabase CLI 문서](https://supabase.com/docs/guides/local-development/cli/getting-started)는 Node 20 이상과 Docker 호환 런타임을 요구한다. 따라서 현재 Node는 문서상 요구 조건을 만족하지만 앱 설치·빌드 호환성은 P01에서 확인한다. P01에서 `packageManager: pnpm@11.19.0`, 정확한 의존 버전·Supabase CLI devDependency 및 `pnpm-lock.yaml`을 실제 설치와 함께 고정한다. 아직 없는 lockfile을 고정 완료로 표시하지 않는다.

## 현재 환경·선행 조건과 외부 작업

- 실제 검증: Node 24.19.0 / pnpm 11.19.0 / Next 16.3.5 / React 19.3.0 / TypeScript 5.9.3 / Supabase CLI 2.117.0. 일반 터미널의 Node 24.12.0과 달라 검증 프로세스의 PATH를 고정 런타임으로 맞췄다. 전역 설정 변경은 하지 않았다. 실행 절차는 README가 기준이다.
- Docker Desktop 4.90.0 / 엔진 29.7.2 / WSL 2.6.3.0. Ubuntu 프록시의 `backend.sock` 부재 오류 이후 Windows·Ubuntu 엔진 응답과 소켓 존재를 확인했다. `pnpm db:start` exit 0, 컨테이너 8개 실행, PG 17.6 조회, Auth·Studio HTTP 200. 재설치·초기화·배포판 제거 없이 진행했으며 재발 원인은 미확정이다.
- D2는 외부 계정 없이 실행한다. PG 17 migration과 보호된 `db:seed/env/reset/types`를 추가했다. 기본 SQL seed 대신 명시적 도구가 합성 계정·팀을 준비한다. `.env.example`은 빈 이름만, `.env.local`과 `.local`은 gitignore이며 앱은 공개 키+실제 사용자 세션만 사용한다. 현재 명령은 README 참조.
- D3 사용자 작업: [README의 GitHub OAuth 설정](../README.md#github-oauth-설정--사용자가-할-외부-작업)에 앱 등록→루트 `.env`→provider 활성화→재기동→실제 승인/취소 순서를 모았다. 홈페이지는 `http://127.0.0.1:3000`, GitHub 등록 콜백은 `http://127.0.0.1:54321/auth/v1/callback`, 앱 PKCE 콜백은 `http://127.0.0.1:3000/auth/callback`. 실제 실행 중인 Auth allowlist에는 앱 콜백이 반영됐고 GitHub provider는 비활성화 상태다. 비밀 값은 채팅·커밋에 남기지 않는다.
- D13~14 공개 작업 전제: 사용자가 GitHub 원격 저장소와 공개 범위, 필요 시 개발/배포용 Supabase·호스팅 대상을 지정해야 한다. 현재는 원격 연결·계정 생성·배포·외부 게시를 하지 않는다. 로컬 개발 자체에는 외부 Supabase 계정이 필요하지 않다.

## 다음 실행 프롬프트

[PROMPTS.md의 V06 — 롤백과 중복 방지 검증](planning/PROMPTS.md#v06--롤백과-중복-방지-검증)을 수행한 뒤 P07로 진행한다. 독립 V03/V04/V05 미실행 사실은 유지한다.

```text
AGENTS.md와 docs/PROGRESS.md를 읽고 docs/planning/PROMPTS.md의 V06을 수행해라. 실제 로컬 DB에서 1초 지연·A 거부/B 성공·같은 카드 연속 이동·빈 열·금지 전환·키보드 메뉴·입력 취소를 독립 검증해라. commit 전 거부와 commit 후 응답 유실을 구분하고 동일 requestId 재확인의 version/activity/검증/receipt가 한 번인지 확인해라. 늦은 조회·성공·실패 응답이 최신 값을 덮지 않는지 검사하고 실제 장애 주입 방법과 PASS/FAIL/NOT_RUN을 기록해라. 기존 데이터·문서·독립 V03~V05 미실행 사실을 보존하고 통과하면 P07을 다음 프롬프트로 지정해라.
```

### D1 / P00 / 2026-09-13

- 완료: 환경·범위·선행 조건 조사. 사용자에게 보이는 앱 동작은 아직 없음.
- 변경: docs/PROGRESS.md 초기화, .node-version 추가. Git 미초기화로 로컬 커밋 없음.
- PASS: 필수 문서·전체 파일 목록 확인, Node/pnpm/Git/Docker CLI/Compose 버전 실행, WSL 상태, 내장 브라우저 실제 페이지 로딩.
- FAIL: git status(저장소 없음), Docker 서버 연결(권한 확장 조회에서도 엔진 파이프 없음).
- NOT_RUN: 앱·DB·E2E·CI·OAuth·AC01~AC16. 코드/설정 부재. 캡처·영상·사용자 피드백 없음.
- 근거: 위 명령 결과·파일별 단계 매핑. SHA-256 대조 PASS: PROGRESS 외 기존 17개 파일 동일·삭제 0개. 필수 문서·Node pin·8줄 단계 기록 확인 PASS.
- 결정: 설치된 안정 Node/pnpm을 기준으로 삼고 서버/임시 UI/URL 소유권 및 DB 명령 계약을 유지한다. ADR 구현 사례는 아직 없음.
- 다음: P01→V01. 로컬 DB는 Docker 엔진·CLI 준비 필요, OAuth·외부 공개는 별도 설정 필요.

### D1 / P01 / 2026-09-13

- 완료: Next App Router·TypeScript 골격, `/`→`/board`, 로그인 안내·5열 미연결 보드·오류/로딩/404 경계. 실제 인증·저장은 준비 중으로 명시.
- 변경: package.json/lockfile·Node/pnpm pin, src, tests, CI, Supabase config/.env.example, README·CONTRIBUTING·TEST_REPORT. Git main 초기화, 로컬 커밋은 최종 보고의 식별자 참조.
- PASS: frozen install, lint, typecheck, Vitest 1건, production build, Chromium E2E 4건, dev 서버·실제 브라우저 로딩.
- PASS: Docker Windows/Ubuntu 응답·소켓, `pnpm db:start`, 컨테이너 8개 실행·PG 17.6 조회·Auth/Studio HTTP 200. DB reset/seed는 실행하지 않음.
- 수정/복구: Node PATH 차이·ESLint peer 호환성 해결. Next의 AGENTS 자동 추가는 비활성화하고 원본 바이트 복구. Docker 프록시 오류는 현재 복구 확인, 근본 원인 미확정.
- 증거: TEST_REPORT의 실제 명령·결과, `playwright-report/index.html`의 데스크톱/390px 캡처 4장. SHA-256으로 기존 19개 중 의도한 문서 4개만 변경·15개 동일·삭제 0개 확인. 사용자 피드백·영상·성능 수치 없음.
- NOT_RUN: 별도 V01, 원격 CI, OAuth, AC01~16 전체 조건, 실제 제품 DB·권한·두 사용자 협업. 미구현 범위를 통과로 표시하지 않음.
- 결정: Query provider는 보드 아래, Zustand 미도입. ADR 3건은 해당 기능 구현 때 검증하며 D1 설정을 새 기술 사례로 부풀리지 않음.
- 다음: V01→P02. 로컬 DB는 실행 중이며 D2 연결 가능; migration·개발 사용자·RLS/RPC·version/receipt 구현이 남음. 외부 공개 없음.

### D1 / V01 / 2026-09-14

- 결과: 앱 골격 PASS. 실제 DB·인증·권한·제품 수용 기준은 NOT_RUN이며 완료로 간주하지 않는다.
- PASS: Node 24.19.0/pnpm 11.19.0, frozen install, 단일 pnpm lockfile, script 존재, lint/typecheck/build, dev 첫 페이지와 새로고침, console warn/error 0.
- PASS: 앱 전체 client 전환 없음. client 경계는 오류 복구와 `/board` 하위 Query provider에 한정된다.
- PASS: 단일 HEAD에서 실제 secret 형식·추적된 비밀 파일 없음. 빈 `.env.example`만 추적되고 env/storageState/temp는 ignore된다.
- NOT_RUN: 최초 커밋이 D1 결과 전체를 한 번에 추가해 P01 이전 baseline이 없으므로 기존 파일 무손실 주장은 독립 증명할 수 없다. 현재 HEAD 이후 삭제는 0개다.
- FAIL: README의 과거 기동 기록 중 “현재 로컬 스택 실행 중” 문구는 현재 상태와 다르다. Docker CLI는 있으나 Linux 엔진·Auth·Studio가 내려가 있다.
- 구분: Supabase CLI 2.117.0/config만 존재하고 migration·seed·앱 client는 없다. GitHub OAuth provider·callback·secret env도 없으며 D3 범위다.
- 다음: Docker Desktop Linux 엔진→서버 버전→`pnpm db:start`/`pnpm db:status` 확인 후 P02. OAuth·원격·배포 없이 migration·개발 사용자·RLS/RPC·version/receipt·로컬 보호 절차를 구현한다.

### D2 / P02 / 2026-09-14

- 완료: 합성 계정의 실제 세션으로 Inbox 제목 생성→조회→수정·reload, Viewer 읽기 전용·타팀 격리, 충돌 초안 유지·명시적 최신 제목 반영.
- DB: 핵심 public 4테이블/private receipt, RLS·SELECT/EXECUTE grant, 내부 함수 차단, auth.uid/역할/허용 필드 검사·version·동시 requestId 잠금·원자적 activity/receipt.
- 로컬: Supabase SDK 2.116.0/pg 8.23.0 고정, migration·seed·env·types·reset 보호 도구. 실제 사용자/이슈 0 확인 후 로컬 reset·migration 재적용·합성 계정 4개/팀 2개 준비 PASS.
- PASS: lint/typecheck/Vitest 1·production build·production smoke 5·로컬 보호 2·실제 DB 14·실제 계정 브라우저 3건. 서비스 키는 Auth seed에만 사용.
- 수정: SDK abortSignal 호출 순서·테스트 lint·기존 dev 프로세스 잠금 충돌 해결. DB UI 검증은 같은 3000 개발 서버 사용. 기존 V01 문서 변경은 보존.
- 증거: TEST_REPORT·DB UI 저장/충돌 캡처. 소스 65개/production 162개에서 실제 비밀 값 일치 0, 기존 V01 기록 동일 확인. 테스트 데이터만 정리하며 trace/storageState·자격 정보는 커밋하지 않음.
- 결정: 서버 캐시는 Query만 소유하고 폼 초안은 로컬 state, 팀은 URL. ADR 02에 D2 기반만 연결; 낙관적 이동·재연결 사례는 아직 제안.
- NOT_RUN/남음: 별도 V02·원격 CI·OAuth·전체 제품 수용 기준·Realtime·응답 유실 장애 주입·실제 사용자 피드백. D3 이상 기능을 완료로 표시하지 않음.
- 다음: V02→P03. 09-15 재개 시 Docker/Supabase/dev를 reset 없이 재기동해 엔진·Auth/Studio/login HTTP 200·합성 팀 2개 유지 확인. 실행은 README 기준, 로컬 커밋 식별자는 최종 보고 참조. 외부 공개 없음.

### D2 / V02 / 2026-09-15

- 결과: PASS. UI mock이 아닌 실제 로컬 Supabase API·일반 사용자 세션·PostgreSQL 사후 조회로 D2 최소 흐름을 독립 검증했다.
- 초기화: loopback API/DB·컨테이너/프로젝트 경로와 합성 데이터만 확인 후 reset. migration·4개 RLS·grant 재적용과 빈 DB를 확인하고 seed/env/types를 복구했다.
- PASS: 수동 Owner UI 생성→DB version 1→reload→수정→version 2→reload, activity/receipt 각 요청 1건, console warn/error 0. DB UI 3/3.
- PASS: 직접 issues insert/update `42501`; Viewer/타팀/anon 명령 거부. 거부 request는 이슈 불변·activity/receipt 0.
- PASS: 동일 version의 Owner/Member 경합 성공 1·CONFLICT 1, 동일 requestId 동시 재전송은 동일 응답·version 증가/activity/receipt 각 1회. DB 14/14·보호 2/2.
- 보안: client env는 publishable/anon key이며 secret/service key가 아니다. admin key는 로컬 Auth seed만 사용. 개발 로그인 자격 노출은 LOW 로컬 전용 위험으로 경계를 유지한다.
- 정리: 요청된 reset이 초기 합성 이슈 1·activity 4·receipt 4를 삭제했고 백업은 없음. 검수 UUID도 정리해 사용자 4·팀 2·이슈/activity/receipt 0. lint/typecheck/Vitest PASS.
- 다음: P03. Docker 상태 재확인 후 로컬 계정으로 팀·초대·역할 권한을 구현하며, 실제 GitHub OAuth smoke는 사용자 provider 설정 전까지 NOT_RUN으로 둔다.

### D3 / P03 / 2026-09-15~16

- 완료: 실제 세션의 워크스페이스 생성자 Owner, Member 초대 링크→로그인→수락, Member↔Viewer 변경·타팀 격리·최소 표시 이름. GitHub UI/PKCE callback·쿠키 갱신·로그아웃·만료 안내 구현.
- DB: D3 migration·profiles/Auth trigger·private invite hash/24시간/Member 고정·행 잠금 수락·Owner/비회원 보호·현재 역할 검사. 생성/수락/역할 변경과 receipt를 원자적으로 처리하며 직접 쓰기는 계속 차단.
- 환경: 공식 Next/Supabase/GitHub 문서와 npm peer를 확인해 SSR 0.12.7 고정. migration/type 생성·DB 설정 보존 재기동 PASS, reset/seed 재실행 없음. 기존 합성 사용자 4·팀 2·프로필 4 유지.
- PASS: frozen install·lint/typecheck·production build, Vitest 3·로컬 보호 2·DB 25·production smoke 6·DB UI 7건. 만료 테스트는 해당 브라우저의 세션만 폐기하며 정상 갱신 Set-Cookie도 확인.
- 수정/관찰: 초대 저장소를 외부 상태 구독으로 정리하고 테스트 URL import·SDK 만료 시각 fixture를 수정. dev/production 캐시 헤더를 구분. dev 탐색의 stream 종료 로그 1회는 원인 미확정이며 흐름은 PASS; TEST_REPORT에 한계 기록.
- 증거: TEST_REPORT·DB UI의 팀 역할 390px/제목 저장/충돌 캡처 직접 확인. 소스 82·production 198개 실제 로컬 비밀 값 일치 0, 생성 타입 재현성 PASS. 테스트 이슈/activity/receipt/invite·오류 주입 함수 0 확인.
- 결정: 이슈·팀·멤버는 Query, 폼/미확정 명령은 로컬 state, 팀 선택은 URL. 초대 원문은 fragment→탭 sessionStorage로 전달하고 DB/receipt에는 해시만 저장. ADR 3건 틀 유지, 기존 V02 기록 보존.
- NOT_RUN: 실제 GitHub 승인/취소·별도 V03·원격 CI·hosted/공개·전체 수용 기준·검증/댓글 동작·Realtime·응답 유실 주입·사용자 피드백. 외부 설정은 README에 한 번에 정리.
- 다음: V03→P04. 핵심 파일은 D3 migration, src/proxy/auth/workspaces, tests/db·db-ui. 로컬 커밋 식별자는 최종 보고 참조. 외부 공개 없음.

### D4 / P04 / 2026-09-16 구현 시작 · 09-20 검증 완료

- 완료: Query 목록 1개로 실제 5열 보드·URL 상세·Inbox 생성/편집. 제목만 등록, 구조화 필드·충족 0~4/누락·severity/priority 도움말·같은 팀 담당자 제공.
- DB: `20260916000100_d4_issue_fields.sql`과 생성 타입. trim/코드 포인트 길이·enum·간헐 조건·담당자·권한·version·requestId·activity/receipt 원자성 강제. 기존 행은 기본값으로 확장하고 reset/seed 재실행 없음.
- 입력: 폼 초안/기준 version을 서버 값과 분리. 재조회 성공/실패 시 유지, 충돌 후 명시적 최신 값 선택으로 교체. 상세 닫기는 미저장 초안을 폐기하며 이동/DnD/Realtime는 미구현.
- PASS: lint/typecheck/build, Vitest 3/3·로컬 보호 2/2·실제 DB 29/29·DB UI 10/10·production smoke 6/6. 기존 테스트를 제거/skip하지 않고 새 상세 흐름에 맞춰 수정.
- 증거: `docs/evidence/d4-board.png`(1440px), `d4-mobile-detail.png`(390px). 합성 별도 팀에서 저장/재조회 후 생성·직접 이미지 확인; 테스트 팀/행은 해당 UUID만 정리.
- 수정한 실패: migration CASE 괄호, 필수 표시를 포함한 라벨 선택, 보드/상세 제목 중복 테스트 선택자, 단일 팀 가정 테스트. URL 이동에 따른 인증 재구독/캐시 초기화 경로도 제거. 읽기 SDK+Query 재시도에 맞춰 장애 테스트 조건 대기.
- 결정: 기존 ADR 02를 전체 Inbox 필드 경합·초안 보존으로 확장. 발생 조건/수정 메모 4,000자·대상 빌드 120자를 PRD에 명시. 패키지/lockfile 버전 변경 없음.
- NOT_RUN/남음: 독립 V03/V04, 실제 OS 한글 IME·스크린리더·GitHub OAuth·원격 CI·새 clone·전체 AC·사용자 피드백. D4 범위의 알려진 차단 결함 없음. D5에서 상태 CHECK/필수 조건·검증 기록을 함께 확장해야 함.
- 다음: V04→P05. 핵심 경로는 issues UI/fields, D4 migration, DB/UI tests, README/TEST_REPORT. 로컬 커밋 식별자는 종료 보고 참조; 공개/운영 변경 없음.

### D5 / P05 / 2026-09-20 구현·검증 · 09-21 마무리

- 완료: 상세의 상태 이동 메뉴·입력 다이얼로그로 Inbox→Ready→In Progress→Verify→통과/실패·Done 재오픈. 누락 조건·오류 포커스·취소·기록 조회·Done 편집 잠금 제공.
- DB: `20260920000100_d5_issue_transitions.sql`을 `pnpm db:migrate`로 적용하고 `pnpm db:types`로 타입 생성. 8개 전환·현재 상태 필수 조건·유효 담당자·최신 version·requestId·검증/activity/receipt 원자성을 강제. reset/seed 재실행 없음.
- PASS: lint/typecheck/build, Vitest 32/32·실제 DB 38/38·DB UI 13/13(09-20), production smoke 6/6·보호 2/2(09-21 재확인). 기존 테스트 제거/skip 없음.
- 검증: 25개 상태쌍·필드 편집 우회·오래된 검증·통과/실패 경합·중복 명령·검증/activity 실패 롤백·Viewer/타팀 거부. 실제 브라우저의 실패→수정→통과→재오픈과 390px·초안 유지·같은 요청 재확인 확인.
- 증거: `docs/evidence/d5-verification-dialog.png`, `d5-done-history.png` 각 1440×1050 실제 DB 흐름 캡처·직접 이미지 확인. D4 캡처는 보존하고 회귀 캡처는 테스트 보고서에 첨부한다.
- 결정: ADR 02만 version에 묶인 검증/전환으로 확장. 이슈는 Query 목록 1개, 입력은 폼 state, 상세는 URL. 기존 패키지/lockfile·D2~D4 migration 유지, DnD/낙관적 이동 없음.
- 재개/정리: 종료된 Docker/Supabase 재기동 PASS. 실제 비밀 값 대조는 소스 99·production 198개 일치 0. 최종 사용자/프로필 각 4·팀 3·이슈 1·activity 3·receipt 7·초대 1·검증 0을 보존하고 오류 주입 함수 0 확인.
- NOT_RUN/남음: 독립 V03/V04/V05·실제 GitHub OAuth·OS IME·스크린리더·원격 CI·전체 AC·사용자 피드백. D5 차단 결함은 발견하지 못했으며 commit 후 응답 유실·DnD/낙관적 이동은 D6, Realtime는 D7이다.
- 다음: V05→P06. 핵심 파일은 state-rules/transition-menu/issue-history·D5 migration·DB/UI tests·README/TEST_REPORT. 로컬 커밋 식별자는 종료 보고 참조; 외부 공개/운영 변경 없음.

### D6 / P06 / 2026-09-21

- 완료: 카드 손잡이 DnD·기존 키보드 이동 메뉴·입력 후 낙관적 이동. 저장 중/결과 확인 중·같은 요청 재확인, 같은 이슈 편집/이동 잠금·다른 카드 병행 제공.
- 변경: `command-store`/`issue-commands`/`issue-cache`와 보드·상세·폼. Query는 서버 이슈를, Zustand는 요청/overlay만 소유한다. 성공 값 반영 후 해당 요청 제거, 거부도 해당 요청만 제거하며 낮은 version 응답/조회는 병합하지 않는다.
- 환경: 공식 DnD/Query/Zustand 문서·npm peer를 확인해 @dnd-kit/core 6.3.1·Zustand 5.0.15를 정확히 고정. frozen install PASS. 기존 DB/migration/type/env 유지, reset/seed 없음.
- PASS: lint/typecheck/build, Vitest 39/39·실제 DB 38/38·DB UI 17/17·production smoke 6/6·보호 2/2, 총 102건. dev 보드 HTTP 200.
- 검증: 지연 A의 실제 CONFLICT 동안 B 성공·다른 사용자 제목 보존, 실제 Verify→Done commit 후 응답만 유실·같은 요청 효과 1회, 10초 타임아웃·최신 GET 뒤 과거 성공 응답·금지/동일 열·취소·키보드 메뉴 확인.
- 수정한 실패: DnD hook 반환값을 분해해 refs lint 추론 문제 해결. 드롭 후 라이브러리의 50ms 입력 억제를 테스트에서 정리 대기하고, 기존 카드의 단일 버튼 가정은 이름 있는 상세 버튼 선택으로 수정. assertion 삭제/skip 없음.
- 증거/결정: `docs/evidence/d6-request-isolation.webm`, `d6-receipt-recovery.webm` 실제 합성 DB 녹화·프레임 확인. ADR 01을 실제 실패/응답 유실 사례로 작성하고 기존 3개 틀 유지. 이후 테스트 캡처/영상은 보고서 첨부로 남겨 역사 자료를 덮지 않는다.
- NOT_RUN/남음: 독립 V03~V06·실제 OAuth·원격 CI·전체 AC·실제 터치 DnD/OS IME/스크린리더·사용자 피드백. D6 차단 결함은 발견하지 못했다. 새로고침/팀 이탈 후 미확정 요청 복원·전체 오프라인/Realtime는 D7~D8 범위.
- 정리/다음: 실제 비밀 값 대조 소스 106·production 198개 일치 0, 기존 사용자/프로필 4·팀 3·이슈 1·activity 3·receipt 7·초대 1 유지, 검증/오류 주입 함수 0. V06→P07; 로컬 커밋은 종료 보고 참조, 외부 공개/운영 변경 없음.

## 하루 기록 양식

### D__ / 실제 날짜

- 완료한 사용자 동작:
- 실제 변경 파일·로컬 커밋:
- 실행한 검증과 결과:
- 캡처·로그·영상 경로:
- 직접 설명할 수 있게 된 결정:
- 남은 결함/미검증/범위 변경:
- 다음 단계와 선행 조건:

중요한 결정만 DECISIONS에 확장한다. 단계별 전체 대화를 복사하지 않는다.
