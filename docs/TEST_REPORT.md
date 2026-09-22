# 테스트 실행 보고서

현재 상태: **D8 / P08 로컬 구현 검증 PASS.** 실제 GitHub OAuth·독립 V03~V08는 NOT_RUN이다. 기존 단계 기록은 아래에 보존했다. D1 이전 파일 보존 독립 증명은 여전히 NOT_RUN이다.

## D8 실제 결과 — 2026-09-22

Windows 25H2 / PowerShell 7.6.5 / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0 / Playwright 1.63.0 Chromium. 시작 커밋 `73b1c87`, working tree clean. 기존 문서/사용자 데이터 보존. schema/type/env/패키지/lockfile 변경·reset/seed·외부 공개 없음. 보호된 로컬 스택의 실제 합성 사용자 세션을 사용했다.

| 명령/검증 | 결과 | 실제 근거와 한계 |
|---|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | PASS | 최종 소스 lint 경고 0·타입·production build 성공. 시연 스크롤 조정 뒤 lint도 PASS. 개발 서버 `/board` HTTP 200 |
| `pnpm test`, `pnpm test:local-tools` | PASS 47/47, 2/2 | 기존 44건 유지 + WS 없는 polling/재구독 도중 trailing read 2건 + 실제 Query MutationCache가 offline에서도 pause하지 않고 전송 전 실패하며 online 복귀/명시적 resumePausedMutations에도 RPC를 재실행하지 않는 검사 1건. 이 단위 검사는 실제 DB 증거와 구분 |
| `pnpm test:db-ui` | PASS 25/25 | 기존 20건 유지 + `recovery.spec.mjs` 5건. 전체 회귀 3.1분 PASS. 영상 구도 조정 후 시연 2건, 최종 HTTP 복구 표시 보완 후 D8 5건도 재실행 PASS. 마지막은 `--output .local/d8-final-checks --reporter=list`로 전체 HTML 보고서 보존 |
| A 단절→B 변경→A 복귀 중 B 추가 변경 | PASS | 서로 다른 browser context의 Owner/Member가 실제 로그인. A `context.setOffline(true)` 동안 입력 편집 유지·저장 비활성·B 저장. 복귀 시 실제 GET 응답 보류→WS 연결됨/동기화 중 확인→B 추가 저장과 실제 이벤트→응답 해제 후 trailing GET. A의 최신 version 3·초안 보존·명시적 저장 전 create POST 0, 직접 저장 후 1 |
| WS만 실패 / HTTP만 실패 | PASS | 실제 WS 프록시를 close하고 재연결도 차단. HTTP 생성 성공, B 변경은 15초 임시 조회로 A에 반영, WS 복구 후 최신 조회 완료. 이어 실제 update commit 뒤 응답만 abort하고 GET도 실패시켜 `navigator.onLine=true`/WS connected/HTTP 실패를 함께 확인. 조회 복구만으로 재전송 안 함. 명시적 재확인 두 payload/requestId 동일·version +1·activity/receipt 각 1 |
| 권한 강등·멤버십 소실 | PASS | Member POST를 전송 전 보류→Owner UI에서 Viewer 강등→해제한 실제 RPC FORBIDDEN·version 불변. 재검사 후 저장/전환 비활성·초안 값/readonly 유지. 테스트 소유 팀의 membership만 SQL fixture로 제거→실제 RLS 재조회 후 상세/카드 제거. 멤버 제거 제품 기능을 구현한 것은 아님 |
| 구독·타이머·캐시 수명 | PASS | 실제 WS join/leave 프레임으로 반복 팀 전환 후 활성 topic 1. 이전 팀 조회가 16초간 0, 해당 팀 복귀의 새 GET을 보류하는 동안 과거 카드 0. 로그아웃 후 topic 0·이전 팀 조회 16초간 0·뒤로가기도 비공개 카드 미표시. 제한된 관찰이며 모든 브라우저 수명 조합의 증명은 아님 |
| 열려 있는 보드의 세션 만료 | PASS | 해당 테스트 브라우저의 실제 auth.sessions만 revoke. 브라우저 시계로 갱신 시점을 앞당기고 실제 Auth refresh 거부→`reason=session-expired` 안내·비공개 UI 제거. 가짜 Auth 응답/서비스 키로 로그인 사용자를 대신하지 않음. 실제 JWT를 서버에서 즉시 전역 무효화한 시험은 아님 |
| `pnpm test:db` | PASS 39/39 | 기존 직접 DML 거부·RLS·타팀/Viewer·역할 재검사·version 경합·멱등성·본문/검증/activity/receipt 원자성·실제 Realtime publication/RLS 회귀. 새 SQL은 없어 `db:migrate`/`db:types` 재실행은 NOT_RUN(불필요) |
| `pnpm test:e2e` | PASS 6/6 | 최종 production 3100 smoke 4.3초, 정상 자동 종료. 전체 고유 테스트 47+2+25+39+6 = **119건 PASS**. production OAuth/실제 사용자 DB 흐름은 이 smoke에 포함하지 않음 |
| 장애 영상 | PASS | [전체 단절](evidence/d8-offline-recovery.webm) 8.40초/915,073바이트, [WS/HTTP 부분 장애](evidence/d8-partial-failures.webm) 25.92초/2,425,732바이트, 각 1440×1100·무음 Playwright 원본. 별도 실제 B 세션의 조작은 테스트가 수행하고 영상은 A 화면을 기록. 읽기 쉬운 상태별 대기와 스크롤을 넣었고 속도 편집/가짜 UI 없음. ffprobe·추출 프레임 확인, 사용성/성능 측정 아님 |
| 비밀 값·데이터 | PASS | 실제 로컬 비밀번호/JWT/secret/service 값을 메모리에서만 소스 후보 120개·production 198개와 대조, 각각 일치 0. 기존 합성 사용자/프로필 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1, 테스트 오류 주입 함수 0. 일반 동작은 실제 세션, SQL은 테스트 fixture/정리/관찰에만 사용 |
| 후속/외부 | NOT_RUN | 독립 V03~V08, GitHub OAuth(provider=false), 원격 CI, 새 clone/reset 재현, 전체 AC 릴리스 판정, 100개 이슈/20회 전파 시간, 실제 OS IME/스크린리더/터치, 실제 사용자 피드백 |

중간 FAIL/환경 문제와 수정:

- 새 연결 안내 뒤 기존 DnD 테스트가 초기 조회/viewport 가장자리에서 좌표를 잡아 이동 폼을 열지 못했다. 구독/조회 완료와 중앙 스크롤 뒤 측정하도록 수정했다. 첫 조정 후에는 상세 닫기 직후 모달 종료 전에 다음 좌표 조작이 시작되는 경합이 나타났다. `dialog[open]` 제거와 스크롤 안정화를 확인한 뒤 조작해 D6 4건·전체 25건 PASS. 실패 영상의 추출 프레임도 확인했으며 assertion 삭제/skip/재시도로 숨기지 않았다.
- 첫 production smoke는 6개 assertion이 통과한 뒤 제한 실행 환경에서 서버 종료가 지연됐다. 해당 실행의 Next 3100 서버 PID/명령을 확인하고 종료해 runner를 마쳤다. 최종 실행은 서버 종료가 가능한 환경에서 build→smoke를 다시 수행해 6/6·종료 코드 0. DB UI와 smoke 출력 경로도 `test-results/db`/`test-results/smoke`로 분리해 보고서/녹화 충돌을 막았다.
- 첫 녹화는 연결 안내 아래 카드가 화면 밖에 있어 시연에서 상태 영역으로 스크롤하고 실제 복구 중 대기를 추가했다. 같은 장애 assertion을 유지한 최종 2건도 PASS. 역사 자료인 D4~D7 캡처/영상은 덮지 않았다.
- 최종 코드 검토에서 HTTP 조회 실패 후 다른 명령의 성공만으로 정상 안내를 복원하지 않도록 했다. 오류 시 동기화 상태도 무효화하고 성공 응답 후에는 복구 조회를 거친다. D8 5건·lint/typecheck/build·production smoke 재실행 PASS, 최종 영상도 이 실행에서 가져왔다.

AC10~11의 D8 지정 시나리오를 구현 검증했고, 관련 권한/충돌 회귀도 유지했다. 현재 발견된 D8 차단 결함은 없다. offline 중 같은 화면의 초안/미확정 요청은 유지하지만 reload·팀 이탈·로그아웃 후 복원하지 않는다. WS heartbeat/멤버십 주기 검사 전까지 UI 상태 감지 지연이 있을 수 있고 DB는 실제 명령마다 권한을 재검사한다. [ADR 03](DECISIONS.md)에 선택과 한계를 기록했다. 다음은 V08 독립 검증 후 P09다.

## D7 실제 결과 — 2026-09-21, 최종 점검 09-22

Windows 25H2 / PowerShell 7.6.5 / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0 / Playwright 1.63.0 Chromium. 시작 커밋 `d94bb30`, working tree clean. 기존 이슈 1개·activity 11·검증 1·receipt 15 등 작업 시작 시 실제 수를 기준으로 보존했다. 패키지·lockfile·env 변경, reset/seed, 외부 공개는 없다.

| 명령/검증 | 결과 | 실제 근거와 한계 |
|---|---|---|
| `pnpm db:migrate` → `pnpm db:types` | PASS | 보호된 loopback DB에 `20260921000100_d7_issue_realtime.sql` 적용. public.issues만 supabase_realtime에 등록, RLS 유지. 생성 타입은 기존과 동일. 기존 migration은 수정하지 않음 |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | PASS | 기존 pin 환경, lint 경고 0·타입·production build 성공. 마지막 테마 변수 정정 뒤 lint/build 재실행 PASS |
| `pnpm test` | PASS 44/44 | D6 39건 + coordinator 5건. 구독 전 이벤트/중복, 조회 중 trailing read, 오류 후 잘못된 정상 표시 차단, cleanup 후 timer/late callback 차단, read 오류의 무한 재시도 방지. 이 5건은 fake timer/adapter 검사이며 실제 backend 증거는 아래 |
| `pnpm test:db-ui` | PASS 20/20 | 기존 17건 모두 유지 + D7 3건. 서로 다른 browser context·각각 Owner/Member 실제 로그인. 전체 통과 뒤 상대 필드 보존 assertion을 포함한 D7 3건 재실행, 최종 녹화 1건도 PASS. HTML 보고서는 마지막 1건으로 갱신됨 |
| 동시 수정·복구 | PASS | 두 폼이 version N에서 제목/환경을 각각 수정. 실제 RPC 전송을 두 건 모두 모아 해제해 성공 1·CONFLICT 1, 최종 N+1, 두 requestId의 activity/receipt 합계 각각 1. 패자의 초안·clipboard 내용 유지. 비교/복사만으로 추가 POST 없음. 명시적 다시 편집 후 새 requestId·expectedVersion N+1로 저장, 상대가 수정한 필드 유지·N+2 |
| 첫 진입·중복 이벤트 | PASS | A의 실제 WS phx_join을 전송 전 보류, 초기 GET 뒤 B가 변경. 구독을 완료시킨 후 최신 GET을 실제 응답 생성 뒤 보류하고 B가 다시 변경. 실제 postgres_changes 프레임을 프록시에서 두 번 전달. trailing GET 후 최신 제목·카드 1개, B의 추가 생성도 A에 1개만 표시. 가짜 성공/가짜 DB 이벤트는 만들지 않음 |
| pending·늦은 응답 | PASS | A의 전환을 DB 전송 전 보류하는 동안 B 카드 이동 성공·Member의 A 수정이 실제 Realtime로 반영. A는 새 서버 상태를 표시하면서 저장 중/잠금 유지, 뒤늦은 CONFLICT는 B를 취소하지 않음. 후속 A 이동은 실제 commit 후 성공 응답만 보류→Member가 더 높은 version으로 이동→원격 최신 상태 반영→과거 성공 해제, 최신 상태 유지 |
| `pnpm test:db` | PASS 39/39 | 기존 권한·직접 DML 거부·version/멱등성·원자성 38건 + 실제 Realtime/RLS 1건. Viewer/타팀 사용자가 필터 없는 INSERT/UPDATE를 구독해도 각자 팀만 수신. 양쪽 허용 이벤트 도착 후 2초의 명시적 부재 관찰·타팀 REST 빈 결과. 이 한정된 관찰을 모든 네트워크/권한 철회 상황의 증명으로 확장하지 않음 |
| `pnpm test:e2e`, `pnpm test:local-tools` | PASS 6/6, 2/2 | production smoke와 로컬 대상 보호. 전체 고유 테스트 44+39+20+6+2 = 111건. DB/사용자 UI는 개발 서버, 일반 production smoke는 3100 포트의 빌드 서버 |
| 영상 | PASS | 같은 실제 두 사용자 실행의 `d7-owner.webm`(9.20초/922,215바이트)·`d7-member.webm`(9.16초/901,891바이트), 1440×1050. 검증 조건을 통과한 뒤 총 6.2초의 녹화 가독성 대기를 넣었으며 성공 판정은 DOM/RPC/SQL 조건 기반. 무음 원본, 속도 편집·가짜 UI 없음. ffprobe와 추출 프레임 확인; 사용자 관찰/성능 측정 아님 |
| 비밀 값·데이터 | PASS | 09-22 실제 로컬 비밀번호/JWT/secret/service 값을 소스 후보 115개·production server/static 198개에서 비교해 각각 일치 0, 값 미출력. 기존 합성 사용자/프로필 각 4·팀 3·이슈 1·activity 11·검증 1·receipt 15·초대 1 유지. 테스트 소유 UUID만 정리 |
| 후속/외부 | NOT_RUN | 독립 V03~V07, GitHub OAuth(provider=false), 원격 CI, 새 clone/reset 재현, HTTP/WS 분리·오프라인/재연결·권한 철회 전체 행렬, 100개 이슈/20회 전파 시간, 실제 OS IME/스크린리더/터치, 사용자 피드백 |

중간 FAIL과 수정:

- 09-21 최종 점검 명령은 자동 승인 검토의 사용량 한도로 실행되지 못했다. 09-22 재개 후 점검은 실행돼 비밀 값/기존 데이터 확인 PASS. 안전성 거부나 DB 초기화는 없었다. 재개 시 개발 서버의 3000 포트는 연결 거부였으며 `pnpm dev` 재기동 후 보드 HTTP 200을 확인했다.
- 새 테스트의 browser `navigator` 전역 선언 누락과 finally 내부 throw lint를 정정했다. production 규칙을 끄지 않았다.
- 새 테스트가 존재하지 않는 “상태 이동 메뉴/이동 저장” 버튼을 선택했다. 실제 “In Progress로 이동/이동 확인” 버튼으로 수정했다. 무한 gate 대기도 조건 기반 timeout으로 바꿔 실패 위치를 드러냈다.
- 상세 닫기 클릭 직후 완료를 기다리지 않고 생성 폼에 입력해 빈 제목이 제출되는 자동 조작 경합이 있었다. dialog가 실제로 사라졌음을 확인한 뒤 입력하도록 수정했고 구독/중복 검증이 통과했다.
- 기존 충돌 테스트 2건은 Realtime 도착 후 알려진 stale 폼이 잠길 수 있다. 명령을 먼저 제출·전송 보류한 뒤 상대 저장→보류 해제 순서로 기존 DB CONFLICT/초안/검증 assertion을 유지했다. 테스트 삭제/skip은 없다.
- 화면 대조에서 비교 표의 테마 변수 이름을 기존 `--line`으로 맞췄다. 최종 build와 녹화를 다시 실행했다.

AC08의 현재 이슈 단위 충돌 흐름과 AC06/09의 이슈 Realtime 부분을 확인했다. 댓글/알림은 아직 없고 전체 AC01~16 릴리스 판정은 NOT_RUN이다. 현재 D7 범위의 알려진 차단 결함은 없으며, 상세 닫기·팀 이탈·로그아웃·reload 후 초안/미확정 요청 복원은 미지원이다. `IssueRealtime`은 연결/조회 오류를 한 안내로 표시하고 수동 최신 조회를 제공한다. HTTP/WS 구분과 전체 복구는 D8에서 구현·검증한다.

## D6 실제 결과 — 2026-09-21

Windows / PowerShell / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0 / Playwright 1.63.0 Chromium. 시작 커밋 `05164e5`, working tree clean. DnD core 6.3.1·Zustand 5.0.15를 정확히 추가했고 SQL·생성 타입·env·기본 합성 계정은 유지했다. 외부 계정·공개·reset/seed 작업은 없다.

| 명령/검증 | 결과 | 실제 근거와 한계 |
|---|---|---|
| 공식 문서·버전·설치 | PASS | dnd-kit core/PointerSensor, Query 낙관적 UI/structuralSharing, Zustand store/Next 경계 확인. npm registry의 core 6.3.1 React peer ≥16.8, Zustand 5.0.15 React ≥18·Node ≥12.20을 현재 버전과 대조. `pnpm add --save-exact` 및 `pnpm install --frozen-lockfile` exit 0. 공식 legacy core API만 사용 |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | PASS / 39/39 | 기존 단위 32건 + D6 7건. 같은 이슈의 동기 예약·다른 이슈 독립·미확정 payload 고정·A만 제거·더 최신 서버 값 우선·실제 QueryClient의 늦은 snapshot/receipt 병합·정렬/빈 권한 snapshot·이전 요청 완료의 후속 잠금 제거 방지 |
| `pnpm test:db-ui` | PASS 17/17 | 기존 D2~D5 13건 유지 + D6 실제 세션 4건. 최종 전체 실행 17/17. 영상 보고서 첨부·최소 1초 지연 조건을 확정한 뒤 시연 2건을 별도로 재실행. 보고서는 마지막 실행 범위로 갱신됨 |
| 지연·카드별 실패 | PASS | A 전환 요청을 실제 서버 전송 전 gate로 최소 1초 보류. 응답 전 Ready/저장 중·DB Inbox·상세 Ready 표시와 편집 잠금 확인. B의 실제 Ready 저장 완료 후 Member가 A 제목 변경 → A RPC CONFLICT. A만 Inbox로 돌아가고 B·Member의 최신 제목 보존, A 거부 receipt 0 |
| commit 후 응답 유실 | PASS | Verify→Done 입력을 제출한 뒤 `route.fetch()`로 실제 DB 명령을 끝내고 SQL Done 확인 후 브라우저 응답만 connectionreset. 입력·결과 확인 중·카드 잠금 유지. 창을 닫고 카드에서 재확인한 두 payload/requestId는 동일. version +1·verification/activity/receipt 각각 1건 |
| 타임아웃 | PASS | 실제 RPC commit 후 응답을 보류해 앱의 10초 AbortSignal 만료 유도. DB Ready지만 UI는 결과 확인 중. 같은 요청으로 재확인 후 추가 version/activity/receipt 없음. 타임아웃을 확정 거부로 표시하지 않음 |
| 응답 순서·권한·메뉴 | PASS | 성공 N+1 응답을 보류하고 Member가 N+2로 이동 → GET N+2 반영 후 N+1 성공 응답 해제. 보드/상세 N+2 상태 유지. 같은 열·금지 전환 요청 0, 필수 입력 취소 DB 불변, 키보드 Enter로 상세/메뉴/확정, Viewer 드래그 손잡이 없음 |
| `pnpm test:db` | PASS 38/38 | 기존 D2~D5의 일반 사용자 RLS/RPC·version·중복·전환·검증·rollback 회귀. D6는 DB 규칙을 우회하는 쓰기 경로를 추가하지 않음 |
| production·보호 | PASS | `pnpm build` exit 0, `pnpm test:e2e` 6/6, `pnpm test:local-tools` 2/2. production에 개발 인증·테스트 지연/응답 조작 기능 없음. 전체 실행 테스트 39 + 38 + 17 + 6 + 2 = 102건 |
| 영상·기동 | PASS | `docs/evidence/d6-request-isolation.webm`, `d6-receipt-recovery.webm`은 실제 합성 DB 시나리오 녹화. ffprobe로 컨테이너 확인·추출 프레임으로 UI 확인. 1440×1050의 짧은 무음 원본, 속도 편집/사용자 피드백/성능 수치 없음. dev 보드 HTTP 200 |
| 비밀 값·정리 | PASS | 소스 후보 106·production server/static 198개에서 실제 로컬 비밀번호/JWT/secret/service 값 일치 0, 값 미출력. 합성 사용자/프로필 각 4·팀 3·이슈 1·activity 3·receipt 7·초대 1 유지, 검증 0·오류 주입 함수 0. 테스트 소유 UUID만 정리 |
| 후속·외부 | NOT_RUN | 독립 V03~V06·실제 GitHub OAuth(provider=false)·원격 CI·새 clone·전체 AC01~16·실제 터치 DnD·OS IME·스크린리더·Realtime·새로고침 후 미확정 명령 복원·전체 오프라인 복구·사용자 피드백 |

중간 FAIL과 수정:

- `useDraggable` 반환 객체를 통째로 접근하면 React Hooks refs 규칙이 ref가 아닌 표시 값까지 ref로 추론했다. 사용하는 callback ref/표시 값만 구조 분해해 해결했고 규칙 비활성화 없이 lint/typecheck/build를 통과했다.
- core 6.3.1은 드롭 뒤 document click/selection 억제 listener를 50ms 유지한다. 즉시 시작한 자동 입력/키보드 클릭 두 건이 영향을 받았다. 설치 코드의 detach를 확인하고 테스트의 포인터 수명 정리만 60ms 대기한다. DB 완료는 sleep으로 추정하지 않고 DOM/실제 SQL/네트워크 gate로 검증한다.
- 기존 카드 테스트 5건은 버튼이 하나라고 가정해 드래그 손잡이와 상세 버튼을 동시에 찾았다. 상세 열기 이름으로 선택자를 명시한 뒤 전체 17건 PASS. 기존 assertion·권한/충돌/재조회/모바일 검증을 제거하거나 skip하지 않았다.

낙관적 표시 자체는 저장 성공의 증거가 아니다. 확정 거부는 해당 overlay만 지우며 응답 불명은 현재 팀의 요청 소유자에 보존한다. 같은 이슈는 결과 확인 전 잠기고 다른 이슈는 작업 가능하다. 이탈/로그아웃/새로고침은 메모리의 요청을 폐기하므로 이후 서버를 다시 읽어야 한다. 영속적인 미확정 요청 복구·실시간 순서·전체 접근성은 후속 단계이며 현재 범위의 알려진 차단 결함은 없다. AC05~07의 D6 부분을 검증했으며 댓글/알림 중복 등 전체 기준까지 PASS로 올리지 않았다.

## D5 실제 결과 — 2026-09-20, 재개·최종 확인 09-21

Windows / PowerShell / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0 / Playwright 1.63.0 Chromium 환경. D4 커밋 `e228a95`의 clean working tree에서 시작했다. 기존 버전·lockfile·D2~D4 migration을 유지하고 데이터 보존형 migration만 추가했다. 일반 터미널의 다른 Node와 섞이지 않도록 검증 프로세스 PATH를 고정했다.

| 명령/검증 | 결과 | 실제 근거와 한계 |
|---|---|---|
| `pnpm db:migrate` → `pnpm db:types` | PASS | 09-20 `20260920000100_d5_issue_transitions.sql` 적용과 public 타입 재생성. verification_runs·RLS/SELECT·전환 EXECUTE·상태 CHECK·필드 편집 명령 확장. reset/seed 재실행 없음 |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | PASS / 32/32 | 09-20 정적 검사와 Vitest. 기존 3건 + 순수 상태 규칙 29건: 25개 상태쌍·필수 필드·담당자·사유/검증 입력·공백/길이 경계 |
| `pnpm test:db` | PASS 38/38 | 09-20 기존 D2~D4 29건 + D5 9건. Owner/Member/Viewer/타팀 실제 password 세션의 RPC와 PostgreSQL 사후 조회. test fixture·오류 주입·정리만 postgres 사용 |
| 전환·편집 우회 | PASS | 실제 DB 25개 상태쌍 중 8개 허용/17개 거부. Ready 재현/분류, In Progress 현재 Owner/Member 담당자, Verify 수정 메모/빌드 조건 검사. 각 상태의 필수 필드 삭제·Done 전체 편집 가능 필드·직접 issues 쓰기 거부. 담당자 강등 후 진행/편집 거부, Ready 복귀·재지정 가능 |
| 검증 version·입력 | PASS | 버전/환경 필수·실패 이유 필수·최대 길이/공백·null/임의 metadata 주입 거부. 검증 창을 연 뒤 실제 Member가 수정하면 오래된 통과 요청 CONFLICT, 검증/activity/receipt 추가 0 |
| 동시성·멱등성·원자성 | PASS | 같은 version 통과/실패 경합 성공 1·CONFLICT 1. 같은 requestId 동시 재전송 효과 1회, 다른 payload 재사용 거부, 재오픈 후 과거 receipt 재전송도 추가 효과 없음. request 전용 verification insert 실패와 activity insert 실패를 각각 주입해 이슈/version·검증·activity·receipt 전체 롤백 확인 |
| 검증 기록·권한 | PASS | 실패→수정→통과→재오픈 후 두 기록과 version_before·행위자·사유 보존. Viewer 읽기 허용/쓰기 거부, 타팀 읽기 0·명령 거부, anon/auth.uid 없는 호출·private helper·직접 verification DML 차단 |
| `pnpm test:db-ui` | PASS 13/13 | 09-20 기존 10건 + D5 3건. 실제 화면의 제목만 생성→누락 안내/취소→Ready→담당자→In Progress→수정 정보→Verify→실패→수정→통과→Done→재오픈과 DB 확인. 오류 첫 필드 포커스·Escape로 내부 다이얼로그만 닫기·Viewer 기록 읽기·Done 본문 잠금·390px 수평 overflow 없음 |
| 충돌·전송 장애 UI | PASS / 일부 NOT_RUN | 실제 원격 수정 후 오래된 검증 거부·입력 보존·최신 내용 펼치기·명시적 재검증 성공. 전송 전 route.abort는 DB/상태 불변, 같은 requestId 재확인으로 검증 1회. **DB commit 후 응답 유실은 NOT_RUN**이며 D6에서 별도로 검증한다 |
| `pnpm build`, `pnpm test:e2e` | PASS / 6/6 | 09-20 production build exit 0. 중단된 실행 세션의 완료 출력은 복구되지 않아 09-21 smoke를 다시 실행해 6/6 확인. 익명 보드/로그인·404·키보드·390px·개발 자격 미노출·응답 캐시 경계 |
| `pnpm test:local-tools` | PASS 2/2 | 09-21 원격/잘못된 DB 대상 및 확인 없는 reset 거부. 전체 실행 테스트는 Vitest 32 + DB 38 + DB UI 13 + smoke 6 + 보호 2 = 91건 |
| 캡처 | PASS | `docs/evidence/d5-verification-dialog.png`, `d5-done-history.png`, 각각 1440×1050. 실제 별도 합성 팀의 UI/DB 흐름에서 생성 후 이미지 직접 확인. D4의 기존 PNG는 보존하며 회귀 캡처를 실행 보고서 첨부로 전환. 실제 사용자 피드백·영상은 없음 |
| 환경 재개·비밀 값·정리 | PASS / 초기 환경 FAIL 복구 | 09-21 초기 Docker 엔진 파이프 부재로 localStack 조회 실패. `docker desktop start --timeout 45` → `pnpm db:start` exit 0, 엔진 29.7.2·dev Ready 복구. 소스 후보 99·production 198개에서 실제 합성 비밀번호/JWT/secret/service 값 일치 0. 원문 미출력 |
| 후속·외부 검증 | NOT_RUN | 독립 V03/V04/V05·실제 GitHub OAuth(provider=false)·원격 CI·새 clone·전체 AC01~16·OS 한글 IME 후보창·스크린리더·DnD·Realtime·전체 오프라인 복구·실제 사용자 피드백 |

재개 후 SQL 조회는 합성 사용자/프로필 각 4·팀 3·이슈 1·activity 3·receipt 7·초대 1·검증 0, D2~D5 오류 주입 함수 0이었다. 기존 팀의 이슈와 기록은 그대로 보존했다. DB/UI 테스트는 자신이 만든 팀 UUID와 관련 행만 finally에서 정리하며 원래 데이터를 삭제하지 않는다. 생성된 브라우저 인증 정보·trace·storageState는 커밋하지 않는다.

알려진 D5 차단 결함은 발견하지 못했다. 일반 거부와 다이얼로그 취소는 상태를 바꾸지 않는다. 상태 변경은 서버 성공 후 조회로 반영하며 낙관적 이동은 아직 없다. 검증 기록은 특정 이슈 version에 연결되며 새 수정 내용을 과거 통과 기록으로 완료 처리할 수 없다. 상세 닫기/페이지 이탈의 미저장 초안 복구와 전체 네트워크 장애 복구는 제공하지 않는다. D5 관련 검증 통과를 독립 V05 또는 전체 수용 기준 통과로 올리지 않았다.

## D4 실제 결과 — 2026-09-16, 재개·최종 검증 09-20

Windows / PowerShell / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0 / 고정 Playwright 1.63.0 Chromium 환경. D4 시작 커밋 `7503d03`, 당시 working tree clean. D4 중단 작업을 그대로 이어 진행했으며 패키지 버전/lockfile 변경·외부 계정 설정·공개 작업은 없다.

| 검증 | 결과 | 실제 근거와 한계 |
|---|---|---|
| migration·타입 | PASS | 09-16 `pnpm db:migrate` → `pnpm db:types`. `20260916000100_d4_issue_fields.sql` 적용, public 타입 재생성. reset 없이 기존 행/계정/환경 보존. 09-20 Docker Desktop 기동 대기 후 엔진 29.7.2, `pnpm db:start` exit 0, dev ready |
| 실제 DB | PASS 29/29 | `pnpm test:db` 09-20. D2/D3 25건 회귀 + D4 4건: 기본값·각 필드 최대/초과·Unicode/공백·enum/null/허용 필드·간헐 조건·잘못된 담당자, 부분 필드 version 경합, activity 실패 rollback, 강등 담당자 보존/해제/새 지정 거부 |
| 실제 DB UI | PASS 10/10 | `pnpm test:db-ui` 09-20. 기존 D2 3건을 카드→상세 편집으로 변경하고 D3 4건 유지. 별도 합성 팀에서 구조화 생성/편집/DB 사후 조회/reload/재진입, 입력 오류·IME 이벤트, 로딩/0건/조회 실패/재시도/없는 상세/초안 보존 3건 추가 |
| 서버 데이터·초안 | PASS | 카드·상세는 동일 `["issues", workspaceId]` Query. UI 저장 후 version 2와 본문/빌드 trim 확인. 별도 실제 RPC 수정→최신 상세 조회 성공 및 네트워크 abort 실패 모두 로컬 입력 유지, 명시적 최신 값 선택만 폼 교체. 두 사용자 충돌·재제출로 version 3 확인 |
| 입력·접근성 | PASS / 부분 NOT_RUN | 공백 제목·121 이모지·4,001자 본문·간헐 메모 누락·DOM 주입 담당자의 제출 거부, 첫 오류 포커스/aria-invalid/설명 연결. 120 이모지 제목/4,000 이모지 본문은 실제 DB 저장. Chromium compositionstart/Enter(isComposing·229)/compositionend로 중간 제출 0 확인. 실제 Windows 한글 IME 후보창 조작과 스크린리더는 NOT_RUN |
| URL·모바일·증거 | PASS | 상세 URL 새로고침/재진입/뒤로가기, 닫기 초기 포커스·Escape 후 카드 포커스 복원. 390px 문서/상세 수평 overflow 없음. `docs/evidence/d4-board.png`(1440×1618), `d4-mobile-detail.png`(390×844)를 실제 DB 흐름으로 생성하고 두 이미지를 직접 확인. D4 구조화 흐름 및 기존 생성 흐름 pageerror 0 |
| 정적·단위·보호 | PASS | `pnpm lint`, `pnpm typecheck`, `pnpm test` 3/3, `pnpm test:local-tools` 2/2. 테스트 삭제/skip 없음. `git diff --check` 통과 |
| production | PASS | 최종 `pnpm build` exit 0, `pnpm test:e2e` 6/6. 익명 미리보기/로그인·404·키보드·390px·개발 계정 미노출·응답 캐시 경계 회귀 |
| 비밀 값·정리 | PASS | 소스 후보 90·production server/static 198개를 실제 로컬 합성 비밀번호/JWT/secret/service 값과 메모리에서 대조하여 일치 0. 값은 미출력. 최종 합성 계정/프로필 각 4, 전체 팀 3·이슈/activity 0·receipt 4·초대 1, D2/3/4 오류 주입 함수 0. 테스트 소유 UUID만 정리했으며 다른 로컬 팀·기록을 삭제하지 않음 |
| 외부·후속 범위 | NOT_RUN | 독립 V03/V04·실제 GitHub OAuth(provider=false)·원격 CI·새 clone·전체 AC01~16·상태 전환·DnD·Realtime·전체 오프라인 복구·실제 사용자 피드백. 정상 5열 렌더링은 상태 이동 완료를 뜻하지 않음 |

수정한 중간 FAIL과 재현 근거:

- SQL `elsif`의 CASE 표현식 괄호 누락으로 첫 migration이 거부됐다. 괄호를 추가해 데이터 보존형 재적용·타입 생성과 29건 DB 회귀를 통과했다.
- 제목 label 안에 추가한 “필수” 표시로 기존 정확한 라벨 선택이 실패했다. 필수 여부를 입력 설명으로 옮기고 라벨 연결·오류 포커스·10건 UI 회귀를 확인했다.
- 보드와 상세에 같은 제목이 있어 과거 페이지 전체 heading 선택자가 중복됐다. 테스트가 실제 편집 중인 dialog를 지정하도록 수정했다. assertion 삭제/skip 없이 저장/reload/DB 확인을 유지했다.
- 기존 DB 테스트의 “모든 사용자는 한 팀만 볼 수 있다” 가정이 사용자가 생성한 다른 팀에서 실패했다. 실제 membership 목록에 포함된 팀만 허용되는지와 기본 팀 접근·타팀 거부를 함께 검증하도록 바꿨다.
- URL 선택이 인증 effect 의존성이 되어 구독을 다시 만들고 초기 auth 이벤트에서 캐시를 비울 수 있었다. 복귀 URL ref와 구독 수명을 분리했다. 상세 탐색·새로고침·D3 로그인/갱신/로그아웃 회귀 PASS.
- 네트워크 abort는 설치된 PostgREST SDK의 GET 재시도(1/2/4초)와 Query 재시도 이후 오류가 확정된다. 처음 5초 assertion은 아직 조회 중이어서 실패했다. 실행 코드를 확인하고 오류 DOM을 최대 20초 조건 대기하도록 고쳤다. 성공 응답을 가짜로 대체하지 않고 두 실제 조회 장애/복구와 초안 보존을 확인했다.

알려진 D4 차단 결함은 없다. 상세 닫기/페이지 이탈은 미저장 초안을 폐기하며 디스크 초안 복구를 제공하지 않는다. 현재 상태는 DB에서 Inbox만 허용하므로 D5가 상태 CHECK와 필수 조건/재검증을 함께 확장해야 한다. D4의 3개 새 UI 테스트는 실제 OS IME·전체 접근성 인증을 대체하지 않는다.

## D3 실제 결과 — 2026-09-15~16

Windows 25H2 / PowerShell 7.6.5 / Node 24.19.0 / pnpm 11.19.0 / Docker 29.7.2 / PostgreSQL 17.6 / Supabase CLI 2.117.0. 기존 Next 16.3.5·SDK 2.116.0에 SSR 0.12.7을 정확히 추가했다. 시작 시 사용자 변경은 PROGRESS/TEST_REPORT의 V02 기록 2개였고 사본을 보존했다. 합성 Owner/Member/Viewer/별도 팀 Owner를 실제 password 세션으로 사용했다.

| 명령/검증 | 결과 | 실제 확인·한계 |
|---|---|---|
| 공식 문서·버전 | PASS | Supabase Next SSR·GitHub/PKCE·CLI env·Next dynamic 캐시 문서 확인. npm 공식 SSR latest metadata 0.12.7, SDK peer ^2.114.0과 현재 2.116.0 호환. Node/pnpm 기존 pin 유지 |
| `pnpm db:migrate`, `pnpm db:types` | PASS | D3 migration 데이터 보존형 적용, public 타입 생성. 최종 타입 재생성 전후 SHA-256 동일. 기존 기본 계정의 profiles backfill, reset/seed 재실행 없음 |
| `pnpm db:stop` → `pnpm db:start` | PASS | 설정 반영용 보존 재기동 exit 0. 실행 중 Auth allowlist에 정확한 3000 `/auth/callback` 존재, GitHub provider=false. 키가 포함될 수 있는 원문 출력 없음 |
| `pnpm test:db` | PASS 25/25 | D2 14건 유지 + D3 11건. 실제 사용자 API와 사후 SQL 조회. 테스트 데이터 준비/정리·롤백 주입만 postgres 사용 |
| 팀 생성·역할 주입 | PASS | Viewer도 새 팀의 생성자는 Owner. 동일 요청 동시 생성은 팀/멤버/receipt 1회. owner_id/role payload 주입·기존 타팀 id 거부. 직접 profiles/workspaces/members insert/update/delete 42501 |
| 프로필·권한표 | PASS | 같은 팀 표시 이름/user id/역할만 조회, 타팀 rows 0, anon 거부, 정책 재귀 없음. 새 auth.users insert trigger는 80자 이름만 저장하고 role/workspace 메타데이터는 멤버십에 영향 없음. read/write/verify/comment/invite/manage_members 표 일치; 검증·댓글은 capability만 확인 |
| 초대 생성·수락 | PASS | Owner만 생성, DB/receipt 원문 없음·SHA-256 대조·24시간·Member 고정. 동시 생성 replay 효과 1회. 서로 다른 사용자 동시 수락 성공 1/거부 1, 가입/소비/receipt 각각 한 번. 동일 성공 요청 replay도 추가 효과 없음 |
| 만료·재사용·이미 가입 | PASS | 만료/없는/사용된 초대 거부·실패 receipt 0. 이미 가입한 Owner·Viewer는 링크를 소비하지 않고 승격하지 않음. 역할/다른 payload 주입 거부 |
| 역할 변경·원자성 | PASS | Member/Viewer/타팀 변경 거부, Owner 자가 강등·이전·비회원 대상 차단. 같은 기준 역할의 동시 변경 성공 1/CONFLICT 1. 같은 JWT에서도 Viewer 전환 후 이슈 쓰기 거부, Member 복귀 후 성공. 멤버 insert 예외 시 팀 생성·초대 소비·receipt 전부 rollback |
| 내부 경계 | PASS | private 초대/공통 명령 직접 접근 42501. auth.uid 없는 authenticated SQL bootstrap 거부. receipt 재전송은 현재 권한 확인 |
| `pnpm test:db-ui` | PASS 7/7 | 기존 제목 저장/reload·Viewer/타팀·두 사용자 초안 보존 3건 유지. 새 팀 UI→fragment 초대→로그인 복귀→수락→Member/Viewer 변경, 만료 안내·타팀 이름 미노출, SSR/로그아웃, 콜백 오류 4건 추가 |
| SSR 갱신·종료 | PASS | 실제 세션 쿠키의 과거 expiry로 서버 갱신 유도, Set-Cookie와 새 만료 시각 확인. 해당 테스트 브라우저의 Auth 세션만 폐기 후 갱신 거부→재로그인 안내. 로그아웃 후 쿠키 0·미리보기. 실제 1시간 경과를 기다린 검증이나 GitHub 로그인 검증은 아님 |
| OAuth 오류·복귀 | PASS / 실제 OAuth NOT_RUN | 실제 route에서 취소 query·없는/잘못된 code를 안전한 안내로 처리. 오류 원문 미반영, 외부 next 거부, `/invite` 복귀와 no-store 확인. 브라우저 초대 원문이 HTTP 요청 URL에 없는 것도 확인. 외부 GitHub 승인 왕복을 mock 성공으로 대체하지 않음 |
| 설치·정적·단위 | PASS | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` 3/3, `pnpm test:local-tools` 2/2. 마지막 보호 검사는 09-15, 나머지 최종 회귀 09-16. 테스트 삭제/skip 없음 |
| 빌드·production | PASS | `pnpm build` exit 0. `/auth/callback`, `/board`, `/invite`, `/login` dynamic 및 Proxy 출력. `pnpm test:e2e` 6/6: 기존 smoke와 개발 자격 미노출 유지, 3개 인증 관련 페이지 private/no-store/no-referrer 확인 |
| 비밀 값·정리 | PASS | 소스 후보 82·production server/static 198개를 실제 합성 비밀번호·로컬 JWT/secret/service 키와 메모리에서 대조: 일치 0. 값 미출력. 최종 합성 사용자 4·프로필 4·팀 2, 이슈/activity/receipt/invite·오류 주입 함수 각각 0 |
| 별도 V03·외부 기능 | NOT_RUN | 실제 GitHub 승인/취소: root .env의 Client ID/secret 미설정 및 provider=false. README에 등록/콜백/변수/재기동 순서 기록. V03·원격 CI·hosted·새 clone·전체 AC01~16·검증/댓글·Realtime·응답 유실 주입·실제 사용자 피드백 미실행 |

- 중간 FAIL 후 수정: effect 안의 동기 setState 대신 초대 저장소 외부 상태 구독, JS 테스트의 Node URL import. 세션 fixture의 `expires_at=0`은 SDK에서 만료로 보지 않아 실제 과거 시각으로 수정하고 브라우저 자동 갱신과 서버 검증을 분리했다. 정상 갱신/거부 모두 최종 PASS.
- 캐시 검증: Next dev의 페이지 헤더는 `no-cache, must-revalidate`여서 production 기준의 no-store assertion이 처음 실패했다. 보드를 명시적 dynamic으로 두고 dev/production을 별도 검증했다. 최종 production 3개 페이지는 private/no-store였다.
- 로그 한계: 폐기한 테스트 세션의 `refresh_token_not_found`는 의도한 실패이며 값은 출력되지 않았다. 개발 탐색 중 `The destination stream closed early` 서버 로그가 1회 있었고 해당 흐름 및 전체 7건은 PASS였다. 이 로그의 원인은 미확정이다. production smoke에서는 같은 로그가 관찰되지 않았다. 모든 서버/브라우저 로그가 0이라고 주장하지 않는다.
- 실제 캡처: `playwright-db-report/index.html`의 `d3-team-roles`(390px), `d2-saved-inbox`, `d2-stale-title` 3장을 직접 열어 확인했다. 새 팀 흐름 390px overflow 0, 기본 제목/팀 관리 흐름의 pageerror 0. 초대 원문이 사라진 후 캡처하며 DB UI trace/storageState는 저장하지 않는다.
- 변경 후 권한은 DB에서 매번 검사하고 UI는 명시적 재조회/포커스/거부 응답으로 갱신한다. 실시간 역할 전파·즉시 전역 JWT 무효화는 이번 범위가 아니다. 새 댓글/검증 명령은 D5/D9에서 같은 DB 권한표를 적용하고 실제 동작을 검증해야 한다.

## V02 독립 검증 — 2026-09-15

Windows 25H2 / Node 24.19.0 / pnpm 11.19.0 / PostgreSQL 17.6. 검수 시작 커밋은 `367fff2`, working tree는 clean이었다. 아래 DB 결과는 Supabase 로컬 API와 실제 PostgreSQL 사후 조회를 함께 사용했으며 UI mock 결과가 아니다.

| 검증 항목 | 결과 | 실제 확인·증거 |
|---|---|---|
| 로컬 대상 보호 | PASS | `pnpm test:local-tools` 2/2. 실제 reset 전 wrapper가 API `127.0.0.1:54321`, DB `127.0.0.1:54322/postgres`, 실행 중인 `supabase_db_reproboard`, 프로젝트/작업 경로를 확인했다. 원격 URL·다른 포트/DB/컨테이너·확인 없는 reset은 거부된다. |
| 초기화·migration 재적용 | PASS | 초기화 전 합성 사용자 4·팀 2·이슈 1·activity 4·receipt 4를 확인했다. 고정 Node 24.19.0으로 `db:reset --confirm-local-reproboard` exit 0. 직후 migration `20260914000100_d2_issue_commands`, 공개 테이블 4개의 RLS, authenticated SELECT/RPC 허용과 직접 INSERT/UPDATE·anon RPC 거부, 전체 데이터 0을 SQL로 확인했다. seed/env/types 재실행도 PASS. |
| 공개 키·일반 사용자 세션 | PASS | `.env.local`의 브라우저 키는 실행 중인 publishable/anon key와 같고 secret/service key와 달랐다. 브라우저에는 `src/lib/supabase/browser.ts`의 공개 키 client만 생성된다. 실제 Owner password 세션의 UI 저장 행은 `created_by`/`updated_by`가 해당 합성 Owner였고, admin key는 `scripts/seed-local.mjs`의 로컬 Auth seed에만 사용된다. 검증·정리 SQL의 postgres 연결은 사용자 동작으로 계산하지 않았다. |
| UI 생성·수정·reload | PASS | 실제 브라우저에서 Owner 로그인→`V02 수동 저장 2026-09-15` 생성→DB version 1/activity 1/receipt 1→reload 유지→제목 수정→DB version 2/activity 2/receipt 2→reload 유지. console warn/error 0, 종료 시 로그아웃. `pnpm test:db-ui`도 실제 로컬 DB/별도 context로 3/3 PASS. |
| 직접 `issues` 쓰기 | PASS | 별도 Owner 사용자 세션에서 `.from('issues').insert`와 `.update`를 직접 시도해 둘 다 PostgreSQL `42501`. 우회 행 0, 기존 제목/version 불변. `pnpm test:db`는 Owner/Member/Viewer/outsider의 직접 insert/update/delete도 확인했다. |
| 동일 version 경합 | PASS | 독립 Owner/Member 세션이 version 1을 동시에 수정해 성공 1·`CONFLICT` 1, transport error 0, 최종 version 2. 승자 activity 1·receipt 1, 패자 성공 기록 0. DB 테스트의 같은 시나리오도 PASS. |
| 동일 requestId 재전송 | PASS | 같은 Owner 세션의 동일 update를 동시에 2회 보내 두 호출은 같은 성공 결과를 받았고 최종 version 2, activity 1, receipt 1이었다. 이후 replay·동시 create·다른 payload/operation 거부를 포함한 DB 테스트도 PASS. |
| 권한 거부 원자성 | PASS | Viewer의 update RPC는 transport 성공/도메인 `FORBIDDEN`; 이슈·version 불변, 해당 requestId의 activity 0·receipt 0. 타팀·없는 팀·익명·권한 회수 후 replay와 activity insert 강제 실패의 전체 rollback도 `pnpm test:db`에서 PASS. |
| 재현 스크립트·회귀 | PASS | `tests/db/commands.test.mjs` 14/14, `tests/db-ui/board.spec.mjs` 3/3, `tests/local-tools/guard.test.mjs` 2/2. `pnpm lint`, `pnpm typecheck`, `pnpm test` 1/1 PASS. 생성 DB 타입은 커밋과 동일하고 skip/삭제 없음. |
| 보안 검토 | PASS / LOW 관찰 | 요청한 D2 경로에서 critical/high/medium 취약점은 발견하지 못했다. 개발 모드 `/login`은 합성 비밀번호를 client에 전달하므로 같은 로컬 사용자에게 fixture 계정이 노출될 수 있다. `NODE_ENV=development`+명시적 switch+loopback API·loopback dev bind로 제한되고 production smoke가 미노출을 확인한다. 이 경계를 완화하거나 production에 켜지 않는다. |
| D2 밖의 범위 | NOT_RUN | OAuth, 초대·전체 역할 관리, 상태 전환, Realtime, commit 후 응답 유실 장애 주입, hosted/원격 CI, 전체 AC01~16은 D2 PASS에 포함하지 않는다. |

첫 reset 시도는 권한 확장 환경의 Node 24.12.0이 engine pin에 거부되어 DB 변경 전에 exit 1이었다. 고정 Node 24.19.0으로 재실행해 위 결과를 얻었다. 요청된 reset으로 초기화 전 로컬 합성 이슈 1·activity 4·receipt 4는 삭제됐으며 별도 백업은 만들지 않았다. 검수 중 생성한 이슈와 연관 activity/receipt만 정확한 UUID로 정리했고 최종 상태는 합성 사용자 4·팀 2·이슈/activity/receipt 0이다.

## D2 실제 결과 — 2026-09-14

Windows 25H2 / PowerShell 7.6.5 / Node 24.19.0 / pnpm 11.19.0 / Supabase CLI 2.117.0 / PostgreSQL 17.6 / Docker 서버 29.7.2. Next 16.3.5·React 19.3.0 유지, Supabase JS 2.116.0·pg 8.23.0 추가. 합성 계정 Owner/Member/Viewer/다른 팀 Owner, 팀 2개. hosted 환경·실제 사용자 데이터는 사용하지 않았다.

| 명령/검증 | 결과 | 실제 확인과 한계 |
|---|---|---|
| `pnpm db:start`, `pnpm db:migrate` | PASS | 로컬 스택 기동 후 `20260914000100_d2_issue_commands.sql` 적용. 기존 데이터를 지우는 명령 없이 최초 적용 |
| `pnpm db:seed`, `pnpm db:env`, `pnpm db:types` | PASS | 합성 계정 4개·팀 2개, 공개 env 생성, 실제 DB에서 public 타입 생성. `.local/.env.local`은 비공개 로컬 파일 |
| `pnpm db:reset --confirm-local-reproboard` → seed/types | PASS | 먼저 실제 사용자 0·이슈 0·이번 합성 팀 2개를 확인. 고정 loopback·Docker 식별자 검사를 통과한 로컬 DB에서 migration 재적용·계정 재준비. 운영/공유 DB reset 없음 |
| `pnpm test:local-tools` | PASS 2/2 | 원격 API/DB·다른 포트/DB/컨테이너/작업 경로 거부. 확인 없는 reset·target override는 DB 실행 전에 거부 |
| `pnpm test:db` | PASS 14/14 | 실제 password 로그인 토큰으로 아래 권한/경합/재전송/롤백 검증. 증거 조회와 테스트 fixture 준비만 postgres 사용 |
| RLS·직접 DML | PASS | Owner/Member/Viewer 같은 팀 읽기, 타팀 rows 0, anon 읽기/RPC 거부. 모든 역할의 직접 issues insert·4테이블 update/delete 42501. Viewer/타팀 RPC 쓰기 거부 |
| 권한·payload | PASS | 타팀 issueId 주입/없는 id 모두 NOT_FOUND. title 외 status/created_by/version·잘못된 타입·길이 거부. auth.uid 없는 authenticated SQL 호출 거부. private receipt/내부 함수 접근 거부 |
| version·멱등성 | PASS | 두 실제 세션의 동시 수정 성공 1/CONFLICT 1·version +1. 동시 중복 create/update는 동일 결과·activity/receipt 1건. 이후 수정 뒤 과거 receipt 재전송도 추가 효과 0. 같은 requestId/다른 payload·operation 거부 |
| 트랜잭션·현재 권한 | PASS | 테스트 전용 requestId의 activity insert 예외로 이슈/version 롤백·receipt 0. 거부 경로 성공 기록 0. Member→Viewer 변경 후 과거 성공 요청 재전송도 FORBIDDEN |
| Unicode·용량 | PASS | JS trim과 같은 공백 제거, 120개 단일 이모지 허용. 합성 499개에서 동시 생성 2건 중 1건만 성공해 정확히 500개. 용량 테스트 팀/행은 정리, 성능 측정 아님 |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | PASS | ESLint·Next 타입/tsc·기존 Vitest 1건·production build. 테스트 삭제/skip 없음 |
| 고정 설치·비밀 값 대조 | PASS | `pnpm install --frozen-lockfile` exit 0. 실제 합성 비밀번호·로컬 JWT/secret/service 키를 메모리에서만 읽어 소스 후보 65개와 production server/static 파일 162개 대조: 일치 0. 값 자체는 출력하지 않음 |
| `pnpm test:e2e` | PASS 5/5 | production 3100: 기존 4개 smoke 유지, 개발 계정 UI와 fixture 이메일 미노출 추가. 실제 OAuth 검증 아님 |
| `pnpm test:db-ui` | PASS 3/3 | development 3000: 실제 생성→수정→reload·DB version 2, Viewer/타팀/로그아웃, 별도 context Owner/Member의 충돌 초안 보존→최신 확인→version 3. 390px overflow 없음·기본 저장 흐름 pageerror 0 |
| 별도 V02·원격 CI·OAuth·전체 AC01~16 | NOT_RUN | D2 최소 제목 흐름만 해당. 초대/다른 필드/상태 전환/Realtime/응답 유실 주입/전체 수용 기준은 미구현·미실행 |

- 중간 FAIL 후 수정: JS 테스트의 브라우저 전역 선언·finally 오류 전달, SDK의 `abortSignal`/`maybeSingle` 호출 순서. 최종 lint/typecheck PASS.
- DB UI 최초 실행은 기존 Next dev PID의 잠금으로 FAIL. 경로 확인 후 자식 종료를 시도했으나 부모가 재기동했다. 동일 3000 서버를 재사용하도록 구성 후 3건 PASS. PowerShell Stop-Process 실패는 성공으로 집계하지 않았다.
- 실제 캡처: `playwright-db-report/index.html`의 `d2-saved-inbox`, `d2-stale-title`. DB UI trace/storageState는 저장하지 않는다. 보고서 폴더는 gitignore이며 재실행으로 생성한다.
- 테스트 정리: API 테스트와 브라우저 테스트가 만든 UUID만 삭제. activity 오류 주입 trigger/function과 임시 용량 팀은 finally에서 제거. 원래 개발자의 이슈를 삭제하지 않는다.
- 정리 후 실제 DB 조회: issues/activity/receipts 각각 0, 합성 팀 2개, 테스트 오류 주입 함수 0. 기존 미커밋 V01 진행 기록·검증 본문은 작업 전 사본과 문자 단위 대조해 동일함을 확인했다. AGENTS 변경 없음.
- AC01/03/07/08/14/15의 D2 일부 위험을 검증했으며 전체 AC 통과로 올리지 않았다. 전송 실패 후 같은 요청 확인 UI는 있지만 DB commit 후 응답 유실 주입은 D6에서 별도로 검증해야 한다.

## D2 재개 확인 — 2026-09-15

- PASS: 정지된 Docker Desktop을 `docker desktop start --timeout 45`, 기존 Supabase를 `pnpm db:start`로 기동(exit 0). 재설치·reset·seed·migration 재실행 없음.
- PASS: Node 24.19.0/pnpm 11.19.0으로 `pnpm dev` Ready. Docker 서버 29.7.2, 프로젝트 컨테이너 8개 실행, healthcheck가 있는 7개 healthy.
- PASS: login(3000)·Auth(54321)·Studio(54323) HTTP 200. 실제 SQL 조회로 합성 팀 2개, 이슈/receipt 각각 0개 확인. 비밀 값·응답 본문 출력 없음.
- 수정/PASS: 최종 Git 검사에서 생성 타입의 마지막 빈 줄 검출. 생성 도구에 끝 공백 정규화를 추가한 뒤 `pnpm db:types`, `pnpm lint`, `pnpm typecheck` exit 0. 실제 DB 타입 차이는 마지막 빈 줄 제거뿐이다.
- NOT_RUN: 09-14 통과한 앱/DB 테스트 25건·빌드를 오늘 다시 실행하지 않음. 앱/SQL 동작 변경 없이 기동·문서·타입 출력 공백만 정리했으며, 별도 V02는 다음 단계다.

## D1 실행 환경 (당시 기록)

- 실제 실행일: 2026-09-13 (Asia/Seoul), D1 최초 로컬 변경. 커밋 식별자는 최종 보고/`git log` 참조.
- Windows 25H2 (빌드 26200.9445), PowerShell 7.6.5. CPU·메모리 성능 비교는 미측정.
- Node 24.19.0 / pnpm 11.19.0 / Next 16.3.5 / React 19.3.0 / TypeScript 5.9.3.
- Supabase CLI 2.117.0 / PostgreSQL 17.6 / Docker Desktop 4.90.0·엔진 29.7.2 / WSL 2.6.3.0.
- Playwright 1.63.0 / Chromium 153.0.8010.12 (build 1243) / Vitest 5.0.0 + jsdom 30.0.1.
- local: dev 127.0.0.1:3000, production smoke 127.0.0.1:3100. Hosted 환경은 미사용.
- 데이터 없는 골격·비로그인 상태. 제품 테이블/개발 계정 없음. HTTP/WS 장애 주입·실제 협업·성능 측정은 NOT_RUN.
- 일반 사용자 PATH의 Node 24.12.0과 Codex 런타임 24.19.0이 달랐다. 검증 프로세스의 PATH를 후자로 고정했고 전역 Node 설정은 변경하지 않았다. 외부 OAuth 설정 없음.

## V01 독립 검증 — 2026-09-14

| 검증 항목 | 결과 | 실제 확인과 한계 |
|---|---|---|
| 기존 파일 손실 | NOT_RUN (과거 기준) / PASS (현재 커밋 기준) | 검수 시작 전 working tree는 clean, 추적 파일 49개, HEAD 이후 삭제 0개였다. 그러나 저장소 이력은 부모 없는 최초 커밋 `177c5b8` 1개뿐이어서 P01 전 파일 목록·해시와 독립 비교할 기준이 없다. 현재 필수 문서는 모두 존재하지만 기존 파일 무손실이라는 과거 주장은 Git만으로 재검증할 수 없다. |
| 클라이언트 경계 | PASS | `use client`는 Next 오류 경계 2개, 클릭 재시도 컴포넌트, `/board` 하위 Query provider에만 있다. Root layout·`/`·`/board`·`/login`·보드 골격은 Server Component이며 앱 전체 client 전환은 없다. |
| 패키지 매니저·스크립트 | PASS | `pnpm-lock.yaml`만 존재하고 packageManager/engines는 pnpm 11.19.0·Node 24.19.0으로 일치한다. README/CI가 참조하는 package script는 모두 존재한다. `pnpm install --frozen-lockfile --prefer-offline`도 exit 0이었다. |
| 필수 명령 | PASS | `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm build` exit 0. `pnpm dev`는 127.0.0.1:3000에서 705ms에 Ready가 되었고 검수 후 종료했다. |
| 첫 페이지 런타임 | PASS | 실제 브라우저에서 `/`→`/board`, 제목 `버그 보드 | ReproBoard`, readyState `complete`, 새로고침 후 Next 오류 dialog 0, console warn/error 0. 서버 로그의 `/`, `/board` 요청은 모두 200이었다. Next 개발 도구 portal 존재는 오류 overlay로 계산하지 않았다. |
| 비밀 값 커밋 위험 | PASS (현재 단일 커밋 범위) | 추적된 env 파일은 빈 값의 `.env.example`만이고 `.env*`·storageState·Supabase temp는 ignore된다. HEAD에서 Supabase secret/JWT/GitHub/OpenAI/private-key 형식 검출은 없었고 `service_role`은 금지 설명문에만 있었다. 외부 secret scanner와 삭제된 과거 이력 검사는 이력이 1개라 별도 수행하지 않았다. |
| README 설치·앱 기동·환경 변수 | PASS | 고정 Node/pnpm, frozen install, `pnpm dev`, `/` redirect, D1은 env·Docker 불필요라는 설명이 코드·실행과 맞는다. 세 env 이름은 `.env.example`과 같고 앱이 아직 읽지 않는다는 설명도 맞다. |
| README 로컬 스택 현재 상태 | FAIL (문서 정확성) | README의 2026-09-13 기동 성공 기록은 과거 결과로 보존 가능하지만 “현재 로컬 스택을 실행 상태로 두었다”는 2026-09-14 실제 상태와 다르다. Docker CLI 29.7.2는 있으나 Linux 엔진 pipe가 없고 Auth/Studio 포트도 연결 거부였다. 지속 상태를 현재형으로 주장하지 않도록 후속 문서 수정이 필요하다. |
| Docker / Supabase / OAuth 구분 | NOT_RUN·미설정 분리 | Docker: CLI 설치, 엔진 정지. Supabase: CLI 2.117.0·config 존재, 스택 정지; migration 디렉터리·seed·앱 client 없음. OAuth: GitHub provider section·콜백 코드·로컬 비밀 env 모두 없음. OAuth는 D3 범위이며 D2의 외부 선행 조건이 아니다. |

V01은 D1 앱 골격을 PASS로 판정한다. 실제 이슈 생성·조회·수정, RLS/RPC, 개발 사용자, 권한·version·멱등성·협업은 전부 NOT_RUN이며 골격 통과에 포함하지 않는다. D2/P02 실행 전 Docker Desktop Linux 엔진을 시작해 서버 버전을 확인하고 `pnpm db:start`/`pnpm db:status`를 성공시켜야 한다. 이후 migration·로컬 개발 사용자·보호된 seed/reset·일반 사용자 세션의 앱 DB 연결을 P02에서 구현한다. GitHub OAuth·원격 저장소·배포는 D2 선행 조건이 아니다.

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

D7/P07의 위 로컬 범위는 PASS이며 전체 고유 테스트 111건이 통과했다. 과거 단계의 상세 기록은 당시 결과로 보존한다. 다음은 V07 독립 검증이며 MVP 전체 릴리스 판정은 아직 하지 않는다. 독립 V03~V07·실제 GitHub OAuth·원격 CI·공개 배포·새 clone 검증은 NOT_RUN이다. 합성 데이터로 생성한 D6/D7 영상은 위 경로에 있으며 실제 사용자 피드백·전파 성능 주장은 하지 않는다.
