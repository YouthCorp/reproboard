# 진행 기록

현재 상태: D2 / P02 로컬 DB·Inbox 제목 생성→조회→수정 구현 및 관련 검증 완료.

현재 단계: D2 / P02 완료, V02 독립 검증 대기 (구현·검증 2026-09-14, 재개 마무리 2026-09-15, Asia/Seoul).

선행 조건: 로컬 Supabase·migration·합성 계정 4개/팀 2개·환경 설정 준비 및 실제 저장 검증 PASS. 다음 실행 시 Docker 상태를 재확인한다. GitHub OAuth·원격·배포는 미설정이며 V02 선행 조건은 아니다.

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
| D2 DB·명령 | DONE: P02 | 로컬 PASS / V02 NOT_RUN | migration·RLS/grant·create/update RPC·합성 seed·실제 세션 UI. DB 14건·DB UI 3건·보호 검사 2건 PASS |
| D3 인증·권한 | TODO | 전체 권한표 NOT_RUN | D2 개발 password 세션·최소 팀/이슈 RLS는 있음. OAuth·팀 생성/초대·역할 변경 UI 없음 |
| D4 보드·폼 | TODO | 전체 제품 흐름 NOT_RUN | 로그인 후 Inbox 제목 목록/폼만 구현. 5열 실제 데이터·상세·재현 필드 폼 없음 |
| D5 상태·검증 | TODO | NOT_RUN | 전환 명령·재검증 코드 없음 |
| D6 낙관적 UI | TODO | NOT_RUN | D2 제목 mutation만 있음. 낙관적 이동·overlay 없음 |
| D7 실시간·충돌 | TODO | 전체 NOT_RUN | D2 제목 version 경합·초안 유지 검증만 PASS. Realtime 구독·변경 전파 없음 |
| D8 연결 복구 | TODO | NOT_RUN | 재연결·HTTP/WS 장애 처리 코드 없음 |
| D9 댓글·알림 | TODO | NOT_RUN | 댓글·알림 코드 없음 |
| D10 URL | TODO | NOT_RUN | D2 팀 선택 `?workspace=`만 있음. 검색·필터·정렬·상세 파서 없음 |
| D11 접근성·UX | TODO | 핵심 흐름 NOT_RUN | D1 skip link·오류 재시도·좁은 화면 smoke만 PASS |
| D12 회귀·CI | TODO | 전체 회귀·원격 CI NOT_RUN | Vitest 1·보호 2·DB 14·production smoke 5·DB UI 3건. CI는 정적/보호/production smoke 구성 |
| D13 재현·시연 | TODO | NOT_RUN | D1/D2 화면 캡처 있음. 전체 시연·영상·새 clone 검증 없음 |
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
- D3 사용자 작업: GitHub Settings → Developer settings → OAuth Apps에서 개발 앱을 등록한다. 홈페이지는 `http://127.0.0.1:3000`, 로컬 Supabase Auth 콜백은 `http://127.0.0.1:54321/auth/v1/callback` 기준으로 P03의 실제 provider 설정과 맞춘다. Client ID/secret은 P03에서 제공할 로컬 비밀 설정에 직접 입력하고 앱 redirect 경로도 P03 구현 후 등록한다. [공식 GitHub OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-github). 비밀 값을 채팅·커밋에 남기지 않는다.
- D13~14 공개 작업 전제: 사용자가 GitHub 원격 저장소와 공개 범위, 필요 시 개발/배포용 Supabase·호스팅 대상을 지정해야 한다. 현재는 원격 연결·계정 생성·배포·외부 게시를 하지 않는다. 로컬 개발 자체에는 외부 Supabase 계정이 필요하지 않다.

## 다음 실행 프롬프트

[PROMPTS.md의 V02 — DB가 실제 기준인지 검증](planning/PROMPTS.md#v02--db가-실제-기준인지-검증)을 실행한 뒤 P03로 진행한다.

```text
AGENTS.md와 docs/PROGRESS.md를 읽고 docs/planning/PROMPTS.md의 V02를 수행해라. create_issue/update_issue의 실제 세션·RLS/grant·version 경합·동일 requestId/다른 payload·원자성을 코드와 로컬 DB로 독립 검증해라. README의 보호된 로컬 명령만 사용하고 기존 사용자 변경을 보존해라. reset 전 로컬 대상과 보존할 데이터를 확인하고 실제 저장 UI·reload·Viewer/타팀 격리를 대조해라. PASS/FAIL/NOT_RUN을 TEST_REPORT/PROGRESS에 기록하고 통과하면 P03을 다음 실행 프롬프트로 지정해라.
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
