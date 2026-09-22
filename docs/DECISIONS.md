# 기술 결정 기록

ADR 01은 D6 실제 구현을 반영한 초안이고 ADR 02는 D7 실제 두 사용자 협업 결과까지 반영했다. ADR 03의 최초 구독 기반은 D7에 있지만 전체 연결 복구는 설계 제안이다. 선택을 바꾸면 실제 이유와 영향을 기록한다. 중요한 세 가지를 자세히 남기고 사소한 라이브러리 설정은 늘어놓지 않는다.

## ADR 01 — 낙관적 이동을 서버 값과 분리

- 상태: D6 구현·로컬 검증을 반영한 초안. 독립 V06은 NOT_RUN. Realtime 결합은 D7에서 검증했다.
- 문제: 카드 A의 실패 때 보드 전체 이전 스냅샷을 복원하면 B 또는 다른 사용자의 성공 변경을 잃을 수 있다.
- 고려한 방법: 전체 snapshot rollback / 캐시의 이슈별 변경·복구 / 서버 캐시와 요청별 overlay 분리.
- 선택: Query의 서버 목록 + Zustand의 요청별 임시 overlay. 이슈 배열/본문은 복제하지 않고 requestId·expectedVersion·입력 payload·pending/uncertain만 보관한다. 드래그와 메뉴가 같은 명령 소유자를 사용하며 같은 이슈의 편집/이동을 동기적으로 하나만 예약한다.
- 장점: 실패한 요청의 임시 상태만 제거하고 최신 서버 값을 유지하기 쉽다.
- 비용: 명확한 거부와 응답 불명을 구별하고, 상세를 닫아도 미확정 요청을 보존해야 한다. 목록과 성공 응답 양쪽의 version 비교도 필요하다.
- 실제 구현 파일: `src/features/issues/command-store.ts`, `issue-commands.tsx`, `issue-cache.ts`, `issue-board.tsx`, `transition-menu.tsx`. DnD는 `@dnd-kit/core@6.3.1`의 PointerSensor/열 droppable만 쓰고 수동 정렬·sortable은 도입하지 않았다.
- 실제 반례/검증: `tests/db-ui/optimistic.spec.mjs`에서 A를 전송 전 보류→B 저장 성공→Member의 A 수정→A의 실제 CONFLICT를 재현했다. A만 Inbox로 돌아오며 B의 Ready와 Member의 최신 제목이 남았다. 실제 Verify→Done commit 뒤 응답만 끊은 요청은 같은 requestId 재전송 후 검증/activity/receipt 각 1건이었다. 10초 응답 타임아웃도 같은 요청으로 확인했다.
- 결과와 남은 한계: `acceptIssue`로 성공 값을 먼저 반영하고 해당 overlay만 제거한다. GET version N+2 이후 도착한 성공 N+1은 낮아지지 않았으며 순수 Query 테스트도 늦은 snapshot/receipt를 검사한다. 더 높은 서버 version을 읽으면 미확정 표시를 유지하되 그 서버 상태를 표시한다. 전체 스냅샷 롤백·자동 재시도/오프라인 큐는 없다. 요청은 현재 팀/로그인 수명의 메모리에만 남으며 이탈·로그아웃·새로고침 후 미확정 요청 복구와 실제 Realtime 순서는 D7에서 검증했고 전체 단절 복구는 D8 범위다.

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
- 결과와 남은 한계: DB의 이슈 단위 직렬화와 UI의 선택권을 함께 유지한다. 본문·검증·activity·receipt 원자성과 D6 응답 유실 재확인 회귀도 유지했다. 충돌이 드문 3~8명 팀 MVP를 위한 단순 정책이며 자동 필드 병합/CRDT는 없다. Realtime 전파 시간은 미측정이고 운영 규모 보장이 아니다. 상세 닫기/팀 이탈/로그아웃/reload 뒤 초안 복원, 전체 연결 복구는 미지원이다.

## ADR 03 — 변경 알림과 재조회로 복구

- 상태: 제안
- 문제: 연결이 끊겼다가 돌아오면 그동안의 변경 이벤트를 놓칠 수 있다.
- 고려한 방법: 이벤트만 직접 캐시에 적용 / 변경 알림→재조회 / 사용자 정의 재생 가능한 이벤트 로그.
- 계획된 선택: Postgres Changes를 재조회 신호로 사용, 재구독 후 최신 스냅샷 확인.
- 장점: 클라이언트의 복잡한 이벤트 재생 범위를 줄인다.
- 비용: 추가 조회가 발생하고 네트워크 복구 후 잠깐 동기화 대기가 필요하다.
- 실제 구현 파일:
- 실제 반례/검증: AC10~11.
- 결과와 남은 한계:
