# ReproBoard

소규모 개발팀이 버그 재현 정보를 모으고, 수정 후 재검증까지 관리하는 협업 보드.

**현재 상태: D1 앱 골격 구현.** 로그인 안내, 데이터 없는 5단계 보드, 오류·로딩·404 경계가 있다. 실제 로그인·이슈 저장·권한·협업은 아직 구현하지 않았다. [진행 기록](docs/PROGRESS.md)과 [검증 결과](docs/TEST_REPORT.md)를 기준으로 구분한다.

## 왜 만드는가

버그가 등록되어도 재현 단계나 실행 환경이 부족하면 개발자는 다시 정보를 요청해야 한다. 수정했다는 표시만 있고 재검증 결과가 없으면 해결 여부도 불명확해진다. ReproBoard는 필요한 정보와 완료 조건이 보이는 기본 흐름을 제공하는 것을 목표로 한다.

## 화면과 시연

`/board`는 백엔드 미연결 상태를 명시한 화면 골격이다. `/login`의 GitHub 버튼은 준비 중이며 실제 인증을 수행하지 않는다. 개발 서버에서 직접 확인하거나 `pnpm test:e2e` 실행 후 `playwright-report/index.html`의 데스크톱·모바일 캡처를 볼 수 있다. 실제 협업 영상과 `/demo`는 D13 범위이며 아직 없다.

## 구현 목표

- 재현 정보가 갖춰진 버그를 Ready로 분류하고, 수정 후 Verify에서 재검증.
- 상태 이동의 낙관적 UI와 실패 복구, version 기반 동시 수정 충돌 처리.
- 두 사용자의 실제 변경 동기화와 연결 복구 후 최신 조회.
- 팀·역할별 권한, 검색·필터 URL, 키보드 이동과 빈/오류 상태.

## 빠르게 실행하기

Node **24.19.0**, pnpm **11.19.0**을 사용한다. `.node-version`, `package.json`의 engines/packageManager, `pnpm-lock.yaml`에 고정했다. `pnpm-workspace.yaml`에서 엔진 검사와 정확한 버전 저장을 설정한다.

현재 검증 환경은 Windows 25H2 / PowerShell 7.6.5다. 일반 Windows 터미널에는 Node 24.12.0도 있어 PATH에 따라 실행 버전이 달랐다. 사용할 터미널에서 먼저 아래 두 버전을 확인한다. Node 버전 관리 도구로 24.19.0을 선택하고, pnpm이 없다면 해당 Node에 포함된 npm으로 `npm install --global pnpm@11.19.0`을 실행한다. 이 전역 설치 명령은 안내이며 이번 작업에서 실행하지 않았다.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

[로컬 보드](http://127.0.0.1:3000/board) · [로그인 안내](http://127.0.0.1:3000/login). `/`는 `/board`로 이동한다. 서버는 loopback에만 바인딩한다. D1 화면은 환경 변수나 Docker 없이도 실행된다. 외부 폰트 다운로드를 요구하지 않는다.

### 검증 명령

| 명령 | 실제 범위 |
|---|---|
| `pnpm lint` | ESLint·TypeScript·React Hooks·Next Core Web Vitals 규칙 |
| `pnpm typecheck` | Next 라우트 타입 생성 후 TypeScript 검사 |
| `pnpm test` | Vitest + Testing Library UI 테스트 |
| `pnpm test:watch` | 같은 테스트의 개발용 watch 모드 |
| `pnpm build` | production build |
| `pnpm start` | 빌드된 앱 실행, 기본 3000 포트 |
| `pnpm exec playwright install chromium` | 고정 Playwright에 맞는 Chromium 설치 |
| `pnpm test:e2e` | production 서버를 3100 포트에서 자동 실행·종료하는 smoke 테스트 |

E2E 전에 `pnpm build`와 브라우저 설치가 필요하다. 보드↔로그인·새로고침, 404 복귀, 키보드 skip link, 390px 폭을 검증한다. 실제 DB/로그인/두 사용자 테스트가 아니다. 이미지 증빙은 HTML 리포트에 첨부된다. `pnpm exec playwright show-report`로 리포트를 열 수 있다. [CI](.github/workflows/ci.yml)는 같은 검사와 빌드·Chromium smoke를 Ubuntu runner에서 수행하도록 구성했으며 GitHub에서의 실행은 아직 NOT_RUN이다.

### 로컬 Supabase / D2 준비

Supabase CLI **2.117.0**을 프로젝트 devDependency로 설치했다. `supabase/config.toml`은 CLI의 실제 `init` 결과를 바탕으로 하며 PostgreSQL 17, Auth, Realtime, Studio, 로컬 메일 확인을 사용한다. 파일 업로드·Edge Functions·Analytics는 현재 범위에 필요 없어 비활성화했다. 새 테이블의 API 자동 노출도 닫았다. D2에서 명시적 grant/RLS/RPC를 추가한다.

1. Docker Desktop에서 Linux 엔진을 실행한다. `docker desktop status`의 running 표시만으로는 충분하지 않다. 아래 서버 버전 조회가 성공해야 한다.
2. 프로젝트 루트에서 다음 명령을 실행한다. 첫 기동은 컨테이너 이미지 다운로드로 시간이 걸린다.

```powershell
docker version --format 'Client={{.Client.Version}} Server={{.Server.Version}}'
pnpm exec supabase --version
pnpm db:start
pnpm db:status
```

Studio는 [127.0.0.1:54323](http://127.0.0.1:54323), API는 `http://127.0.0.1:54321`, DB 포트는 54322다. CLI 상태 출력에는 로컬 키가 포함될 수 있으므로 전체 결과를 커밋·공유하지 않는다. 종료는 `pnpm db:stop`이며 `--no-backup`은 붙이지 않는다. 운영 프로젝트 연결·DB reset은 이 절차에 없다.

아직 migration·seed·개발 사용자·앱 Supabase 클라이언트는 없다. seed 실행은 비활성화했다. D2에서 로컬 대상 보호 검사와 함께 추가하며, 스택 기동과 제품 데이터 저장 성공을 구분한다.

2026-09-13 실제 기동 검증: `pnpm db:start` exit 0, 컨테이너 8개 실행, PostgreSQL 17.6 조회 성공, Auth health와 Studio HTTP 200. 현재 로컬 스택을 실행 상태로 두었다.

Docker/WSL 오류가 재발하면 먼저 `docker version`과 `wsl --list --verbose`를 확인한다. 이번 `Ubuntu distro proxy` 오류는 `backend.sock` 부재였고, 이후 Windows/Ubuntu 양쪽 엔진 응답과 소켓 존재가 확인됐다. 재설치나 초기화는 수행하지 않았다. 엔진 응답이 실패하면 앱 개발은 계속할 수 있지만 DB 검증을 PASS로 처리하지 않는다. Ubuntu 내부 Docker 사용을 위한 WSL 배포판 연동과 Windows에서 사용하는 Docker 엔진은 구분한다. [Docker WSL 안내](https://docs.docker.com/desktop/features/wsl/).

### 환경 변수·외부 설정

`.env.example`에는 값 없는 공개 설정 이름만 있다. 파일을 직접 `.env.local`로 복사하되 기존 파일은 덮어쓰지 않는다. D1은 이를 읽지 않으며 D2에서 연결할 때 값을 채운다.

| 변수 | D2~3에서 얻는 값과 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 로컬 CLI가 표시하는 API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 로컬 publishable key 또는 legacy anon key. service_role/secret key 사용 금지 |
| `NEXT_PUBLIC_SITE_URL` | 앱 origin, 기본 `http://127.0.0.1:3000` |

실제 OAuth는 D3에서 GitHub OAuth 앱 등록, Supabase Auth의 콜백 URL 등록, provider의 Client ID/secret 입력이 필요하다. 인증 콜백 코드는 아직 없으므로 redirect allowlist는 비워 두었다. secret은 서버/로컬 비밀 설정에만 두고 `NEXT_PUBLIC_*`에 넣지 않는다. 로컬 개발 사용자로 진행할 D2에는 외부 계정이 필요 없다. GitHub 원격·공개 배포는 아직 설정하지 않았다.

## 기술과 설계

설치: Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, TanStack Query 5.102.8, Vitest 5.0.0, Playwright 1.63.0. 전체 정확한 버전은 [package.json](package.json)과 lockfile이 기준이다. [Next 지원 조건](https://nextjs.org/docs/app/getting-started/installation)·[Node LTS](https://nodejs.org/en/blog/release/v24.19.0)·[Supabase 로컬 요구 조건](https://supabase.com/docs/guides/local-development/cli/getting-started)을 대조하고 실제 빌드로 확인했다.

Root layout과 페이지는 Server Component다. Query provider는 보드 아래에만 두며 아직 서버 조회를 실행하지 않는다. 공유 임시 UI가 없으므로 Zustand는 설치하지 않았다. 상태 소유권은 서버 데이터=Query, 공유 임시 UI=Zustand, 검색·필터·정렬·선택=URL 계약을 유지한다.

ESLint 9는 지원 종료이고 Next 통합 설정의 React 플러그인 peer는 ESLint 10을 지원하지 않아, ESLint 10.10.0에 호환되는 TypeScript·React Hooks·공식 Next 플러그인을 직접 구성했다. 규칙 전체를 끄거나 peer 조건을 무시하지 않았다. `agentRules: false`는 Next 개발 서버가 기존 AGENTS.md를 자동 수정하는 것을 막는다.

- [제품 규칙과 권한표](docs/PRD.md)
- [아키텍처·캐시·버전·재연결 계약](docs/ARCHITECTURE.md)
- [주요 기술 결정](docs/DECISIONS.md)
- [수용 기준](docs/ACCEPTANCE.md), [실제 테스트 결과](docs/TEST_REPORT.md)
- [기술 사례와 본인 역할](docs/CASE_STUDY.md)

## 코드 길잡이

현재 파일과 책임이다. 이후 단계의 상세·폼·협업 코드는 아직 없다.

| 영역 | 책임 |
|---|---|
| [src/app](src/app) | Root layout, `/board`, `/login`, 오류·로딩·404 경계 |
| [src/features/issues/board-shell.tsx](src/features/issues/board-shell.tsx) | 5단계의 데이터 없는 보드 |
| [src/lib/query/query-provider.tsx](src/lib/query/query-provider.tsx) | 보드의 QueryClient 생명주기, 하위 Suspense 경계 |
| [src/components](src/components) | 공통 로딩·오류 복구 UI |
| [supabase/config.toml](supabase/config.toml) | 로컬 스택 설정, 제품 스키마는 D2 |
| [tests](tests) | 오류 복구 UI와 실제 Chromium 화면 smoke |
| docs | 제품·기술·검증·시연 |

## 한계

계획상 이슈 단위 공동 수정만 지원하며 같은 텍스트의 동시 타이핑·자동 병합은 제외한다. 오프라인 자동 저장 큐·열 내부 수동 정렬·파일 업로드·외부 시스템 연동은 후속 범위다. 실제 구현 후 발견한 제한과 미검증 환경을 여기에 추가한다.

## 기여와 라이선스

[기여 안내](CONTRIBUTING.md), [보안 제보 안내](SECURITY.md), [MIT 라이선스](LICENSE).

개인 프로젝트이며 D1 골격 구성과 로컬 검증에 Codex를 사용했다. 실제 설계·구현·검증 역할은 CASE_STUDY에 단계별 증거와 함께 정리한다. 실제 팀 사용·성능 개선 성과는 아직 측정하지 않았다.
