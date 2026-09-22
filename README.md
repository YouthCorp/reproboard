# ReproBoard

소규모 개발팀이 버그 재현 정보를 모으고, 수정 후 재검증까지 관리하는 협업 보드.

**현재 상태: D8 연결 장애·복구 구현.** HTTP와 Realtime 상태를 구분하고 전체 단절/부분 장애에서 초안을 유지한다. 재구독 후 최신 조회와 조회 중 변경 재확인을 마쳐야 정상으로 표시한다. D3~D7의 권한·상태 규칙·검증·낙관적 이동·충돌 복구를 유지한다. 실제 GitHub OAuth는 외부 앱 미설정으로 NOT_RUN이다. [진행 기록](docs/PROGRESS.md)과 [검증 결과](docs/TEST_REPORT.md)가 기준이다.

## 왜 만드는가

버그가 등록되어도 재현 단계나 실행 환경이 부족하면 개발자는 다시 정보를 요청해야 한다. 수정했다는 표시만 있고 재검증 결과가 없으면 해결 여부도 불명확해진다. ReproBoard는 필요한 정보와 완료 조건이 보이는 기본 흐름을 제공하는 것을 목표로 한다.

## 화면과 시연

로그인 전 `/board`는 데이터 없는 5단계 미리보기다. 로컬 설정 후 `/login`에서 합성 Owner/Member/Viewer/다른 팀 Owner를 선택하면 실제 Supabase 세션으로 전환한다. 로그인 후 새 팀을 만들면 Owner가 되고, 팀 멤버 패널에서 초대 링크를 생성하거나 Member↔Viewer를 변경한다. `/invite`에서 로그인 후 명시적으로 수락한다. Viewer는 읽기 전용이고 다른 팀 데이터는 표시되지 않는다. GitHub 버튼은 실제 provider 설정 상태에 따라 활성화된다. `/demo`와 전체 제품 시연은 D13 범위이며 아직 없다.

로그인한 보드의 5개 열은 같은 Query 목록에서 렌더링된다. 카드를 누르면 `?workspace=…&issue=…`의 상세가 열리고 새로고침·주소 공유·뒤로가기로 복원된다. 제목은 1~120자, 재현 본문·발생 조건·수정 메모는 각각 4,000자, 대상 빌드는 120자까지이며 trim 후 코드 포인트로 센다. 재현 정보 0~4 충족 수와 누락 항목은 입력 상태를 나타낸다.

편집 초안은 서버 값과 분리한다. 원격 변경은 초안을 덮지 않는다. **최신 값 보기**로 서버 값과 내 입력을 비교하고 **내 입력 복사**로 보관한다. **최신 값으로 다시 편집**은 폼 전체를 최신 서버 값으로 교체하며 자동으로 저장하지 않는다. 다시 편집한 뒤 저장해야 새 요청을 보낸다. 서로 다른 필드도 같은 이슈의 version이 바뀌면 충돌한다. 상세 닫기·팀 이탈·로그아웃·새로고침 뒤 초안 복원은 미지원이다. 심각도는 영향, 우선순위는 처리 순서다. [보드](docs/evidence/d4-board.png) · [390px 상세](docs/evidence/d4-mobile-detail.png)는 합성 DB 흐름의 D4 캡처다.

D6의 상태 이동은 카드 손잡이를 다른 열에 놓거나 상세 상단 메뉴에서 확정한다. 저장 응답 전에는 임시 이동과 **저장 중** 표시가 보인다. 아래 순서로 직접 확인할 수 있다.

1. 제목만 생성한 이슈에서 Ready 이동을 누르면 누락 조건이 보인다. 재현 4개 필드·재현됨/간헐적 재현(발생 조건 포함)·심각도·우선순위를 저장한 뒤 Ready로 이동한다. 같은 팀 Owner/Member를 담당자로 저장하면 In Progress로 이동할 수 있다.
2. 수정 메모·대상 빌드를 저장하고 Verify로 이동한다. **검증 실패 → In Progress**는 검증한 앱 버전·환경·실패 이유를 요구한다. 수정 후 다시 Verify에서 **검증 통과 → Done**을 선택하고 실제 검증 버전·환경을 남긴다.
3. Done에서 본문 편집이 잠겼는지 확인한다. **재오픈 → Inbox**에 사유를 입력하면 다시 편집할 수 있고 과거 통과/실패 기록은 남는다. Ready→Inbox와 In Progress→Ready도 이동 사유가 필요하다.

입력 다이얼로그의 취소는 상태를 바꾸지 않는다. 현재 상태의 필수 정보는 일반 편집으로 지울 수 없다. 검증 중 이슈 version이 달라지면 입력을 보존하고 최신 내용을 확인한 뒤 다시 검증하도록 안내한다. [검증 다이얼로그](docs/evidence/d5-verification-dialog.png) · [Done과 과거 기록](docs/evidence/d5-done-history.png)은 D5의 실제 DB 흐름 캡처다.

같은 열의 드롭은 아무 작업도 하지 않으며 열 내부는 최근 수정 순서를 유지한다. 이동 중인 이슈의 추가 편집/이동은 잠기고 다른 카드는 계속 조작할 수 있다. 사유·검증 입력이 필요한 이동은 양식을 제출한 뒤 시작한다. 키보드 사용자는 카드 상세의 이동 메뉴를 이용한다.

10초 타임아웃이나 응답 유실은 **결과 확인 중**으로 표시한다. 실제 저장됐을 수 있으므로 카드의 **같은 요청으로 결과 확인**을 누른다. 미확정 입력 창은 **보드에서 계속 작업**으로 닫아도 요청이 남는다. 자동 재전송·오프라인 큐는 없으며 새로고침·팀 이탈·로그아웃 시 메모리의 요청 정보는 사라진다. 이 경우 서버를 다시 읽어 상태를 확인해야 한다.

동작 영상: [A 실패 중 B 성공](docs/evidence/d6-request-isolation.webm) · [실제 검증 저장 후 응답 유실·재확인](docs/evidence/d6-receipt-recovery.webm). 합성 팀의 Playwright 실제 DB 실행을 녹화한 짧은 WebM이다. 멈추거나 재생 속도를 낮춰 확인할 수 있으며 사용자 사용성·성능 측정 영상은 아니다.

D7 실제 두 사용자 영상: [Owner 브라우저](docs/evidence/d7-owner.webm) · [Member 브라우저](docs/evidence/d7-member.webm). 같은 테스트에서 별도 browser context로 로그인한 두 사용자의 원본 녹화다. 제목/환경의 동시 수정 → 한 건 충돌 → 입력 복사/비교 → 명시적 재편집을 실행한다. 서버의 승자는 실행마다 달라질 수 있다. 전파 지연이나 사용자 피드백 측정 자료는 아니다.

직접 확인할 때는 일반 창과 별도 브라우저 프로필/시크릿 창에서 Owner와 Member로 각각 로그인한다.

1. 같은 합성 팀에서 한쪽이 이슈를 생성하고 상대 보드에 자동 표시되는지 본다.
2. 같은 이슈에 초안을 입력한 뒤 다른 쪽에서 저장하고, 초안 보존·최신 값 비교·입력 복사를 확인한다.
3. 최신 값으로 다시 편집 후 저장하고 다른 쪽의 상세/충돌 안내가 갱신되는지 확인한다.

이미 변경 알림을 받았으면 저장 버튼이 잠기는 것이 정상이다. 정확한 동시 DB 경합은 자동 테스트가 전송 gate로 재현한다.

### D8 연결 안내와 장애 시연

보드와 상세/이동 창은 **오프라인 / 실시간 불안정 / 동기화 중 / 정상**을 안내한다. **HTTP 요청 실패**는 WS 연결 여부와 별도로 표시한다. `navigator.onLine=true`나 구독 성공은 저장 완료 증거가 아니다. 각 명령의 서버 응답과 미확정 표시를 확인한다.

오프라인에는 새 저장을 보내지 않고 입력을 계속 작성할 수 있다. 복귀해도 쓰기는 자동 재개하지 않는다. WS만 실패하면 HTTP 저장은 허용하며 foreground에서 15초마다 임시 조회한다. 멤버십은 정상 연결 중에도 15초마다, focus/복귀/명령 거부 때 재확인한다. Member→Viewer 강등 시 기존 초안을 읽기 전용으로 유지하고 저장/이동을 막는다. 팀 접근을 잃거나 로그아웃하면 해당 캐시·입력·요청·구독을 제거한다. UI 감지에는 조회 간격이 있지만 DB 권한 검사는 매 명령에 적용된다.

실제 합성 세션 장애 영상: [전체 단절→복구 중 추가 변경→초안 보존](docs/evidence/d8-offline-recovery.webm) · [WS 단절의 HTTP 저장/폴링→HTTP 응답 유실 재확인](docs/evidence/d8-partial-failures.webm). 장애는 Playwright의 네트워크 제어로 주입하며 앱/production에는 장애 스위치가 없다. 시연을 다시 실행하려면 준비된 로컬 스택에서 `pnpm test:db-ui tests/db-ui/recovery.spec.mjs`를 실행한다.

직접 조작할 세 가지:

1. 별도 프로필 A/B로 로그인한다. A에서 새 이슈 제목을 쓰고 DevTools의 Offline을 켠 뒤 B에서 기존 이슈를 바꾼다. A를 Online으로 돌려 최신 카드·남은 초안·자동 생성 0건을 확인한다.
2. 장애 영상 또는 위 테스트에서 WS만 끊긴 동안 저장이 되는 것과, HTTP 응답 유실은 **같은 요청으로 결과 확인**을 눌러야 끝나는 것을 비교한다. 정상 네트워크 안내만으로 미확정 표시가 사라지지 않는다.
3. Member 창에서 초안을 쓰고 Owner 창에서 Viewer로 강등한다. 다음 멤버십 조회 후 저장/이동 비활성화와 읽기 전용 초안을 확인하고, 로그아웃 뒤 팀 데이터가 사라지는지 본다.

이해할 개념: **재구독 성공과 동기화 완료는 다르다.** 연결 중 놓친 변경은 새 조회로, 조회하는 동안 발생한 변경은 dirty 후 추가 조회로 확인한다. 구현 근거와 비용은 [ADR 03](docs/DECISIONS.md)에 기록했다.

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

[로컬 보드](http://127.0.0.1:3000/board) · [로그인](http://127.0.0.1:3000/login). `/`는 `/board`로 이동한다. 서버는 loopback에만 바인딩한다. 환경 변수·Docker 없이 실행하면 미리보기만 사용할 수 있다. 실제 저장은 아래 로컬 DB 준비 절차가 필요하다. 외부 폰트 다운로드는 요구하지 않는다.

### 검증 명령

| 명령 | 실제 범위 |
|---|---|
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

캡처는 `playwright-report/index.html`과 `playwright-db-report/index.html`에 있다. `pnpm exec playwright show-report playwright-db-report`로 DB 화면 리포트를 볼 수 있다. 개발 인증 요청에 비밀 값이 포함되므로 DB UI의 trace/storageState는 저장하지 않는다. DB 테스트는 이번 실행의 UUID로 만든 이슈·팀·초대·receipt만 정리하며 기존 데이터는 보존한다. 만료 테스트는 해당 테스트 브라우저의 Auth 세션만 폐기한다. [CI](.github/workflows/ci.yml)는 정적 검사·로컬 보호 검사·빌드·production smoke까지 구성했다. GitHub 실행과 DB 테스트 CI는 NOT_RUN이다.

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

D3~D6 환경에서 올릴 때는 Docker 시작 후 `pnpm install --frozen-lockfile` → `pnpm db:start` → `pnpm db:migrate` → `pnpm db:types` → `pnpm dev` 순서로 실행한다. D7 migration은 `public.issues`를 `supabase_realtime` publication에 추가한다. D8은 schema/type/env/의존성을 변경하지 않아 D7 적용 환경에서는 migration·타입 재생성·reset·계정 재생성이 필요 없다. 외부 OAuth 설정도 로컬 개발의 선행 조건이 아니다.

`db:seed`는 합성 계정 4개와 팀 2개를 생성한다. 무작위 비밀번호는 gitignore된 `.local/dev-accounts.json`에만 저장하며 터미널·채팅에 출력하지 않는다. 재실행 시 합성 계정의 비밀번호·역할을 준비하고 기존 이슈는 보존한다. 같은 예약 이메일/팀 UUID가 다른 데이터에 사용 중이면 중단한다. 테스트 DB에서만 고정된 합성 식별자를 사용한다. Supabase 기본 SQL seed는 꺼져 있어 명시적으로 이 명령을 실행해야 한다.

초기화가 필요한 경우에만 `pnpm db:reset --confirm-local-reproboard` 후 `pnpm db:seed`를 실행한다. **이 명령은 해당 로컬 DB의 데이터·계정을 삭제하고 migration을 다시 적용한다.** wrapper는 API/DB loopback 주소·고정 포트·DB 이름, Docker 프로젝트/작업 경로/실행 상태, 저장소 루트를 대조한다. 원격 URL·`--linked`·다른 대상 인수를 받지 않는다. 운영 DB 초기화에 사용하지 않는다. 일반 개발에는 데이터 보존형 `db:migrate`를 사용한다.

Docker/WSL 오류가 재발하면 먼저 `docker version`과 `wsl --list --verbose`를 확인한다. 이번 `Ubuntu distro proxy` 오류는 `backend.sock` 부재였고, 이후 Windows/Ubuntu 양쪽 엔진 응답과 소켓 존재가 확인됐다. 재설치나 초기화는 수행하지 않았다. 엔진 응답이 실패하면 앱 개발은 계속할 수 있지만 DB 검증을 PASS로 처리하지 않는다. Ubuntu 내부 Docker 사용을 위한 WSL 배포판 연동과 Windows에서 사용하는 Docker 엔진은 구분한다. [Docker WSL 안내](https://docs.docker.com/desktop/features/wsl/).

### 환경 변수·외부 설정

`pnpm db:env`가 확인된 로컬 스택의 공개 설정과 개발 로그인 스위치를 `.env.local`에 기록한다. 기존 내용이 다르면 덮어쓰지 않고 중단하므로 `.env.example`의 이름과 비교해 직접 수정한다. `.env.example`은 모든 값이 비어 있다. 실제 값·합성 비밀번호·Auth 토큰은 커밋하지 않는다.

| 변수 | D2~3에서 얻는 값과 용도 |
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

공식 근거: [Next.js SSR 쿠키·Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [GitHub OAuth/PKCE](https://supabase.com/docs/guides/auth/social-login/auth-github), [로컬 config와 비밀 값](https://supabase.com/docs/guides/local-development/managing-config). hosted 환경을 선택하면 별도 OAuth App에 해당 프로젝트의 Auth callback을 등록하고 Supabase Dashboard → Authentication → Sign In/Providers 및 URL Configuration을 설정한다. 현재 hosted 설정·원격·공개 배포는 수행하지 않았다.

SSR 쿠키 갱신은 Proxy의 `getClaims()`가 검증하고 콜백은 `exchangeCodeForSession()`을 사용한다. 보드·로그인·초대는 dynamic/no-store 응답이며 복귀 주소는 `/board`와 `/invite`로 제한한다. 로그아웃은 현재 브라우저 세션을 종료하고 캐시를 비운다. 갱신이 거부된 세션은 재로그인을 안내한다. 통신 장애를 세션 만료로 단정하지 않으며 발급된 JWT의 즉시 전역 무효화는 보장하지 않는다. D2 localStorage 세션은 자동 이관하지 않으므로 업그레이드 후 한 번 다시 로그인한다.

초대 링크는 `http://127.0.0.1:3000/invite#<token>` 형태다. 원문은 HTTP URL이나 OAuth 복귀 query로 전송하지 않고 브라우저 탭의 sessionStorage에 잠시 보관하며 수락 성공 후 제거한다. DB에는 SHA-256만 저장하고 Member 역할·24시간·1회 사용을 강제한다. 이미 참여한 사용자는 초대를 소비하거나 Viewer에서 승격하지 않는다. Owner는 이전·자가 강등할 수 없다. 링크 원문을 잃으면 새 링크를 생성한다.

## 기술과 설계

설치: Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, TanStack Query 5.102.8, Vitest 5.0.0, Playwright 1.63.0. 전체 정확한 버전은 [package.json](package.json)과 lockfile이 기준이다. [Next 지원 조건](https://nextjs.org/docs/app/getting-started/installation)·[Node LTS](https://nodejs.org/en/blog/release/v24.19.0)·[Supabase 로컬 요구 조건](https://supabase.com/docs/guides/local-development/cli/getting-started)을 대조하고 실제 빌드로 확인했다.

Supabase SDK **2.116.0**(Node ≥22), SSR **0.12.7**(SDK peer `^2.114.0`), 로컬 검증용 pg **8.23.0**(Node ≥16)을 정확히 고정했다. Root layout과 페이지는 Server Component이며 Query provider는 보드·초대 화면의 상호작용 경계에만 둔다. 이슈 목록은 `['issues', workspaceId]` Query 캐시에서 읽는다. 제목 초안은 폼 로컬 state, 팀 선택은 URL `?workspace=`에 둔다. D6에서 보드/상세가 공유하는 요청 잠금·임시 이동을 위해 Zustand 5.0.15를 도입했다. 서버 이슈 배열은 복제하지 않는다. DnD는 @dnd-kit/core 6.3.1을 정확히 고정하고 현재 React peer 범위와 대조했다.

이슈 RPC `create_issue`/`update_issue`/`transition_issue`와 팀·초대·역할 명령은 `auth.uid()`·현재 팀 역할을 재검사하고 같은 사용자/팀/requestId를 트랜잭션 잠금으로 직렬화한다. 이슈 수정/전환은 expectedVersion, 역할 변경은 expectedRole을 검사한다. 검증 시 현재 version에 연결된 `verification_runs`와 상태·activity·receipt를 한 트랜잭션으로 저장한다. 결과·행위자·시각·version은 서버가 결정하며 클라이언트 직접 테이블 쓰기는 차단한다. 초대 원문은 receipt에도 저장하지 않는다. 동일 requestId/다른 payload는 VALIDATION, 오래된 기준은 CONFLICT다. 정상 거부와 전송 오류를 구분하며 미확정 결과는 같은 요청으로 명시적으로 확인한다. 자동 재시도·오프라인 큐는 없다. D6는 실제 DB commit 후 응답 유실·타임아웃과 같은 requestId 재확인을 검증했다. 앱에는 테스트 장애 주입 스위치가 없다.

ESLint 9는 지원 종료이고 Next 통합 설정의 React 플러그인 peer는 ESLint 10을 지원하지 않아, ESLint 10.10.0에 호환되는 TypeScript·React Hooks·공식 Next 플러그인을 직접 구성했다. 규칙 전체를 끄거나 peer 조건을 무시하지 않았다. `agentRules: false`는 Next 개발 서버가 기존 AGENTS.md를 자동 수정하는 것을 막는다.

- [제품 규칙과 권한표](docs/PRD.md)
- [아키텍처·캐시·버전·재연결 계약](docs/ARCHITECTURE.md)
- [주요 기술 결정](docs/DECISIONS.md)
- [수용 기준](docs/ACCEPTANCE.md), [실제 테스트 결과](docs/TEST_REPORT.md)
- [기술 사례와 본인 역할](docs/CASE_STUDY.md)

## 코드 길잡이

현재 파일과 책임이다. 전체 연결 복구와 검색·댓글 등은 이후 범위다.

| 영역 | 책임 |
|---|---|
| [src/app](src/app) | Root layout, `/board`, `/login`, `/invite`, `/auth/callback`, 오류·로딩·404 경계 |
| [src/features/issues/board-shell.tsx](src/features/issues/board-shell.tsx) | 5단계의 데이터 없는 보드 |
| [src/features/issues/live-board.tsx](src/features/issues/live-board.tsx), [issue-form.tsx](src/features/issues/issue-form.tsx) | Query 보드·구조화 생성/편집·상태별 필수 정보·초안 보존 |
| [state-rules.ts](src/features/issues/state-rules.ts), [transition-menu.tsx](src/features/issues/transition-menu.tsx), [issue-history.tsx](src/features/issues/issue-history.tsx) | 순수 전환 규칙·입력 다이얼로그·통과/실패/이동 기록 |
| [command-store.ts](src/features/issues/command-store.ts), [issue-commands.tsx](src/features/issues/issue-commands.tsx), [issue-cache.ts](src/features/issues/issue-cache.ts) | 공유 임시 요청·이슈별 잠금·결과 확정과 version 병합 |
| [issue-realtime.tsx](src/features/issues/issue-realtime.tsx), [realtime-refresh.ts](src/features/issues/realtime-refresh.ts), [conflict-recovery.tsx](src/features/issues/conflict-recovery.tsx) | 변경 알림·구독 후/dirty 추가 조회·초안 비교와 복구 |
| [src/features/auth](src/features/auth), [src/proxy.ts](src/proxy.ts) | GitHub/개발 로그인·쿠키 갱신·만료 안내·로그아웃과 Query 캐시 정리 |
| [src/features/workspaces](src/features/workspaces) | 팀 생성·초대 링크·초대 수락·Member/Viewer 변경 |
| [scripts](scripts) | 로컬 대상 보호·migration/type/env·합성 계정 준비 |
| [src/lib/query/query-provider.tsx](src/lib/query/query-provider.tsx) | 보드·초대의 QueryClient 생명주기, 하위 Suspense 경계 |
| [src/components](src/components) | 공통 로딩·오류 복구 UI |
| [supabase/migrations](supabase/migrations), [config.toml](supabase/config.toml) | 핵심 테이블·RLS·grant·명령, 로컬 스택 설정 |
| [tests](tests) | UI 단위·로컬 보호·실제 DB·production/개발 Chromium 흐름 |
| docs | 제품·기술·검증·시연 |

## 한계

이슈 단위 version 경합을 지원하며 같은 텍스트의 동시 타이핑·자동 병합은 제외한다. Realtime는 이벤트 재생 로그가 아니며 구독 후 다시 조회한다. D8의 지정된 로컬 장애/권한/만료 시나리오는 검증했지만 모든 네트워크 환경이나 운영 규모를 보장하지 않는다. 초안과 미확정 요청의 reload/팀 이탈/로그아웃 후 복원, 오프라인 자동 저장 큐·열 내부 수동 정렬·파일 업로드·외부 시스템 연동은 없다. 전파 지연/100개 이슈 성능과 실제 사용자 피드백은 미측정이다.

## 기여와 라이선스

[기여 안내](CONTRIBUTING.md), [보안 제보 안내](SECURITY.md), [MIT 라이선스](LICENSE).

개인 프로젝트이며 D1~D8 구현과 로컬 검증에 Codex를 사용했다. 실제 설계·구현·검증 역할은 단계 기록과 ADR의 증거로 확인한다. CASE_STUDY의 작성자 역할/성과는 아직 작성 양식이며 실제 팀 사용·성능 개선 성과는 측정하지 않았다.
