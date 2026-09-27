# 로컬 개발·검증·외부 설정

명령은 저장소 루트에서 실행한다. README의 빠른 시작을 확장한 절차이며, 실제 실행 결과는 [TEST_REPORT](TEST_REPORT.md)를 따른다.

## 빠르게 실행하기

Node **24.19.0**, pnpm **11.19.0**을 사용한다. `.node-version`, `package.json`의 engines/packageManager, `pnpm-lock.yaml`에 고정했다. `pnpm-workspace.yaml`에서 엔진 검사와 정확한 버전 저장을 설정한다.

현재 검증 환경은 Windows 25H2 / PowerShell 7.6.5다. 일반 Windows 터미널에는 Node 24.12.0도 있어 PATH에 따라 실행 버전이 달랐다. 사용할 터미널에서 먼저 아래 두 버전을 확인한다. Node 버전 관리 도구로 24.19.0을 선택하고, pnpm이 없다면 해당 Node에 포함된 npm으로 `npm install --global pnpm@11.19.0`을 실행한다. 이 전역 설치 명령은 안내이며 이번 작업에서 실행하지 않았다.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

[로컬 보드](http://127.0.0.1:3000/board) · [로그인](http://127.0.0.1:3000/login). `/`는 `/board`로 이동한다. 서버는 loopback에만 바인딩한다. 환경 변수·Docker 없이 실행하면 미리보기만 사용할 수 있다. 실제 저장은 아래 로컬 DB 준비 절차가 필요하다. 외부 폰트 다운로드는 요구하지 않는다.

### 검증 명령

| 명령 | 실제 범위 |
|---|---|
| `pnpm test:docs` | 저장소 Markdown의 로컬 파일/heading 링크·라이선스 고지 확인 (외부 사이트 가용성 제외) |
| `pnpm lint` | ESLint·TypeScript·React Hooks·Next Core Web Vitals 규칙 |
| `pnpm typecheck` | Next 라우트 타입 생성 후 TypeScript 검사 |
| `pnpm test` | Vitest 순수 상태 규칙 + Testing Library UI 테스트 |
| `pnpm test:watch` | 같은 테스트의 개발용 watch 모드 |
| `pnpm build` | production build |
| `pnpm start` | 빌드된 앱 실행, 기본 3000 포트 |
| `pnpm exec playwright install chromium` | 고정 Playwright에 맞는 Chromium 설치 |
| `pnpm test:e2e` | production 서버를 3100 포트에서 자동 실행·종료하는 smoke 테스트 |
| `pnpm test:local-tools` | 원격/잘못된 DB 대상·확인 없는 reset 거부 검사, Docker 없이 실행 가능 |
| `pnpm test:db` | 실제 로컬 세션의 RLS/RPC·동시성·원자성 검증. 로컬 스택·migration·seed 필요 |
| `pnpm test:db-ui` | 독립 로그인 2개·실제 Realtime/동시 편집·전체/HTTP/WS 단절·복구 중 변경·권한 강등·갱신 만료·구독/타이머/캐시 정리, 기존 생성/편집·검증·DnD·응답 유실·모바일·IME 이벤트·인증 회귀 |

`test:e2e` 전에 `pnpm build`와 브라우저 설치가 필요하다. 보드↔로그인, 404, 키보드, 390px 및 production의 개발 로그인 미노출을 검증한다. 이 smoke와 실제 DB 테스트는 별도다. `test:db-ui`는 아래 로컬 준비 후 실행하며, 3000 포트의 기존 개발 서버를 사용하거나 없으면 자동 시작한다. 기존 서버의 환경 값이 바뀌었다면 재시작한다. 실행 중에는 동일한 합성 계정을 수동 조작하지 않는다.

캡처는 `playwright-report/index.html`과 `playwright-db-report/index.html`에 있다. `pnpm exec playwright show-report playwright-db-report`로 DB 화면 리포트를 볼 수 있다. 개발 인증 요청에 비밀 값이 포함되므로 DB UI의 trace/storageState는 저장하지 않는다. DB 테스트는 이번 실행의 UUID로 만든 이슈·팀·초대·receipt만 정리하며 기존 데이터는 보존한다. 만료 테스트는 해당 테스트 브라우저의 Auth 세션만 폐기한다. [CI](../.github/workflows/ci.yml)는 정적 검사·로컬 보호 검사·빌드·production smoke까지 구성했다. DB/협업 CI와 격리 실행 절차는 아래에 있다. 현재 GitHub 실행 결과는 [TEST_REPORT](TEST_REPORT.md)를 확인한다.

### 로컬 Supabase / 실제 저장 준비

Supabase CLI **2.117.0**을 프로젝트 devDependency로 설치했다. `supabase/config.toml`은 PostgreSQL 17, Auth, Realtime, Studio, 로컬 메일 확인을 사용한다. 파일 업로드·Edge Functions·Analytics와 새 테이블의 API 자동 노출은 비활성화했다. migration이 명시적으로 RLS·SELECT·RPC 권한만 부여한다. Realtime 서버 기동은 앱 구독 구현을 의미하지 않는다.

1. Docker Desktop에서 Linux 엔진을 실행한다. `docker desktop status`의 running 표시만으로는 충분하지 않다. 아래 서버 버전 조회가 성공해야 한다.
2. 프로젝트 루트에서 다음 명령을 실행한다. 첫 기동은 컨테이너 이미지 다운로드로 시간이 걸린다.

```powershell
docker version --format 'Client={{.Client.Version}} Server={{.Server.Version}}'
pnpm exec supabase --version
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm db:env
pnpm db:types
pnpm dev
```

Studio는 [127.0.0.1:54323](http://127.0.0.1:54323), API는 `http://127.0.0.1:54321`, DB 포트는 54322다. 상태 확인 명령 `pnpm db:status`의 출력에는 로컬 키가 포함될 수 있어 전체를 커밋·공유하지 않는다. 종료는 `pnpm db:stop`이며 `--no-backup`은 붙이지 않는다. 다음 작업 시에는 다시 상태를 확인한다. 과거 기동 성공은 현재 실행 상태의 보장이 아니다.

`db:migrate`는 `supabase migration up --local`, `db:types`는 `supabase gen types typescript --local --schema public`을 실행하는 보호된 wrapper다. 생성된 `src/lib/supabase/database.types.ts`는 커밋하며 SQL 변경 후 다시 생성한다. 타입의 Insert/Update 정의는 DB 쓰기 권한을 뜻하지 않는다.

기존 환경에 migration을 적용할 때는 Docker 시작 후 `pnpm install --frozen-lockfile` → `pnpm db:start` → `pnpm db:migrate` → `pnpm db:types` → `pnpm dev` 순서로 실행한다. D7은 issues, D9는 comments/activity_events/notifications를 publication에 추가한다. D9 migration `20260923000100_d9_comments_notifications.sql`을 적용하고 DB 타입을 재생성했다. 기존 DB reset/계정 재생성/env 변경은 필요 없다. 엔진이 꺼져 있으면 Windows에서 `docker desktop start` 후 진행한다. 외부 OAuth 설정도 로컬 개발의 선행 조건이 아니다.

`db:seed`는 합성 계정 4개와 팀 2개를 생성한다. 무작위 비밀번호는 gitignore된 `.local/dev-accounts.json`에만 저장하며 터미널·채팅에 출력하지 않는다. 재실행 시 합성 계정의 비밀번호·역할을 준비하고 기존 이슈는 보존한다. 같은 예약 이메일/팀 UUID가 다른 데이터에 사용 중이면 중단한다. 테스트 DB에서만 고정된 합성 식별자를 사용한다. Supabase 기본 SQL seed는 꺼져 있어 명시적으로 이 명령을 실행해야 한다.

초기화가 필요한 경우에만 `pnpm db:reset --confirm-local-reproboard` 후 `pnpm db:seed`를 실행한다. **이 명령은 해당 로컬 DB의 데이터·계정을 삭제하고 migration을 다시 적용한다.** wrapper는 API/DB loopback 주소·고정 포트·DB 이름, Docker 프로젝트/작업 경로/실행 상태, 저장소 루트를 대조한다. 원격 URL·`--linked`·다른 대상 인수를 받지 않는다. 운영 DB 초기화에 사용하지 않는다. 일반 개발에는 데이터 보존형 `db:migrate`를 사용한다.

Docker/WSL 오류가 재발하면 먼저 `docker version`과 `wsl --list --verbose`를 확인한다. 이번 `Ubuntu distro proxy` 오류는 `backend.sock` 부재였고, 이후 Windows/Ubuntu 양쪽 엔진 응답과 소켓 존재가 확인됐다. 재설치나 초기화는 수행하지 않았다. 엔진 응답이 실패하면 앱 개발은 계속할 수 있지만 DB 검증을 PASS로 처리하지 않는다. Ubuntu 내부 Docker 사용을 위한 WSL 배포판 연동과 Windows에서 사용하는 Docker 엔진은 구분한다. [Docker WSL 안내](https://docs.docker.com/desktop/features/wsl/).

### 환경 변수·외부 설정

`pnpm db:env`가 확인된 로컬 스택의 공개 설정과 개발 로그인 스위치를 `.env.local`에 기록한다. 기존 내용이 다르면 덮어쓰지 않고 중단하므로 `.env.example`의 이름과 비교해 직접 수정한다. `.env.example`은 모든 값이 비어 있다. 실제 값·합성 비밀번호·Auth 토큰은 커밋하지 않는다.

| 변수 | 값과 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 로컬 CLI가 표시하는 API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 로컬 publishable key 또는 legacy anon key. service_role/secret key 사용 금지 |
| `NEXT_PUBLIC_SITE_URL` | 앱 origin, 기본 `http://127.0.0.1:3000` |
| `DEV_LOGIN_ENABLED` | 서버 전용 개발 로그인 스위치. `true`여도 production에서는 비활성화 |
| `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` | OAuth App의 Client ID. 로컬 CLI용 루트 `.env`에 입력 |
| `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` | OAuth App의 Client secret. 로컬 CLI용 루트 `.env`에만 입력, 공개 접두사 금지 |

개발 계정 UI와 자격 정보는 서버에서 `NODE_ENV=development`, `DEV_LOGIN_ENABLED=true`, API=`http://127.0.0.1:54321`을 모두 확인한 경우에만 제공한다. 일반 브라우저 요청은 publishable/anon key와 로그인 사용자 토큰만 사용한다. admin key는 보호된 로컬 Auth seed 도구에만 사용하며 `.env.local`이나 앱 코드에 넣지 않는다.

### GitHub OAuth 설정 — 사용자가 할 외부 작업

외부 OAuth App·secret이 없어 실제 GitHub 승인/취소 왕복은 아직 실행하지 않았다. 아래 설정이 없어도 개발 계정으로 팀·초대·권한을 사용할 수 있다. 이미 외부 앱이 있다면 정확한 로컬 주소와 자격 정보만 대조한다.

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App에서 개발 앱을 등록한다. Homepage URL은 `http://127.0.0.1:3000`, **Authorization callback URL은 `http://127.0.0.1:54321/auth/v1/callback`**이다. Device Flow는 사용하지 않는다. Client ID와 새 Client secret을 직접 보관한다.
2. 저장소 루트의 gitignore된 `.env`에 `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`와 `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`을 입력한다. CLI는 `.env.local`이 아니라 루트 `.env`의 `env(...)`를 읽는다. 기존 파일은 덮어쓰지 않는다. 키를 채팅이나 커밋에 남기지 않는다.
3. `supabase/config.toml`의 `[auth.external.github]`에서 `enabled = true`로 변경한다. `client_id`/`secret`은 이미 위 환경 변수 이름을 참조한다. `pnpm db:stop` → `pnpm db:start`로 설정을 반영한다. reset과 `--no-backup`은 사용하지 않는다.
4. 앱 `.env.local`의 `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`을 확인하고 `pnpm dev`를 재시작한다. **앱 PKCE 콜백은 `http://127.0.0.1:3000/auth/callback`**이며 config의 `additional_redirect_urls`에 정확히 등록되어 있다. GitHub에 등록하는 54321 콜백과 용도가 다르다. 브라우저도 `localhost`와 섞지 말고 127.0.0.1로 접속한다.
5. `/login`의 GitHub 버튼으로 승인→보드, 로그아웃→재로그인을 확인한다. GitHub 승인 취소도 확인한다. 초대 링크에서 로그인한 경우 `/invite`로 복귀하며 자동 가입하지 않는다. 실제 결과를 TEST_REPORT에 추가한다.

공식 근거: [Next.js SSR 쿠키·Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [GitHub OAuth/PKCE](https://supabase.com/docs/guides/auth/social-login/auth-github), [로컬 config와 비밀 값](https://supabase.com/docs/guides/local-development/managing-config). hosted 환경을 선택하면 별도 OAuth App에 해당 프로젝트의 Auth callback을 등록하고 Supabase Dashboard → Authentication → Sign In/Providers 및 URL Configuration을 설정한다. 현재 hosted OAuth 설정·공개 배포는 수행하지 않았다. Git 원격은 후속 작업으로 비공개 연결했다.

SSR 쿠키 갱신은 Proxy의 `getClaims()`가 검증하고 콜백은 `exchangeCodeForSession()`을 사용한다. 보드·로그인·초대는 dynamic/no-store 응답이며 복귀 주소는 `/board`와 `/invite`로 제한한다. 로그아웃은 현재 브라우저 세션을 종료하고 캐시를 비운다. 갱신이 거부된 세션은 재로그인을 안내한다. 통신 장애를 세션 만료로 단정하지 않으며 발급된 JWT의 즉시 전역 무효화는 보장하지 않는다. D2 localStorage 세션은 자동 이관하지 않으므로 업그레이드 후 한 번 다시 로그인한다.

초대 링크는 `http://127.0.0.1:3000/invite#<token>` 형태다. 원문은 HTTP URL이나 OAuth 복귀 query로 전송하지 않고 브라우저 탭의 sessionStorage에 잠시 보관하며 수락 성공 후 제거한다. DB에는 SHA-256만 저장하고 Member 역할·24시간·1회 사용을 강제한다. 이미 참여한 사용자는 초대를 소비하거나 Viewer에서 승격하지 않는다. Owner는 이전·자가 강등할 수 없다. 링크 원문을 잃으면 새 링크를 생성한다.

## 격리된 필수 회귀와 CI

Node/pnpm은 `.node-version`/packageManager 고정값을 사용한다. Docker Desktop의 Linux 엔진이 실행 중이어야 한다. 아래 명령은 저장소 루트에서 순서대로 실행한다. 기존 개발 DB를 reset하지 않는다.

```text
pnpm install --frozen-lockfile
node scripts/ci-stack.mjs start
pnpm db:migrate
pnpm db:env
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test
pnpm test:local-tools
pnpm test:integration:db
pnpm test:integration:ui
pnpm db:types
git diff --exit-code -- src/lib/supabase/database.types.ts
pnpm build
pnpm test:e2e
```

- `test`: 순수 규칙·Query 병합·URL·복구 coordinator와 jsdom UI. DB/실제 협업 통과 근거가 아니다.
- `test:integration:db`: 모든 `tests/db` 사례를 각각 새 사용자 4명·새 팀 2개로 실제 Auth/PostgREST/SQL/Realtime에서 실행한다. 이름 선택 인수를 생략하면 전체 실행이다.
- `test:integration:ui`: 모든 `tests/db-ui` 사례를 각각 새 사용자/팀과 새 Chromium context로 실행한다. 두 사용자 사례는 서로 다른 계정/context를 사용한다. 개발 로그인은 실제 비밀번호 세션이며 OAuth 공급자 화면을 반복하지 않는다. 별도 3200 dev 서버와 `.next/integration`을 사용하므로 3200이 비어 있어야 한다.
- 각 사례가 끝나면 metadata의 실행 UUID를 대조해 생성한 사용자/팀만 삭제한다. 관리자 권한은 합성 fixture 준비·정리/DB 결과 검사에만 쓰고 제품 동작은 사용자 토큰이다. `.local/dev-accounts.json`·기존 팀·env를 덮어쓰지 않는다. `db:env`는 기존 값이 다르면 중단한다. 테스트 계정 준비에는 `db:seed`가 필요 없다.
- 테스트는 직렬·retry=0이다. 동시 실행 lock이 남았다면 이전 프로세스와 `.local/test-runs`의 실행 UUID를 확인한 후 복구한다. 강제 종료 시 남은 fixture를 전체 DB reset으로 지우지 않는다. 이전 `test:db`/`test:db-ui`는 수동 개발 계정을 쓰는 진단 경로이므로 다른 테스트와 동시에 실행하지 않는다.
- 실패 사례만 확인할 때 `pnpm test:integration:ui "테스트 이름의 고유 부분"`처럼 선택할 수 있다. 이는 부분 실행이며 전체 PASS로 보고하지 않는다. 전체 실행은 모든 정적 테스트 이름을 탐색하며 각 하위 프로세스에서 실제 1건 실행을 확인한다. 실패 시 중단하고 이후 사례는 NOT_RUN이다.
- 결과: `test-results/integration/{db,ui}.json`은 비밀 값 없는 이름/결과와 허용 목록의 실패 분류만, `.local/integration` 로그·브라우저 첨부는 로컬 전용이다. 과거 공개 PNG를 회귀마다 덮어쓰지 않는다. 사용자 비밀번호·Auth trace/storageState·원시 로그는 업로드하지 않는다.

CI의 `app` job은 lint/typecheck/단위/보호/문서/build/production smoke, `database-and-collaboration`은 새 Ubuntu runner의 로컬 Docker stack/migration/타입 일치/실제 DB/전체 핵심 E2E를 실행하도록 구성했다. 고정된 프로젝트 CLI를 사용하고 hosted secret/link/push/reset은 없다. GitHub의 실제 PASS/FAIL과 미실행 범위는 [TEST_REPORT](TEST_REPORT.md)에 기록한다. 로컬 스택을 종료하려면 `node scripts/ci-stack.mjs stop`을 실행한다(볼륨 보존).

공식 근거: [Supabase 로컬 CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Supabase CI 환경](https://supabase.com/docs/guides/deployment/managing-environments), [Playwright CI·단일 worker](https://playwright.dev/docs/ci). 로컬 PASS를 Linux/GitHub PASS로 간주하지 않는다.

## 깨끗한 소스·새 로컬 DB 재현

아래는 Windows PowerShell 절차다. Node 24.19.0·pnpm 11.19.0·Git·Linux Docker 엔진이 필요하다. 새 OS 설치 검증과는 구분한다. `git archive`에는 커밋된 파일만 들어가므로 현재 변경은 먼저 검토·로컬 커밋으로 보존한다. node_modules/.env/.local/.next를 원본에서 복사하지 않는다. 원본 dev 서버와 테스트를 종료하고 3000/3100/3200 및 Supabase 54321~54324 포트를 비운다.

```powershell
# 원본 저장소 루트: 먼저 git status --short가 비었는지 확인
git status --short
$sourceRoot = (Get-Location).Path
$copyRoot = Join-Path $sourceRoot ('.local/cleanroom-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $copyRoot | Out-Null
git archive --format=zip --output="$copyRoot/source.zip" HEAD
Expand-Archive -LiteralPath "$copyRoot/source.zip" -DestinationPath "$copyRoot/reproboard"
# 기존 스택을 실행 중인 경우에만, 해당 원본 루트에서 종료. 볼륨 보존.
node scripts/ci-stack.mjs stop
Set-Location "$copyRoot/reproboard"
node --version
pnpm --version
pnpm install --frozen-lockfile
# 설치 직후, env/seed/스택 시작 전에 1회 실행
node scripts/prepare-cleanroom.mjs
node scripts/ci-stack.mjs start
pnpm db:migrate
pnpm db:seed
pnpm db:env
pnpm db:types
pnpm exec playwright install chromium
pnpm dev
```

`prepare-cleanroom`은 새 archive 복사본만 허용한다. `.git`/`.env`/`.env.local`/`.local`/Supabase runtime이 있으면 중단한다. 복사본 config에만 무작위 `reproboard-cleanroom-<12자리>` project_id를 기록하며 기존 컨테이너/볼륨 이름과 중복 여부를 확인한다. DB 도구는 그 프로젝트의 컨테이너 이름·label·복사본 절대경로와 기존 loopback/포트를 모두 대조한다. 원본 config나 DB reset은 사용하지 않는다. 같은 포트를 사용하므로 두 프로젝트를 동시에 켜지 않는다. [공식 project_id 계약](https://supabase.com/docs/guides/local-development/cli/config#project_id).

브라우저를 새 프로필/시크릿 창으로 열어 `http://127.0.0.1:3000/login` → **합성 Owner** 선택 → **개발 계정으로 로그인** → 제목만 입력 → **버그 등록** → 상세에서 제목 수정 → **변경 저장** → 새로고침으로 저장을 확인한다. 새 DB에는 사용자 4명·팀 2개만 seed되고 이슈는 비어 있다. OAuth 없이 실제 password 세션을 사용한다.

별도 터미널도 복사본 루트에서 실행한다. dev 서버를 닫은 뒤에도 `pnpm test:demo`는 자동 기동한다.

```text
pnpm lint
pnpm typecheck
pnpm test:local-tools
pnpm test:demo
node scripts/export-demo.mjs
pnpm build
pnpm test:e2e
```

`export-demo`는 네 장면이 각각 한 번 PASS인 보고서만 받아 `.local/demo/export`에 PNG/WebM과 비밀 값 없는 결과 JSON을 추출한다. 이미지/영상 검토 후 필요한 파일만 공개 증빙으로 옮긴다.

`test:demo`는 기존 핵심 검증 4건(전체 상태 흐름·두 사용자 충돌·A 실패/B 성공·단절 복구)을 실제 DB로 실행하고 `.local/demo/report.json` 및 `test-results/demo`에 PNG/WebM을 남긴다. 관리자 API는 합성 fixture 준비/정리만 담당하며 화면과 명령은 사용자 세션이다. trace/토큰은 기록하지 않는다. 녹화 중에는 수동 조작하지 않는다. 실행 후 이슈 fixture는 정리되며 계정 4명과 seed 팀 2개는 남는다. [시연 클릭 순서와 증빙](DEMO.md).

원본 복귀: 복사본 앱을 Ctrl+C로 종료 → **복사본 루트**에서 `node scripts/ci-stack.mjs stop` → `Set-Location $sourceRoot` → `node scripts/ci-stack.mjs start` → `pnpm dev`. 두 프로젝트의 볼륨은 보존한다. 복사본 `.env.local`/계정 파일을 원본에 덮어쓰지 않는다. 2026-09-26 실제 재현 PASS. 같은 OS의 pnpm store/Docker 이미지/Chromium 캐시는 재사용했으며 새 OS 설치 검증은 아니다. 복사본의 직접 의존성 28개 경로·고정 버전, 새 DB 생성 타입·lock 내용 일치를 확인했다. 원본 10개 제품 테이블·사용자 id·config/env/계정 파일의 전후 해시가 일치했다. [실행 증빙](evidence/d13-reproduction.json) · [TEST_REPORT](TEST_REPORT.md).

### 공개 배포 전에 사용자가 정할 외부 설정

Git 원격은 [YouthCorp/reproboard](https://github.com/YouthCorp/reproboard)에 비공개로 연결하고 main을 push했다. 호스팅·hosted Supabase 대상은 없으며 공개 전환/앱 배포는 수행하지 않았다. 한 번에 준비할 정보는 공개할 저장소·호스팅 대상·앱 HTTPS origin·개발/운영 Supabase 프로젝트와 GitHub OAuth App이다.

1. 환경마다 GitHub OAuth App을 분리하고 GitHub callback을 해당 Supabase의 `https://<project-ref>.supabase.co/auth/v1/callback`으로 등록한다. Supabase provider에 ID/secret을 입력한다. 앱 URL Configuration은 실제 HTTPS origin 및 정확한 `/auth/callback`이다. 로컬은 위 GitHub OAuth 절차의 54321/3000 주소를 사용한다.
2. 호스팅에는 공개 URL/publishable key와 `NEXT_PUBLIC_SITE_URL`만 앱 용도로 설정한다. `DEV_LOGIN_ENABLED`는 생략/false, `.local`/테스트 계정/CLI OAuth secret/service key는 배포하지 않는다. `NEXT_PUBLIC_*`는 빌드 시 고정되므로 환경별로 다시 빌드한다. [Next 환경 변수](https://nextjs.org/docs/app/guides/environment-variables).
3. 승인된 대상에서만 migration 적용, RLS/grant/publication/함수 권한을 검증한다. 로컬 reset/seed/ci-stack 도구는 hosted에 사용할 수 없다. 배포 후 실제 GitHub 로그인·콜백·로그아웃, 일반 Member/Viewer/타팀 권한, 생성/저장/충돌·재연결, production 개발 계정 미노출 smoke를 별도 실행한다. 완료 전에는 배포 PASS로 표시하지 않는다.

합성임을 명시하고 사용자별 계정을 사용한다. 공유 관리자 자격 증명이나 RLS 해제로 공개 데모를 제공하지 않는다. `/demo` 신규 화면은 후속이다.
