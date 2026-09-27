# ReproBoard UI 개선 기록

2026-09-27 · Windows 25H2 / Node 24.19.0 / pnpm 11.19.0 / Next 16.3.5 / 실제 로컬 Supabase / Chromium. D13 이후의 기존 기능을 다듬었다. 새 기능·DB migration·패키지 교체·공개 배포·포트폴리오 본문 작성은 하지 않았다. 시작 기준은 `5a4f083`, 기존 작업 트리는 깨끗했다. 주변 작업 공간에서 SignalDesk 자료를 찾지 못해 두 제품을 실제 비교했다고 주장하지 않는다.

## 화면에서 발견한 문제와 결정

| 우선 | 실제 요소 → 불편 | 적용한 변경 |
|---|---|---|
| 1 | 긴 DB 설명, 팀 생성, 연결 정보, 팀 관리가 각각 전체 너비를 차지 → 카드가 첫 화면 아래로 밀림 | 팀 선택과 보조 도구를 묶고, 정상 연결의 세부 설명은 접었다. 오류·복구 행동은 바로 노출 |
| 1 | 카드의 넓은 드래그 바, 담당자 부재 → 제목보다 조작부가 먼저 보이고 누가 처리하는지 상세에서 찾아야 함 | 작은 손잡이, 제목→심각도/우선순위→담당자 순. 상세의 키보드 이동 메뉴 유지 |
| 1 | 저장된 재현 정보와 작성 중 정보의 충족 수가 중복 → 어떤 값으로 판단하는지 혼동 | 편집 시 작성 중 정보, 읽기 전용/완료 시 저장된 정보만 표시. 누락만 별도 강조 |
| 1 | 담당자·분류가 긴 재현 입력 뒤에 있음 → 자주 바꾸는 속성까지 스크롤 | 제목 바로 아래 속성 묶음. 재현 정보→수정 내용→실제 검증 기록은 구역별로 읽음 |
| 2 | 영문 상태명·역할·“Inbox에 생성” → 클릭 결과를 번역해야 함 | 접수/진행 대기/수정 중/재검증/완료, 관리자/멤버/읽기 전용, 버그 등록. DB enum은 유지 |
| 2 | 작은 보조 글자와 시스템 폰트 혼합 → 한글 본문과 영문 번호의 위계가 약함 | SUIT 한 종류, 본문 15px, 카드 제목 15px/650, 상세 제목 25px(모바일 22px), 보조 정보 12~13px |
| 2 | 모바일에서도 검색·필터 6개 조작이 펼쳐짐 → 목록까지 긴 이동 | 검색은 항상 표시, 필터·정렬은 펼쳐 사용. 접힌 제목에도 적용 조건 표시, 초기화는 항상 표시 |
| 2 | 팀 권한 안내가 댓글·검증을 미구현이라고 설명 → 실제 권한을 잘못 이해 | 현재 기능과 일치하는 권한 설명. 충돌에서는 보존된 입력과 다음 행동을 명확하게 표시 |

유지한 부분: 5단계의 고정 작업 흐름, 제목만 등록, 기본 select와 명시적 저장, URL 상세/검색, native dialog의 Escape·포커스 복귀, 드래그 대체 메뉴. 재현 정보 0~4는 **입력 충족 수**이며 재현 성공률이나 신뢰도가 아니다. 검증 입력/상태별 필수 조건은 줄이지 않았다.

## 두 방향 비교와 선택

| 방향 | 배치·밀도·탐색·타이포그래피 | 판단 |
|---|---|---|
| 문서 목록 중심 | 행 목록에 제목·담당자, 문서형 상세가 중심. 넓은 읽기 폭과 낮은 밀도, 검색 중심 탐색 | 긴 제보 읽기에는 유리하지만 단계별 작업량과 다음 상태를 한눈에 보기 어려움 |
| 단계별 작업 보드 + 문서형 상세 | 5열에서 현재 단계와 담당자를 확인, 상세에서 재현/수정/검증을 읽음. 도구는 조밀하게, 본문은 여유 있게 | **선택.** 버그를 재현하고 수정한 뒤 다시 확인하는 제품의 핵심 흐름을 유지 |

Notion에서 참고한 것은 정렬·절제된 구획·일관된 조작이다. 보드에 필요 없는 사이드바나 통계는 만들지 않았다. 흰 문서, 옅은 회색 작업 열, 보라색 주요 행동, 경고의 별도 안내를 사용한다. 로고는 재현 범위를 나타내는 괄호와 검증 체크를 코드 SVG로 구성했다. 처리 상태는 열 제목, 심각도는 영향, 우선순위는 처리 순서로 각각 표시한다.

대표 보드/상세만 먼저 적용한 [1차 화면](evidence/ui-first/board-1440.png)을 확인한 후 로그인·팀 관리·댓글·알림·상태 안내로 확장했다. 마지막으로 긴 데이터와 예외 상태를 넣고 다시 확인했다. 모바일 필터는 한 번 펼쳐야 하는 비용이 생기므로 적용 조건과 초기화는 접지 않는다. 저장 전 초안은 로컬에, 저장된 값은 Query에 두는 기존 소유 관계를 유지했다.

## 한글 폰트의 실제 비교

동일한 합성 버그 제목·재현 단계·버튼·이슈 번호·환경의 숫자로 비교했다. [맑은 고딕](evidence/ui-fonts/Malgun-body.png) / [SUIT](evidence/ui-fonts/SUIT-body.png) / [Pretendard](evidence/ui-fonts/Pretendard-body.png), 각 후보의 `*-title.png`도 같은 폴더에 있다.

| 후보 | 파일·라이선스 | 화면에서 판단한 이유 |
|---|---|---|
| SUIT 2.0.1 Variable | WOFF2 625,480 bytes, SIL OFL 1.1 | 한글 본문의 열린 간격과 영문·숫자 굵기가 함께 읽혔다. 제목/라벨의 굵기 차이를 한 파일로 표현. 최종 선택 |
| Pretendard 1.3.9 Variable | 비교한 전체 WOFF2 2,057,688 bytes, SIL OFL 1.1 | 업무 UI에 익숙하고 굵기가 분명했다. 이번 전체 파일 조건에서는 SUIT보다 로딩 부담이 큼. subset 방식 비교는 하지 않음 |
| 맑은 고딕 | Windows 설치 폰트, 추가 다운로드 0 | 현재 OS에서는 가독성이 충분하지만 플랫폼마다 동일한 모양을 보장할 수 없음. Windows 라이선스의 설치 폰트로만 비교·대체 사용, 재배포하지 않음 |

공식 근거: [SUIT 릴리스](https://github.com/sun-typeface/SUIT/releases/tag/v2.0.1), [SUIT 라이선스](https://raw.githubusercontent.com/sun-typeface/SUIT/v2.0.1/LICENSE), [Pretendard 프로젝트](https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/docs/en/README.md), [Microsoft 맑은 고딕](https://learn.microsoft.com/en-us/typography/font-list/malgun-gothic). 선택한 원본과 라이선스는 `public/fonts`에 보관했다.

한 종류의 자체 호스팅 variable 파일을 preload하고 `font-display: swap`을 사용한다. `Apple SD Gothic Neo → Malgun Gothic → sans-serif` 대체 경로가 있다. 본문 줄 간격 1.65, textarea 1.75, 데스크톱 상세 최대 800px. 카드 제목은 4줄/모바일 3줄 제한, 전체 제목은 접근 가능한 이름과 상세에서 확인한다. 이슈 번호/개수는 고정 폭 숫자를 사용한다. 웹폰트 요청을 실제 차단한 [390px 대체 폰트](evidence/ui-after/font-fallback-390.png)에서도 가로 넘침·닫기 실패가 없었다. 글꼴에 따라 줄바꿈은 변하며 CLS 수치는 측정하지 않았다.

## 같은 데이터·크기의 캡처

별도 합성 팀 16개 버그(접수/진행 대기/수정 중/재검증 각 4개, 완료 0개), 같은 제목과 내용, 높이 900px. 리뷰 중 서버 데이터를 바꾸지 않았다. 개발 서버의 Next 표시가 포함된 실제 캡처이며 합성 이미지가 아니다.

| 화면 | 개선 전 | 보드/상세 1차 | 최종 |
|---|---|---|---|
| 1440 보드 | [전](evidence/ui-before/board-1440.png) | [1차](evidence/ui-first/board-1440.png) | [후](evidence/ui-after/board-1440.png) |
| 768 보드 | [전](evidence/ui-before/board-768.png) | [1차](evidence/ui-first/board-768.png) | [후](evidence/ui-after/board-768.png) |
| 390 보드 | [전](evidence/ui-before/board-390.png) | [1차](evidence/ui-first/board-390.png) | [후](evidence/ui-after/board-390.png) |
| 1440 상세 | [전](evidence/ui-before/detail-1440.png) | [1차](evidence/ui-first/detail-1440.png) | [후](evidence/ui-after/detail-1440.png) |
| 768 상세 | [전](evidence/ui-before/detail-768.png) | [1차](evidence/ui-first/detail-768.png) | [후](evidence/ui-after/detail-768.png) |
| 390 상세 | [전](evidence/ui-before/detail-390.png) | [1차](evidence/ui-first/detail-390.png) | [후](evidence/ui-after/detail-390.png) |

보드 열 시작 위치는 위 조건에서 1440px: **1265→647px**, 768px: **1350→720px**, 390px: **1846→784px**였다([전](evidence/ui-before/measurements.json)/[후](evidence/ui-after/measurements.json)). 화면 내 위치 변화이며 생산성·사용성 개선율이 아니다. 모바일 목록은 여전히 스크롤하며 읽는다.

추가 확인: [빈 팀](evidence/ui-after/empty.png), [검색 0건](evidence/ui-after/no-results.png), [모바일 적용 필터](evidence/ui-after/mobile-filters.png), [읽기 전용 상세](evidence/ui-after/viewer-390.png), [로그인](evidence/ui-after/login.png). 개선 전 빈 팀 캡처는 조회 완료 전이었으므로 [팀 전환 로딩](evidence/ui-before/team-loading.png)으로 이름을 바로잡았다. 이를 빈 상태 전후 비교라고 주장하지 않는다.

[필수 조건](evidence/ui-states/required-fields.png) · [검증 입력](evidence/ui-states/verification.png) · [A 거부/B 성공](evidence/ui-states/isolated-failure.png) · [충돌 비교](evidence/ui-states/conflict.png) · [오프라인 초안](evidence/ui-states/offline-draft.png) · [복구 후 초안](evidence/ui-states/recovered-draft.png) · [댓글](evidence/ui-states/comments.png) · [알림](evidence/ui-states/notifications.png). 실제 DB 테스트가 확인한 장면이다. 저장됨/저장 중/결과 확인 중은 다른 문구와 후속 행동을 유지하며 정상 연결만으로 저장 완료를 표시하지 않는다.

## 실제 검증과 수정한 회귀

| 실행 | 결과 |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | PASS, 단위·UI 57개. 초기 lint의 리뷰 스크립트 전역 선언 오류 수정 후 lint 재실행 PASS |
| `pnpm test:db-ui` | **35/35 PASS**, retry=0, 실제 사용자 세션·로컬 DB·두 browser context. [결과 manifest](evidence/ui-regression.json) |
| 마지막 변경 관련 회귀 | 모바일 disclosure 수정 뒤 URL/IME/탐색 4개 PASS. 실패 시 fixture 등록 보완 뒤 팀/인증 4개 PASS |
| `playwright.design.config.mjs` | 최종 비교·모바일 조건 복원·폰트 차단/동작 감소·Viewer 4개 PASS. 별도 폰트 비교 1개 PASS |
| `pnpm test:e2e` | production smoke 6개 PASS, 개발 계정 미노출 포함 |
| `UI_REVIEW_PHASE=after pnpm test:ux` | production 합성 100개, 상세/필터/검색 각 10회 PASS. 중앙값 30/25/319ms(검색 300ms debounce 포함), longtask 관찰 0. [실행 환경·원시 표본](evidence/ui-interaction.json) |

초기 전체 회귀는 30 PASS/5 FAIL이었다. 문구 변경에 따른 selector 4건을 현재 사용자 행동에 맞췄다. 나머지 1건은 연결 실패 때 복구 버튼이 접힌 안내 안에 숨은 실제 결함으로, 비정상 상태에서는 항상 보이도록 고쳤다. 추가 모바일 검사에서 초기 native toggle과 React 제어 상태의 경합으로 필터가 다시 열리는 결함을 발견해 펼침 상태를 native details에 맡겼다. 테스트 삭제·skip·retry 증가는 없다.

직접 브라우저 조작으로 검색/필터→상세→누락 조건 안내→Escape, 재조회 중 작성한 초안 유지, 상세 닫기 후 URL 조건·카드 포커스 복귀를 확인했다. 생성/편집/완료/댓글/알림/실패/충돌/복구의 전체 흐름은 실제 브라우저 자동 조작으로 검증했다. 외부 사용자를 관찰한 결과가 아닌 **자기 검증**이다.

100개 관찰은 기존 D11 파일을 덮지 않고 별도 기록했다. 엄격한 전후 성능 실험이나 INP 측정이 아니며 개선 비율을 계산하지 않는다. 긴 렌더링 문제를 관찰하지 않아 Profiler와 추가 최적화는 NOT_RUN이다.

## 다시 실행하기와 한계

[README](../README.md)의 Node/pnpm·Docker·로컬 DB·seed·env 절차 이후 `pnpm dev`, `http://127.0.0.1:3000/login`에서 합성 계정으로 로그인한다. 화면 비교용 데이터는 다음과 같이 별도로 만들고 정리한다. 기존 팀을 reset하지 않으며 정확한 loopback/project 검사를 통과해야 한다.

```powershell
node scripts/ui-review-fixture.mjs prepare
$env:UI_REVIEW_PHASE = 'after'
pnpm exec playwright test --config playwright.design.config.mjs screens.spec.mjs edges.spec.mjs
node scripts/ui-review-fixture.mjs cleanup
```

`prepare`는 실제 Owner 세션의 RPC로 합성 팀 2개/버그 16개를 만든다. `.local/ui-review-fixture.json`이 이미 있으면 재생성을 거부한다. 이 파일을 지우지 말고 같은 데이터로 비교한 뒤 `cleanup`을 실행한다. 폰트 비교 테스트는 선택 실행이며 `.local/font-review/SUIT-Variable.woff2`와 `PretendardVariable.woff2`가 필요하다. 각각 위 공식 릴리스의 `fonts/variable/woff2/SUIT-Variable.woff2`, `dist/web/variable/woff2/PretendardVariable.woff2`를 내려받은 뒤 `fonts.spec.mjs`만 지정한다. 최종 앱 실행에는 비교용 다운로드가 필요 없다.

원래 제품 데이터와 env/계정 파일은 보존했다. 초기 실패에서 남은 빈 합성 팀 1개는 실패 리포트의 UUID·이름·생성자·빈 상태를 확인한 뒤 정리했고, 이후에는 UI assertion 전에 생성 요청의 팀 ID를 정리 목록에 등록한다.

남은 한계: 실제 GitHub 공급자 승인/취소, 원격 CI, 공개 배포, 새 OS/다른 브라우저, 외부 사용자 1~2명, 실제 OS 한글 IME와 스크린리더는 **NOT_RUN**. DB 독립 46건은 이번 UI 작업에서 재실행하지 않았으며 D12 결과와 구분한다. D9 과거 콜드스타트 1회 실패 원인도 미확정이다. 상세 닫기/새로고침/팀 이동/로그아웃 후 미저장 초안 복원은 기존 미지원 범위다.

**판단:** 로컬 제품의 화면과 핵심 흐름을 근거로 포트폴리오 제작에 넘어갈 수 있다. 공개 서비스 배포 완료나 외부 사용자 검증 완료로 소개하면 안 된다. 포트폴리오에는 위 캡처와 세 가지 기술 결정(낙관적 UI·충돌·재연결)의 실제 증거를 사용하고, 외부 배포를 할 때는 README의 OAuth/환경별 URL/production smoke 선행 조건을 먼저 충족한다.
