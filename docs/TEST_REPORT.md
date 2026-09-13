# 테스트 실행 보고서

현재 상태: **D1 / P01 로컬 검증 PASS. 제품 수용 기준 전체는 NOT_RUN.** 별도 V01은 아직 수행하지 않았다.

## 실행 환경

- 실제 실행일: 2026-09-13 (Asia/Seoul), D1 최초 로컬 변경. 커밋 식별자는 최종 보고/`git log` 참조.
- Windows 25H2 (빌드 26200.9445), PowerShell 7.6.5. CPU·메모리 성능 비교는 미측정.
- Node 24.19.0 / pnpm 11.19.0 / Next 16.3.5 / React 19.3.0 / TypeScript 5.9.3.
- Supabase CLI 2.117.0 / PostgreSQL 17.6 / Docker Desktop 4.90.0·엔진 29.7.2 / WSL 2.6.3.0.
- Playwright 1.63.0 / Chromium 153.0.8010.12 (build 1243) / Vitest 5.0.0 + jsdom 30.0.1.
- local: dev 127.0.0.1:3000, production smoke 127.0.0.1:3100. Hosted 환경은 미사용.
- 데이터 없는 골격·비로그인 상태. 제품 테이블/개발 계정 없음. HTTP/WS 장애 주입·실제 협업·성능 측정은 NOT_RUN.
- 일반 사용자 PATH의 Node 24.12.0과 Codex 런타임 24.19.0이 달랐다. 검증 프로세스의 PATH를 후자로 고정했고 전역 Node 설정은 변경하지 않았다. 외부 OAuth 설정 없음.

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

D1 골격과 D2용 로컬 스택 준비는 통과. 별도 V01 후 D2로 진행 가능하다. 제품 MVP의 RELEASE_READY/RELEASE_CANDIDATE 판정은 아직 하지 않는다.

공개 저장소·공개 배포·영상 제작·OAuth 검증은 모두 NOT_RUN. 테스트와 캡처에 실제 사용자 데이터는 없다.
