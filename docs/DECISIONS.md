# 기술 결정 기록

ADR 01은 낙관적 이동, ADR 02는 실제 두 사용자 충돌, ADR 03은 D8의 연결 장애·복구 검증을 반영한다. 선택을 바꾸면 실제 이유와 영향을 기록한다. 중요한 세 가지를 자세히 남기고 사소한 라이브러리 설정은 늘어놓지 않는다.

## ADR 01 — 낙관적 이동을 서버 값과 분리

- 상태: D6 구현·로컬 검증을 반영한 초안. 독립 V06은 NOT_RUN. Realtime 결합은 D7에서 검증했다.
- 문제: 카드 A의 실패 때 보드 전체 이전 스냅샷을 복원하면 B 또는 다른 사용자의 성공 변경을 잃을 수 있다.
- 고려한 방법: 전체 snapshot rollback / 캐시의 이슈별 변경·복구 / 서버 캐시와 요청별 overlay 분리.
- 선택: Query의 서버 목록 + Zustand의 요청별 임시 overlay. 이슈 배열/본문은 복제하지 않고 requestId·expectedVersion·입력 payload·pending/uncertain만 보관한다. 드래그와 메뉴가 같은 명령 소유자를 사용하며 같은 이슈의 편집/이동을 동기적으로 하나만 예약한다.
- 장점: 실패한 요청의 임시 상태만 제거하고 최신 서버 값을 유지하기 쉽다.
- 비용: 명확한 거부와 응답 불명을 구별하고, 상세를 닫아도 미확정 요청을 보존해야 한다. 목록과 성공 응답 양쪽의 version 비교도 필요하다.
- 실제 구현 파일: `src/features/issues/command-store.ts`, `issue-commands.tsx`, `issue-cache.ts`, `issue-board.tsx`, `transition-menu.tsx`. DnD는 `@dnd-kit/core@6.3.1`의 PointerSensor/열 droppable만 쓰고 수동 정렬·sortable은 도입하지 않았다.
- 실제 반례/검증: `tests/db-ui/optimistic.spec.mjs`에서 A를 전송 전 보류→B 저장 성공→Member의 A 수정→A의 실제 CONFLICT를 재현했다. A만 Inbox로 돌아오며 B의 Ready와 Member의 최신 제목이 남았다. 실제 Verify→Done commit 뒤 응답만 끊은 요청은 같은 requestId 재전송 후 검증/activity/receipt 각 1건이었다. 10초 응답 타임아웃도 같은 요청으로 확인했다.
- 결과와 남은 한계: `acceptIssue`로 성공 값을 먼저 반영하고 해당 overlay만 제거한다. GET version N+2 이후 도착한 성공 N+1은 낮아지지 않았으며 순수 Query 테스트도 늦은 snapshot/receipt를 검사한다. 더 높은 서버 version을 읽으면 미확정 표시를 유지하되 그 서버 상태를 표시한다. 전체 스냅샷 롤백·자동 재시도/오프라인 큐는 없다. 요청은 현재 팀/로그인 수명의 메모리에만 남으며 이탈·로그아웃·새로고침 후 복원은 미지원이다. 실제 Realtime 순서는 D7, 현재 화면을 유지한 단절 복구는 D8에서 검증했다.

## ADR 02 — 이슈 단위 version 충돌

- 상태: D7 실제 두 사용자·실시간 검증 반영. 독립 V07은 NOT_RUN.
- 문제: 두 사람이 오래된 이슈 내용을 저장할 때 조용히 덮어쓰거나, 검증 도중 바뀐 수정 내용에 과거의 통과 결과를 적용할 수 있다.
- 고려한 방법: 마지막 저장 우선 / 편집 잠금 / 정수 version 조건부 수정 / CRDT.
- 선택: expectedVersion을 DB에서 검사하고 충돌 시 초안을 보존한다. Postgres Changes는 최신 Query 재조회의 신호로만 사용한다.
- 장점: 2주 범위에서 수정 손실을 감지하고 사용자 선택을 제공한다.
- 비용: 서로 다른 필드 변경도 충돌하며 자동 병합을 제공하지 않는다.
- 실제 구현 파일: D2/D4/D5 명령 migration, `20260921000100_d7_issue_realtime.sql`, `src/features/issues/issue-form.tsx`, `conflict-recovery.tsx`, `issue-realtime.tsx`, `realtime-refresh.ts`, `issue-cache.ts`.
- 실제 반례/검증: `tests/db-ui/realtime.spec.mjs`의 독립 Owner/Member 세션이 같은 version에서 제목과 환경을 수정했다. 두 요청을 DB 전송 직전 함께 해제하자 성공 1·CONFLICT 1, version +1, 해당 두 requestId의 activity/receipt 각각 합계 1이었다. 패자는 초안 비교·클립보드 복사 후 명시적으로 최신 값을 불러와 새 requestId/최신 expectedVersion으로 편집했고 상대 필드를 유지했다. 자동 재전송은 없었다. [Owner 영상](evidence/d7-owner.webm) · [Member 영상](evidence/d7-member.webm).
- 실시간 결합 검증: 구독 전의 변경은 SUBSCRIBED 후 조회로, 조회 중 변경은 dirty 후 추가 조회로 반영했다. 실제 서버 프레임을 테스트 프록시에서 두 번 전달해도 카드가 중복되지 않았다. A의 지연 요청 동안 B 저장과 상대의 A 변경을 반영하고, 늦은 CONFLICT/성공 N+1 뒤에도 더 높은 서버 version을 유지했다. Viewer/타팀의 실제 SDK 스트림과 REST 조회는 기존 RLS를 따랐다.
- 결과와 남은 한계: DB의 이슈 단위 직렬화와 UI의 선택권을 함께 유지한다. 본문·검증·activity·receipt 원자성과 D6 응답 유실 재확인 회귀도 유지했다. 충돌이 드문 3~8명 팀 MVP를 위한 단순 정책이며 자동 필드 병합/CRDT는 없다. Realtime 전파 시간은 미측정이고 운영 규모 보장이 아니다. 상세 닫기/팀 이탈/로그아웃/reload 뒤 초안 복원은 미지원이고 현재 화면의 연결 복구는 D8의 ADR 03에 기록했다.

## ADR 03 — 변경 알림과 재조회로 복구

- 상태: D8 구현·로컬 장애 검증 반영. 독립 V08은 NOT_RUN.
- 문제: 연결이 끊겼다가 돌아오면 그동안의 변경 이벤트를 놓칠 수 있다.
- 고려한 방법: 이벤트만 직접 캐시에 적용 / 변경 알림→재조회 / 사용자 정의 재생 가능한 이벤트 로그.
- 선택: Postgres Changes를 재조회 신호로 사용한다. WS 구독 완료→기존 GET 취소→멤버십/최신 스냅샷→조회 중 dirty 변경의 추가 조회가 끝난 뒤 정상으로 표시한다. HTTP 요청 실패와 WS 상태, 브라우저 online 힌트를 분리한다.
- 장점: 클라이언트의 복잡한 이벤트 재생 범위를 줄인다.
- 비용: 추가 조회가 발생하고 네트워크 복구 후 잠깐 동기화 대기가 필요하다.
- 실제 구현 파일: `src/features/issues/issue-realtime.tsx`, `realtime-refresh.ts`, `issue-commands.tsx`, `issue-form.tsx`, `src/lib/query/client.ts`, `src/features/auth/use-auth-session.ts`. 서버 행은 Query에만 있고 연결 상태·초안·요청 overlay는 별개다.
- 장애 처리: offline은 전송 전 차단하고 초안을 유지한다. mutations는 `networkMode: always`/`retry: false`로 자동 pause/resume를 막는다. 요청을 보낸 뒤 타임아웃/응답 유실은 거부가 아니며 사용자가 같은 requestId로 확인한다. 성공한 GET/WS 이벤트만으로 미확정 명령을 성공 처리하지 않는다. 읽기도 자동 pause에 갇히지 않으며 HTTP는 10초 제한을 둔다.
- WS만 실패: SDK가 재구독을 맡고 foreground에서 15초 간격으로 HTTP 조회한다. HTTP 저장은 허용한다. HTTP 조회도 실패하면 별도 안내하며 복구 조회가 끝나기 전 정상으로 표시하지 않는다. 정상 연결 중에도 멤버십을 15초마다, focus/복귀/명령 거부 때 재확인한다.
- 실제 반례/검증: `tests/db-ui/recovery.spec.mjs`에서 별도 Owner/Member 로그인으로 A 전체 offline→B 저장→A 복귀의 GET 응답을 보류→B 추가 저장→dirty 후 최신 제목을 확인했다. A 초안은 그대로였고 직접 저장 전 생성 POST 0이었다. WS 프록시 단절 중 HTTP 저장과 임시 조회, WS 정상/HTTP 응답 유실 중 같은 requestId 재확인(activity/receipt 각 1), 실제 Owner 강등 후 RPC FORBIDDEN·읽기 전용 초안, 멤버십 제거 후 비공개 UI 제거를 확인했다.
- 수명/보안: 팀 전환·실제 unmount에서 구독/타이머/해당 캐시를 취소·제거하고 늦은 명령 응답의 캐시 재삽입을 막는다. 재마운트/전환 후 활성 구독 1개, 이전 팀으로 복귀할 때 새 GET 전 과거 카드 미표시, 이탈/로그아웃 후 각 16초간 이전 팀 조회 0을 검사했다. 로그인 만료는 실제 테스트 세션을 revoke한 뒤 브라우저 시계로 갱신 시점을 앞당겨 실제 Auth 거부와 로그인 안내를 확인했다. 가짜 Auth 성공/실패 응답은 만들지 않았다.
- 결과와 한계: 연결 복구는 누락된 이벤트 재생 대신 서버 재조회로 수렴한다. [전체 단절 복구](evidence/d8-offline-recovery.webm)와 [WS/HTTP 부분 장애](evidence/d8-partial-failures.webm)는 테스트 원본 녹화다. 권한은 DB가 즉시 강제하지만 UI 감지는 조회/heartbeat 주기에 영향을 받는다. 초안/미확정 요청은 현재 화면·팀·세션 메모리에만 남고 reload/이탈/로그아웃 후 복원하지 않는다. 운영 부하·전파 시간·완전한 오프라인 앱을 보장하지 않는다.
- 근거 문서(2026-09-22 확인): [Query network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), [Supabase subscribe](https://supabase.com/docs/reference/javascript/subscribe), [removeChannel](https://supabase.com/docs/reference/javascript/removechannel), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Playwright WebSocketRoute](https://playwright.dev/docs/api/class-websocketroute). 의존성 추가/버전 변경은 없다.
