# 현재 아키텍처

2026-09-27 코드 기준. 단계별 작업 이력은 [PROGRESS](PROGRESS.md), 제품 조건은 [PRD](PRD.md), 실행 근거는 [TEST_REPORT](TEST_REPORT.md)에 둔다. 아래는 구현 계약이며 계획 중인 기능을 포함하지 않는다.

## 실행 경계와 데이터 소유권

Next.js App Router·TypeScript를 사용한다. 서버 라우트는 인증·초기 접근을 처리하고 보드의 클라이언트 경계에서 Query provider를 사용한다. 브라우저의 Supabase 클라이언트는 현재 사용자 JWT로 조회·RPC·Realtime를 수행한다. service role은 앱에 없으며 합성 테스트 fixture 준비/정리에서만 사용한다.

| 데이터 | 소유자 | 계약 |
|---|---|---|
| 팀 이슈·멤버·댓글·활동·알림·검증 기록 | TanStack Query | 보드와 상세는 같은 팀 이슈 Query를 읽는다 |
| 요청별 payload/requestId/expectedVersion·pending/uncertain·메시지 | Zustand의 사용자/팀 범위 store | 이슈 배열이나 URL 값을 복사하지 않는다 |
| 검색·필터·정렬·상세·선택 팀 | URLSearchParams | 파서/정규화/직렬화가 단일 계약이다 |
| 편집 입력·기준 version·필드 오류 | 열린 폼의 React 상태 | 재조회로 자동 교체하지 않는다 |

주요 코드: [live-board](../src/features/issues/live-board.tsx), [issue-commands](../src/features/issues/issue-commands.tsx), [command-store](../src/features/issues/command-store.ts), [issue-cache](../src/features/issues/issue-cache.ts), [Query client](../src/lib/query/client.ts). SSR 응답·환경·쿠키를 서로 다른 사용자 사이에 공유 캐시하지 않는다.

## 인증과 팀 경계

Supabase SSR의 browser/server client·쿠키와 Proxy의 `getClaims`를 사용한다. GitHub PKCE callback은 code를 세션으로 교환한다. 복귀 경로는 앱의 보드/초대 경로로 제한하고, OAuth origin은 임의 Host 헤더 대신 설정된 site URL을 사용한다. 실제 공급자 로그인은 아직 NOT_RUN이다.

개발 로그인은 development 모드·명시적 플래그·정확한 로컬 Supabase 주소를 모두 요구한다. 합성 Owner/Member/Viewer와 별도 팀 사용자는 실제 Auth password 세션을 받는다. production에는 개발 로그인·장애 주입 조작을 노출하지 않는다.

새 워크스페이스의 Owner는 `auth.uid()`로 결정한다. Owner만 Member 초대와 Member↔Viewer 변경이 가능하며 Owner 이전·자가 강등은 지원하지 않는다. 초대는 32바이트 난수, 서버 SHA-256 해시 저장, 24시간·1회·Member 역할 고정이다. 동시 수락은 잠금으로 직렬화한다. 기존 가입자의 수락은 역할을 올리거나 초대를 소비하지 않는다. 프로필 조회는 본인/같은 팀의 최소 표시 정보로 제한한다. RLS helper는 현재 사용자 기준으로 검사해 membership 정책 재귀를 피한다.

## 저장소와 DB 명령

[6개 migration](../supabase/migrations)과 [생성 타입](../src/lib/supabase/database.types.ts)이 기준이다.

| 스키마 | 테이블 | 역할 |
|---|---|---|
| public | profiles, workspaces, workspace_members | 표시 이름·팀·권한 |
| public | issues | 본문·분류·담당자·상태·version, `RB-번호` 키 |
| public | activity_events, verification_runs | 변경 이력과 version 기준 재검증 |
| public | comments, notifications | 일반 텍스트 댓글·멘션 수신 알림 |
| private | workspace_invites, command_receipts | 초대 해시·명령 중복 방지 |

클라이언트 직접 table 쓰기는 grant/RLS로 차단한다. 공개 RPC는 로그인 사용자·현재 팀 권한·허용 필드·같은 팀 참조·필수 상태 조건·expectedVersion을 검사한다. 테이블/함수는 스키마로 한정하고 SECURITY DEFINER의 search_path를 비우며 필요한 execute만 허용한다. UI 비활성화는 DB 검사를 대체하지 않는다.

명령은 사용자/팀/requestId 잠금, 멤버십 검사와 이슈 행 잠금 뒤 실행한다. 요청 해시는 operation·대상·expectedVersion·payload를 포함한다. 같은 requestId/같은 payload는 현재 권한을 다시 검사한 뒤 기존 결과를 반환하고, 다른 payload는 거부한다. 실제 변경·version 증가·활동·receipt는 같은 트랜잭션이다. Verify→Done/수정 중은 검증 기록도 함께 저장한다. 과거 통과 기록을 새 version의 통과로 재사용하지 않는다. receipt 만료/정리 정책은 아직 없다.

댓글은 `actor_id`, `mention_ids`를 사용한다. 같은 팀 수신자만 허용하고 중복·자기 알림을 제거한다. 댓글·activity·notification·receipt가 원자적이며 이슈 version/updated_at은 바꾸지 않는다. 알림은 수신자 본인이고 현재 팀 소속인 경우만 조회·읽음 처리한다. 댓글/알림은 페이지별 200건을 이어 조회하고 활동은 최근 50건이다. HTML을 삽입하지 않는다.

## 낙관적 이동과 충돌

[ADR 01/02](DECISIONS.md)의 서버 캐시+요청별 overlay를 사용한다. 같은 이슈의 로컬 명령은 1개, 다른 이슈는 병렬 가능하다. 전환에 입력이 필요하면 다이얼로그 제출 뒤 overlay를 만든다. 취소는 명령을 만들지 않는다.

- 서버 issue.version이 명령 expectedVersion 이하일 때만 이동 overlay를 적용한다. 더 최신 행은 overlay보다 우선한다.
- 성공 응답을 version 비교로 Query에 반영한 뒤 해당 요청만 지운다. 명확한 거부도 해당 overlay만 제거한다. 전체 배열 snapshot rollback은 없다.
- 10초 타임아웃·응답 유실은 `uncertain`이다. 사용자가 같은 requestId/payload로 결과를 확인한다. 자동으로 새 요청을 만들지 않는다.
- 늦은 응답과 GET은 캐시에 쓰는 시점에 version을 비교한다. 더 낮은 version으로 덮지 않는다. 권한 있는 전체 재조회에서 사라진 행은 제거한다.

동시 편집은 필드 단위가 아닌 이슈 전체 version 검사다. 서로 다른 필드라도 하나만 성공한다. 폼은 입력과 시작 version을 보존하고 최신 내용 비교·입력 복사·명시적 다시 편집을 제공한다. 다시 편집은 사용자가 선택할 때만 최신 값으로 교체한다. 새로고침/상세 닫기/팀 이탈 후 폼 초안 복원은 미지원이다.

## Realtime와 연결 복구

실제 `supabase_realtime` publication: issues INSERT/UPDATE, comments·activity INSERT, notifications INSERT/UPDATE. 이벤트 payload를 배열에 추가하지 않고 관련 Query 재조회 신호로 사용한다. 중복 이벤트는 같은 서버 스냅샷으로 수렴한다.

[realtime-refresh](../src/features/issues/realtime-refresh.ts)와 [issue-realtime](../src/features/issues/issue-realtime.tsx)은 **구독 완료 → 이전 조회 취소 → 멤버십/최신 조회 → 조회 중 dirty 변경 재조회**를 수행한다. dirty 신호를 짧게 모으고 깨끗해질 때까지 수렴한다. 첫 진입도 같은 순서로 구독과 조회 사이 공백을 막는다.

구독 완료는 소켓 채널 가입만을 뜻하지 않는다. `config.postgres_changes_options.wait: true`로 실제 Postgres Changes 수신 준비까지 기다린 뒤 `SUBSCRIBED`에서 최신 조회를 시작한다. 준비 실패는 SDK의 CHANNEL_ERROR/TIMED_OUT 경로와 HTTP 폴링으로 처리한다. 이 옵션이 없는 초기 구현은 새 Realtime 서버의 첫 구독에서 이벤트를 놓칠 수 있었다([공식 설명](https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting)).

WS 연결과 HTTP 요청 성공은 별도다. WS만 불안정하면 HTTP 저장을 허용하고 foreground에서 15초 임시 폴링한다. navigator.onLine은 힌트이며 저장 성공을 보장하지 않는다. Query/mutation은 networkMode=always·retry=false로 paused mutation 자동 재개/오프라인 큐를 만들지 않는다.

멤버십은 15초 및 focus/복구/거부 시, 인증은 60초 및 focus/online/401 시 재검사한다. Viewer 강등 시 쓰기를 막고 초안은 보여주며, 소속 소실 시 팀 데이터/조작을 제거한다. DB는 매 명령마다 즉시 권한을 검사한다. 팀 전환·로그아웃·unmount는 구독/타이머/조회와 해당 캐시/store를 정리하고 늦은 명령 응답이 이전 범위에 재삽입되지 않게 한다. UI 권한 반영까지 폴링 간격의 지연은 가능하다.

## 탐색·접근성·표현

URL은 q/severity/priority/assignee/sort/issue/workspace를 정규화한다. 필터/검색/정렬/팀 전환은 replace, 상세 열기/닫기는 push다. 닫을 때 history.back을 호출하지 않아 직접 진입한 사용자가 앱 밖으로 나가지 않는다. 뒤로/앞으로는 각 URL 상태를 복원한다. 팀 전환은 상세/담당자 선택을 비운다. 한글 조합 중 검색을 보류하고 조합 종료 뒤 300ms debounce한다. Query 목록에서 정렬하며 동률은 id로 고정한다.

SUIT variable 폰트 한 파일과 시스템 대체 폰트를 사용한다. 상태는 색+이름으로 표시하고 심각도/우선순위를 분리한다. native dialog의 Escape·포커스 복귀, 키보드 상태 메뉴, 모바일 전체 화면 상세·닫기 고정, reduced-motion을 지원한다. 긴 본문·권한/로딩/빈 목록·실패/미확정을 구분한다. [화면 검증과 한계](UI_UX_REVIEW.md)를 참고한다.

## 검증·운영 경계

[CI](../.github/workflows/ci.yml)는 앱 정적/단위/build/smoke와 실제 로컬 DB/격리 E2E를 분리한다. 실제 서비스 키는 fixture 관리 외 사용자 동작에 사용하지 않는다. 초기화·seed는 loopback/프로젝트 컨테이너/설정이 일치하는 로컬 DB만 허용한다. 외부 배포, 데이터 보존/백업, 공개 보안 신고 채널과 실제 OAuth는 아직 운영 검증 전이다. [실행 안내](DEVELOPMENT.md) · [보안 정책](../SECURITY.md)
