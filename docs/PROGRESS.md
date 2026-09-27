# 진행 기록

현재 상태: D14 완료 후 YouthCorp/reproboard 비공개 저장소 생성·origin/main 연결·최초 push 완료. 첫 원격 CI가 시작됐으며 최종 결과는 TEST_REPORT를 따른다. 실제 OAuth·공개 배포는 NOT_RUN, 릴리스 후보를 유지한다.

현재 단계: D14 문서·릴리스 준비 완료 (2026-09-27, Asia/Seoul). 신규 기능 동결을 유지한다. 다음은 CASE_STUDY 2페이지 초안 검토와 릴리스 메모의 외부 설정·실제 검증이다.

선행 조건: Git 원격은 YouthCorp/reproboard에 비공개로 연결했다. 비공개 신고 채널·OAuth App·호스팅 대상은 미설정. 공개 전환/앱 배포는 수행하지 않았다. 과거 D9 콜드스타트 대기 실패 원인은 미확정이며 reload 후 초안/미확정 요청 복원은 미지원이다.

## 범위와 근거

- 14일·70시간은 계획 예산이며 실제 투입 시간·성과로 계산하지 않는다. 시작 기준일은 2026-09-13, 연속 진행 시 D14는 2026-09-26이다.
- 3~8명 팀, 워크스페이스당 500개 이슈 이하, 합성 100개 기준을 유지한다. 상태 전환·권한·version·멱등성은 DB에서 강제하고 실제 두 사용자·실패·복구 검증을 핵심으로 둔다.
- 서버 데이터는 Query, 공유 임시 UI는 Zustand, 검색·필터·정렬·상세 선택은 URL이 소유한다. Realtime는 재조회 신호다.
- D10 기능 동결: 미구현 /demo 신규 화면은 후속으로 옮기고 D13은 기존 합성 계정의 실제 앱으로 시연한다. 초대·댓글·멘션·알림은 유지한다. 지연 시 ROADMAP의 멘션/알림·초대 UI·장식·공개 배포 축소 규칙을 적용하고 PRD/ACCEPTANCE/README를 함께 맞춘다. ADR은 낙관적 UI·충돌·재연결 3건에 집중한다.
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
| D7 실시간·충돌 | DONE: P07 로컬 구현 | 로컬 PASS / V07 NOT_RUN | 실제 Postgres Changes·구독 공백/중복 프레임·독립 2사용자 경합/입력 복구·pending/늦은 응답, 영상 2개 |
| D8 연결 복구 | DONE: P08 로컬 구현 | 로컬 PASS / V08 NOT_RUN | 전체/WS/HTTP 단절·복구 중 변경·무자동 큐·초안·강등/멤버십 소실·갱신 만료·구독/타이머/캐시 정리, 장애 영상 2개·ADR 03 |
| D9 댓글·알림 | DONE: P09 로컬 구현 | 로컬 PASS / V09 NOT_RUN | 원자적 댓글/멘션 알림·수신자 읽음·본문 version 불변·실시간/응답 유실. DB 46·DB UI 28·캡처 2장, 초기 기동 1회 이벤트 대기 실패 원인 미확정 |
| D10 URL | DONE: P10 로컬 구현 | 로컬 PASS / V10 NOT_RUN | 파서/정규화·검색/필터/안정 정렬·공유 로그인·history·IME 이벤트. 단위 57·DB UI 32·production smoke 6, 캡처 1장. 신규 기능 동결 |
| D11 접근성·UX | DONE: P11 로컬 구현 | 로컬 핵심 PASS / V11 NOT_RUN | 키보드 생성→Done·포커스·100개 긴 한글 카드·390/768/1440px, production 조작 30회. TEST_REPORT 참조 |
| D12 회귀·CI | DONE: P12 로컬 구현 | DB 46·격리 UI 35·단위 57·보호 4·smoke 6 PASS / CI NOT_RUN | 사례별 사용자/팀·서버 격리, 필수 회귀와 CI 구성. TEST_REPORT |
| D13 재현·시연 | DONE: P13 로컬 | README 새 소스/빈 DB·실제 시연 4·smoke 6 PASS | 별도 project/volume·28개 의존성·원본 데이터 보존, 영상 5/PNG 8. OAuth/공개 배포 NOT_RUN |
| D14 문서·릴리스 | DONE: P14 로컬 준비 | 문서·lint·보호 6 PASS / 외부 NOT_RUN | 사례 3건+2페이지 초안·라이선스/링크·v0.1.0 후보. 정식 태그/공개 없음 |

## UI/UX 개선 — 2026-09-27

- 기존 구현·규칙과 실제 앱을 확인하고 합성 16개 동일 데이터로 1440/768/390px 개선 전→대표 화면 1차→전체 적용 후 캡처를 남겼다. SignalDesk 실제 비교는 자료 부재로 NOT_RUN.
- 단계별 작업 보드와 문서형 상세를 선택했다. 팀/연결 도구를 압축하고 카드에 담당자를 표시, 상세 상단에 분류/담당자를 모았다. 키보드 이동·조건·Query/overlay/URL 계약은 유지했다.
- SUIT/Pretendard/맑은 고딕 실제 화면 비교 후 SUIT 2.0.1 자체 호스팅 1파일·OFL 라이선스를 추가했다. 한글 상태/역할/오류 문구와 재현 정보 충족 수를 정리했다.
- lint/typecheck·단위 57·build PASS. 실제 DB/두 context UI 35 PASS, 마지막 수정 관련 URL 4/팀 4·화면/모바일/대체 폰트/Viewer 4·production smoke 6 PASS. 삭제/skip/retry 증가 없음.
- 초기 회귀 5 FAIL 중 문구 selector 4건과 숨겨진 연결 복구 버튼 1건을 고쳤다. 추가 검사에서 모바일 필터 초기 펼침 경합을 수정했다. 상세 재조회 중 초안과 닫기 후 조건/포커스도 직접 확인했다.
- production 합성 100개 조작 30회: 상세/필터/검색 중앙값 30/25/319ms, 관찰 longtask 0. 전후 성능 개선·INP·사용자 피드백 주장은 하지 않으며 Profiler/외부 사용자/실제 OS IME/스크린리더는 NOT_RUN.
- 리뷰 fixture와 초기 실패의 빈 합성 팀만 정리했다. 원본 제품 10개 테이블·Auth id·env/config/계정 파일 해시 일치, 소스 232/production 201개 실제 비밀 값 일치 0. 원래 팀 3·이슈 1 유지.
- 결정·전후 캡처·회귀·미검증은 [UI_UX_REVIEW](UI_UX_REVIEW.md)에 통합했다. 로컬 제품 근거로 포트폴리오 제작 가능, 실제 OAuth/원격 CI/외부 배포와 D9 과거 콜드스타트 원인 미확정은 별도 한계다.

## D11 / P11 — 2026-09-24~25

- 직접 조작으로 상태 전환 뒤 body로 포커스 소실, 작동하지 않는 드래그 Tab 정지점, 모바일 상세 하단에서 닫기 버튼 소실을 확인했다.
- 모달 첫 포커스/Tab 순환·Escape·제거된 호출자 대체 복귀, 포인터 손잡이 Tab 제외, sticky 닫기와 scroll-padding을 수정했다. 새 제품 기능/의존성/SQL은 없다.
- 실제 Owner 세션으로 키보드 생성→Ready→In Progress→Verify→Done과 DB pass 기록, 오류 연결·취소·직접 진입 복귀를 확인했다. D11 관련 브라우저 3건 PASS.
- 실제 합성 100개·120자 한글 제목·빈 Done 열에서 390/768/1440px 가로 넘침 없음, 모바일 전체 상세/닫기 유지 PASS. before/after 포함 PNG 5장 직접 검토.
- production 동일 환경 10회씩: 상세 중앙값 31ms/최대 31ms, 필터 22.5/30ms, 검색(300ms debounce 포함) 326/334ms. 전후 개선·INP 주장은 하지 않는다.
- lint/typecheck·단위 57·build PASS. 장시간 렌더링 문제 미관찰로 Profiler/최적화 NOT_RUN. 외부 사용자/스크린리더/실제 OS IME NOT_RUN, 자기 검증이다.
- 증빙과 최종 회귀 결과는 TEST_REPORT. 신규 기능 동결 유지; 사용자 지시로 D12의 실제 수용 기준·격리·CI 검증으로 이어간다.

## D12 / P12 — 2026-09-25~26

- 각 DB/UI 사례마다 새 합성 사용자 4명·팀 2개, 별도 프로세스와 3200 dev 서버를 사용한다. 개발 계정 파일/기존 팀을 보존하며 metadata 대조 후 해당 fixture만 정리한다.
- CI에 로컬 Supabase migration·타입 일치·격리 DB/두 context E2E job을 추가했다. 원격 secret·link/push/reset은 없으며 GitHub 실행은 NOT_RUN이다.
- 실제 DB/API 46/46 PASS. lint·단위 57·보호 4 PASS, 스택 start/migrate/env/types·타입 diff 일치 PASS. 최종 typecheck/build·production smoke 6 PASS.
- UI 첫 격리 실행은 19 PASS/1 FAIL/15 NOT_RUN: 50ms 입력 억제 정리 전 키보드 Enter가 무시됐다. 고정 sleep 없이 제어 시계로 정리 시간을 진행시켜 해당 사례와 최종 전체 35/35 PASS (retry=0).
- 영상 가독성 대기는 제거하고 드래그 DOM/네트워크/SQL 조건 및 폴링 제어 시계를 사용한다. 검증 삭제/skip/자동 retry는 없다.
- ACCEPTANCE의 AC01~16을 TEST_REPORT에 매핑했다. 실제 OAuth·새 clone/빈 DB·원격 CI·외부 사용자·OS IME/스크린리더는 별도 미검증이며 자기 검증이다.
- 기존 사용자/프로필 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1 유지, 격리 사용자/댓글/알림/오류 함수 0. 실제 비밀 값 일치 0. D13 새 복사본·빈 DB 시연으로 이어간다.

## D13 / P13 — 2026-09-26

- 1f0b86c git archive로 별도 깨끗한 소스 구성. env/계정/node_modules/빌드 복사 없이 README의 설치→새 Docker project/volume→migration→seed→env→앱 절차 PASS.
- 사용자/팀/이슈 0건인 DB에 migration 6개, 합성 사용자 4·팀 2 준비. 직접 로그인→제목 생성→수정→reload PASS, DB Inbox version 2 확인. 원래 OS/패키지·이미지 캐시는 재사용했다.
- 정확한 loopback/컨테이너/경로 보호를 유지한 cleanroom 도구와 시연 설정·검증된 첨부 추출 추가. 직접 의존성 28개·lock 내용·생성 타입 일치, lint/typecheck·보호 6·build·production smoke 6 PASS.
- 새 DB에서 격리된 역할 조회/직접 쓰기 거부/publication RLS/25개 상태 쌍 선택 4건 PASS. 전체 DB 46·UI 35는 D12 실행이며 중복 합산하지 않는다.
- 실제 사용자 시연 4건 PASS, WebM 5·PNG 8·실행/해시 JSON. 첫 캡처 구도 잘림을 고쳐 재녹화(e929668), 영상 프레임·이미지 확인. 무음 짧은 원본이며 3~4분 내레이션 제작은 NOT_RUN.
- 복사본은 수동 확인 이슈 1건만 유지, 임시 테스트 사용자 0. 원본 스택 복귀 후 제품 테이블 10개·Auth user id·config/env/계정 파일 전후 해시 일치. 실제 비밀 값 소스 159/production 200개 일치 0.
- DEMO 클릭/장애/녹화 절차·README OAuth/배포 준비·TEST_REPORT 갱신. /demo 신규 화면·공개 작업 없음. 실제 OAuth/원격 CI/새 OS/외부 사용자와 D9 콜드스타트 원인은 미검증으로 유지.
- 다음: V13→P14. 기존 문서·데이터 보존, ADR 3건 유지. 로컬 커밋은 종료 보고 참조.

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
- D3 사용자 작업: [README의 GitHub OAuth 설정](DEVELOPMENT.md#github-oauth-설정--사용자가-할-외부-작업)에 앱 등록→루트 `.env`→provider 활성화→재기동→실제 승인/취소 순서를 모았다. 홈페이지는 `http://127.0.0.1:3000`, GitHub 등록 콜백은 `http://127.0.0.1:54321/auth/v1/callback`, 앱 PKCE 콜백은 `http://127.0.0.1:3000/auth/callback`. 실제 실행 중인 Auth allowlist에는 앱 콜백이 반영됐고 GitHub provider는 비활성화 상태다. 비밀 값은 채팅·커밋에 남기지 않는다.
- D13~14 공개 작업 전제: 사용자가 GitHub 원격 저장소와 공개 범위, 필요 시 개발/배포용 Supabase·호스팅 대상을 지정해야 한다. 현재는 원격 연결·계정 생성·배포·외부 게시를 하지 않는다. 로컬 개발 자체에는 외부 Supabase 계정이 필요하지 않다.

## 다음 실행 프롬프트

D13 로컬 작업 완료. 독립 V03~V12 미실행 사실을 보존하며 다음은 V13, 통과 후 P14다.

```text
AGENTS.md와 docs/PROGRESS.md를 읽고 docs/planning/PROMPTS.md의 V13을 수행해라. README의 깨끗한 복사본 절차, 새 DB 격리와 원본 데이터 보존, docs/DEMO.md의 실제 영상·캡처·실행 JSON을 대조해라. OAuth·원격 CI·공개 배포 NOT_RUN을 유지하고 기록과 코드가 일치하면 D14 문서·릴리스 후보 정리로 이어가라. 신규 기능을 추가하거나 외부에 공개하지 마라.
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

### D7 / P07 / 2026-09-21, 최종 확인 09-22

- 완료: 실제 이슈 INSERT/UPDATE 알림 후 관련 Query 재조회. 구독 완료 뒤 기존 조회 취소/최신 조회, 조회 중 이벤트 dirty 추가 조회, 50ms 병합으로 중복 알림에도 카드 중복 없음.
- 변경: D7 publication migration, issue-realtime/realtime-refresh, conflict-recovery/issue-form. 기존 RLS·RPC·version/receipt·Query/overlay 소유권 유지, 패키지/env 변경·reset/seed 없음.
- 사용자 흐름: 최신 값 보기·내 입력 복사(거부 시 수동 복사)·명시적 최신 값으로 다시 편집. 서로 다른 필드도 이슈 단위 충돌하며 원격 조회가 초안/version을 자동 교체하거나 재전송하지 않는다.
- PASS: migration/type 생성, lint/typecheck/build, Vitest 44·실제 DB 39·DB UI 20·production smoke 6·보호 2, 총 111건. 최종 D7 3건도 재실행, 보고서는 마지막 실행 범위로 갱신됨.
- 실제 검증: 독립 Owner/Member가 같은 version에서 제목/환경 수정→성공 1/CONFLICT 1·activity/receipt 각 1, 명시적 재편집 후 상대 필드 보존. 실제 WS 프레임 중복·초기 구독 공백/조회 중 변경·A 거부/B 성공·늦은 성공과 원격 최신 값 유지.
- 권한/보존: Viewer는 자기 팀 알림 수신, 타팀에는 내용 미전달·REST 빈 결과. 일반 사용자 세션만 명령에 사용, 기존 사용자 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1 보존, 테스트 소유 UUID만 정리.
- 수정한 실패: 새 테스트의 존재하지 않는 메뉴 이름/상세 닫기 전 입력 경합·테스트 lint를 수정. 기존 충돌 회귀는 Realtime가 제출을 잠그기 전 요청을 보류하는 순서로 조정, assertion 삭제/skip 없음.
- 증거/결정: docs/evidence/d7-owner.webm·d7-member.webm의 같은 실행 두 사용자 녹화와 추출 프레임, TEST_REPORT·ADR 02. 09-22 최종 비밀 값/데이터 점검 PASS. 로컬 커밋 식별자는 종료 보고 참조, 외부 공개 없음.
- 남음/다음: V07→P08. 독립 V03~V07·실제 GitHub OAuth·원격 CI·전체 연결 복구/권한 철회 행렬·100개/20회 성능·실제 사용자 피드백은 NOT_RUN. 초안/미확정 요청의 reload·이탈 후 복원은 미지원.

### D8 / P08 / 2026-09-22

- 완료: offline/실시간 불안정/동기화 중/정상 및 별도 HTTP 실패 안내. WS만 실패하면 저장 허용·foreground 15초 조회, 구독 후 최신 조회→dirty 추가 조회 뒤 정상 표시.
- 초안/요청: 전송 전 offline은 저장 차단·초안 편집 유지. mutations의 pause/자동 재개를 막고 전송 후 결과 불명만 같은 requestId로 명시적 확인한다. 서버 Query/요청 overlay/초안 소유권 유지.
- 권한/수명: 멤버십 주기/focus/복귀/거부 재검사, Viewer 강등 시 쓰기 차단·기존 초안 읽기 전용 보존. 팀 소실/이탈/로그아웃 시 구독·타이머·캐시 제거, 늦은 응답 재삽입 차단. 실제 Auth 갱신 거부는 로그인 안내.
- PASS: lint/typecheck/build, Vitest 47·보호 2·실제 DB 39·DB UI 25·production smoke 6, 총 119건. 전체 DB UI/DB 최종 회귀 모두 PASS, 시연 2건도 별도 출력 경로로 재실행/녹화 PASS.
- 실제 장애: A 단절→B 저장→A 복귀 GET 중 B 추가 변경·초안 보존·자동 POST 0. WS만 차단해 HTTP 저장/폴링, HTTP만 유실해 같은 요청 효과 1회. 실제 강등 FORBIDDEN·멤버십 소실·세션 revoke 후 시계로 갱신 유도·실제 Auth 거부 확인.
- 수정한 실패: DnD 자동 테스트의 초기 조회/화면 가장자리·모달 종료 전 좌표 조작 경합을 안정화했다. 기존 assertion/테스트 유지. Windows 제한 실행에서 production 서버 종료 지연은 해당 테스트 서버만 정리 후 종료 가능한 환경에서 전체 smoke 재실행 PASS.
- 증거/결정: `docs/evidence/d8-offline-recovery.webm`, `d8-partial-failures.webm`와 ADR 03/TEST_REPORT. README에 실행·직접 확인 3개/개념 1개 기록. 소스 120/production 198개 실제 비밀 값 일치 0, 기존 사용자 4·팀 3·이슈 1·activity 11·검증 1·receipt 15 유지. 기존 문서/영상·버전/lockfile/env 보존; reset/seed/운영 변경/외부 공개 없음.
- NOT_RUN/한계: 독립 V03~V08·실제 OAuth·원격 CI·새 clone/reset·100개/20회 성능·OS IME/스크린리더/실제 사용자 피드백. reload/팀 이탈/로그아웃 후 초안/미확정 요청 복원은 미지원. D8 차단 결함은 현재 발견하지 못했다.
- 다음: V08→P09. 다음 프롬프트는 `docs/planning/PROMPTS.md`의 V08(재연결·큐·구독 누수 검증). 로컬 커밋 식별자는 종료 보고 참조.

### D9 / P09 / 2026-09-23

- 범위: D8 기록·실제 코드에 D9 축소가 필요한 필수 대형 결함은 없어 댓글·단순 멘션·인앱 알림을 유지. 기존 문서/데이터·의존성/lockfile/env 보존, reset/seed·운영 변경·공개 없음.
- 구현: `20260923000100_d9_comments_notifications.sql`, 생성 DB 타입, `src/features/comments`, 보드/상세·기존 workspace Realtime 경계 연결. Owner/Member 작성, Viewer 조회/본인 읽음, 타팀/직접 쓰기 차단.
- 명령: trim 1~4,000 코드 포인트·중복 제거 후 멘션 8명·같은 팀 검사·자기 알림 제외. 댓글/activity/알림/receipt 원자성, 동일 requestId 재전송 단일 효과, Done 댓글과 본문 version/updated_at 불변.
- 실제 PASS: `db:migrate`, `db:types`, lint/typecheck/build, Vitest 48·보호 2·DB 46·DB UI 28·production smoke 6 = 고유 130건. 전체 브라우저 최종 3.4분. Member 역할 2명·Viewer/타팀은 실제 비밀번호 세션, 브라우저 협업은 Owner/Member 별도 context.
- UI 검증: 일반 텍스트/XSS 미삽입·중복 WS 프레임·댓글/활동/본인 알림 재조회·읽음/상세 링크·조회 오류/재시도/빈 목록·390px·초안/본문 version·오프라인 무자동 큐·commit 후 응답 유실 같은 요청 확인.
- 수정/한계: 초기 Viewer 입력란 노출을 제거하고 기존 작성자의 강등 시 입력 보존 경계를 유지. SDK GET 재시도 지연과 테스트 브라우저 종료 timeout을 조정. 최초 Realtime 대기 실패 1회는 이후 통과했지만 원인 미확정. 상세 닫기/reload/팀 이탈 후 댓글 초안·미확정 요청 복원 미지원.
- 증거/보존: `docs/evidence/d9-comments.png`, `d9-notifications.png` 각 1440×1100 직접 확인, TEST_REPORT와 ADR 02/03 확장. 소스 130/production 198개 실제 비밀 값 일치 0. 사용자/프로필 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1 유지, 테스트 댓글/알림/오류 함수 0.
- NOT_RUN/다음: 독립 V03~V09·실제 OAuth·새 clone/reset/cold-start 반복·원격 CI·성능·실제 사용자 피드백. 다음 프롬프트 `docs/planning/PROMPTS.md` V09(댓글·알림 데이터 검증), 이후 P10. 로컬 커밋 식별자는 종료 보고 참조.

### D10 / P10 / 2026-09-24

- 구현: board-url 순수 파서/정규화/직렬화·비파괴 필터/안정 정렬, use-board-url history, BoardFilters IME/300ms 검색·분류/담당자 UI. 전체 서버 목록/상세는 같은 Query, 적용 조건은 URL, 미적용 입력만 로컬 state.
- 동작: 검색/필터/정렬/팀 선택 replace, 상세 열기/닫기 push. 공유→다른 계정 로그인·reload·Back/Forward·직접 상세 닫기, 필터 밖 상세·검색 0건·잘못된 enum/UUID·비회원 팀/타팀 id 안내를 검증했다.
- PASS: lint/typecheck/production build, Vitest 57·실제 DB 브라우저 32·production smoke 6 = 고유 95건. D10 전용 4건, 댓글 경합 수정 뒤 3건×2 반복도 PASS. 서비스 키로 사용자 동작을 대신하지 않았다.
- 실제 수정: 로그인 safeNext의 필터 소실, select 라벨, 테스트 시계 경계, 기존 팀 생성 테스트의 느슨한 URL 대기와 알림 재시도 전 장애 해제 경합. assertion/skip/강제 클릭 없이 수정하고 전체 회귀 PASS.
- 보존: 기존 문서·패키지/lockfile/env/SQL·합성 데이터 유지, 새 migration/types/reset/seed 없음. 실패한 팀 시험의 정리는 FK 오류로 롤백됐으며 정확히 확인한 테스트 팀만 제거했다. D9 캡처는 보존하고 새 회귀 이미지는 리포트에 첨부한다.
- 증거: docs/evidence/d10-url-filters.png, board-url.test.ts·tests/db-ui/board-url.spec.mjs, TEST_REPORT. 실제 비밀 값 일치 0, 기존 사용자/프로필 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1·댓글/알림/오류 함수 0 확인.
- 동결: D10 이후 신규 기능 없음. 미구현 /demo는 후속, D13은 기존 실제 앱의 합성 시연. ADR은 3건 유지하고 URL 탐색 결정은 ARCHITECTURE에 기록했다.
- NOT_RUN/다음: 독립 V03~V10·실제 OS IME·OAuth·원격 CI·새 clone/콜드스타트·성능·사용자 피드백. DB 단독/보호 테스트는 D9 이후 관련 변경 없어 이번 단계 재실행 안 함. V10→P11, 로컬 커밋 식별자는 종료 보고 참조.

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

## P14 — 최종 문서와 릴리스 후보 (2026-09-27)

- README를 목적·현재 실제 화면·실행/시연·핵심 3건 중심으로 줄이고 상세 설치/CI/새 DB 재현은 DEVELOPMENT로 분리했다.
- PRD/ARCHITECTURE/ACCEPTANCE/TEST_REPORT를 현재 코드·날짜별 검증과 맞췄고 과거 단계 설명·깨진 heading 링크를 정리했다.
- ADR 3건을 채택된 결정으로 명시하고 CASE_STUDY에 문제→대안→선택→검증→한계 및 2페이지 포트폴리오 초안을 작성했다. 작성자/Codex 역할을 구분했다.
- 기존 MIT·ReproBoard contributors 표기 보존, package license 추가. 직접 의존성 28개·SUIT 원본/OFL·해시를 대조하고 THIRD_PARTY_NOTICES에 기록했다.
- PASS: pnpm test:docs·lint·test:local-tools 6. 외부 URL 37개는 GET 36 PASS/1 시간 제한 NOT_RUN, 해당 1개는 별도 공식 웹 조회 확인. 앱/DB/E2E/build 재실행·새 캡처는 문서 변경 범위상 NOT_RUN이다.
- CONTRIBUTING/SECURITY/DEMO·v0.1.0 RELEASE_NOTES를 정리했다. 기존 영상은 UI 개선 전 기술 증빙이며 현재 해설 영상 링크를 만들지 않았다.
- 남은 조건: 실제 OAuth·원격 CI·공개 보안 신고 채널·선택한 배포 대상 검증. 릴리스 후보 유지, 태그/push/공개는 수행하지 않는다. 다음 실행은 외부 대상 설정 뒤 RELEASE_NOTES 목록의 실제 확인이다.

## GitHub 비공개 연결 — 2026-09-27

- 사용자 요청에 따라 YouthCorp/reproboard를 비공개로 생성하고 기존 README/라이선스/커밋 이력을 유지했다.
- origin HTTPS 연결과 main→origin/main 최초 push PASS. 강제 push·공개 전환·태그/Release·앱 배포는 수행하지 않았다.
- 업로드 전 Git 이력 텍스트 396개에서 제외 파일·알려진 로컬 secret·token/private-key 패턴 일치 0을 확인했다. 값은 출력하지 않았다.
- GitHub의 실제 소스/README·Private 표시와 첫 CI 자동 시작을 확인했다. CI 최종 판정은 확인 후 TEST_REPORT에 기록한다.
- README/실행 안내/보안/릴리스 문서의 원격 미설정 표현을 수정했다. OAuth·공개 보안 신고 채널·호스팅은 여전히 후속이다.

## README 독자 중심 재구성 — 2026-09-27~28

- 평가자·처음 방문한 개발자가 제품을 먼저 이해하도록 목적→실제 화면→주요 기능→핵심 설계→스택→실행 순서로 재구성했다.
- GitHub 연결/비공개 여부·push/CI 시작 기록, 상세 테스트 건수·개발 이력을 README에서 제거하고 기존 진행/검증 문서에 남겼다.
- 검증되지 않은 공개 서비스/OAuth를 주장하지 않고 제품 상태·주요 한계는 하단에 짧게 유지했다. 실제 시연·설계 사례·역할 공개 링크를 보존했다.
- GitHub 공식 README 안내와 Outline의 제품 소개/설치/기여 문서 구성을 참고했다. 별도 단일 표준이 있다고 단정하거나 다른 프로젝트 문구를 복사하지 않았다.
- PASS: 문서 21개·로컬 링크 187개·package 명령 검사와 git diff --check. 앱/DB/의존성 변경은 없으며 해당 회귀 재실행은 NOT_RUN이다.
- 09-28 재개: 이전 커밋/push는 자동 승인 검토 사용량 제한으로 실행되지 않았다. 보존된 변경을 확인하고 같은 범위의 문서 검증·원격 반영을 재개했다.
