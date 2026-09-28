# 검증 보고서

기준: **2026-09-27, v0.1.0 릴리스 후보**. 로컬 PASS와 원격 CI/공급자/운영 검증을 구분한다. 개발 계정은 합성이고 모든 앱 동작은 실제 사용자 세션이다. fixture 준비·정리/SQL 결과 확인 외에 서비스 키로 사용자 동작을 대체하지 않았다. 외부 사용자 관찰과 독립 검수는 NOT_RUN이다.

## CI Realtime 첫 구독 수정 — 2026-09-28

- 원격 [e7d8221 실행](https://github.com/YouthCorp/reproboard/actions/runs/36356540213): app PASS, DB 24 PASS/25번째 D9 Realtime FAIL. 이후 DB 21개와 UI 전체는 NOT_RUN이다. 전체 CI를 성공으로 보지 않는다.
- 수정 전 동일 D9 사례를 로컬에서 실행해 모든 역할의 이벤트 배열이 빈 채로 실패했다. 코드 변경 없는 두 번째 실행은 PASS였다. 채널 가입 직후 쓰는 초기 구독 경합과 일치하며 원격의 원시 실패 로그는 수집되지 않아 그 내부 오류까지 단정하지 않는다.
- 앱과 D7/D9 DB 스트림에서 SDK 2.116.0의 `postgres_changes_options.wait: true`를 사용한다. 단순 소켓 가입 대신 DB 변경 수신 준비가 끝난 뒤 재조회/테스트 쓰기를 시작한다. 고정 지연·retry·skip·권한 검증 완화는 추가하지 않았다.
- 수정 후 로컬 Realtime v2.130.0 컨테이너만 재시작하고 D9 사례 1/1 PASS. 기존 DB/사용자 데이터는 보존했다. lint/typecheck/build, 앱 단위 57, 로컬 보호/진단 8, 문서 검사 PASS.
- CI 실패 출력은 종료 코드·허용된 오류 분류만 추가했다. 원시 오류/행/계정/토큰은 로그나 artifact에 공개하지 않는다. 알 수 없는 오류는 `inspect-private-log`로 남긴다.
- 로컬 전체 [DB 46/46](evidence/ci-readiness-db.json), 관련 격리 UI [D7 3/3](evidence/ci-readiness-d7-ui.json)·[D8 5/5](evidence/ci-readiness-d8-ui.json)·[D9 3/3](evidence/ci-readiness-d9-ui.json), production smoke 6/6 PASS. UI는 관련 11개만 재실행했으며 로컬 전체 35개 재실행은 NOT_RUN이다. 실행 후 fixture 정리와 lock 제거를 확인했다.
- 수정 커밋 `03b844f`의 [원격 CI](https://github.com/YouthCorp/reproboard/actions/runs/36357831192)는 **전체 PASS**: app 작업(정적/단위/보호/문서/build/smoke), DB 46/46, 격리 브라우저 35/35. 새 Ubuntu runner의 실제 로컬 스택에서 기존 실패 사례 25번을 포함해 전부 실행했고 정리 작업도 성공했다. 재시도/skip 없이 확인했다. 실제 OAuth·배포 smoke는 이번 수정에서도 NOT_RUN이다.

## 원격 연결 후속 — 2026-09-27

사용자 요청으로 [YouthCorp/reproboard](https://github.com/YouthCorp/reproboard)를 비공개로 생성하고 origin/main 추적과 최초 push(9a65d30)를 완료했다. [첫 CI 실행](https://github.com/YouthCorp/reproboard/actions/runs/36320335374)은 자동 시작했다. 이 기록 시점에는 진행 중이며 PASS/FAIL 최종 판정 전이다. 아래 D14의 CI NOT_RUN은 최초 push 이전 결과다. 공개 전환·태그/Release·OAuth·배포는 수행하지 않았다.

Git 이력의 텍스트 객체 396개에 대해 제외 경로·알려진 로컬 secret·GitHub token/private-key 패턴을 값 출력 없이 검사했고 일치 0이었다. 전체 보안 감사를 의미하지 않는다. 기존 사용자/DB/환경 파일은 변경하지 않았다.

## 환경과 테스트 층

Windows 25H2/PowerShell 7.6.5, Node 24.19.0, pnpm 11.19.0, Chromium 153.0.8010.12, Docker Linux 엔진·로컬 Supabase/Postgres 17.6. 정확한 라이브러리는 lockfile을 따른다. 명령의 선행 조건·격리·포트는 [DEVELOPMENT](DEVELOPMENT.md)에 있다.

| 층 | 실제 실행 결과 | 날짜/근거 |
|---|---|---|
| ESLint/typecheck/production build | PASS | D12/D13 및 UI 개선 후 09-27; 앱 코드 기준 d42f3c0 |
| Vitest 순수 규칙·jsdom UI | 57 PASS | 09-27. 상태/필드/URL/캐시 version/복구 coordinator 등. 실제 DB 통과와 구분 |
| 로컬 초기화/fixture 보호 | 6 PASS | D13. 새 복사본 보호를 포함. `test:local-tools` |
| 격리된 실제 DB/API | 46 PASS | 09-25~26. [사례별 결과](evidence/d12-db-results.json), 각 사례마다 새 사용자/팀 |
| 격리된 실제 DB UI/E2E | 35 PASS, retry=0 | 09-26. [사례별 결과](evidence/d12-ui-results.json), 서로 다른 사용자 browser context |
| UI 개선 후 실제 DB UI 전체 | 35 PASS, retry=0 | 09-27. [결과](evidence/ui-regression.json). 기존 개발 계정 사용, fixture 정리. D12의 사례별 사용자 격리 실행과 구분 |
| UI 추가 확인 | 디자인 4·폰트 비교 1·URL 4·팀 권한 4 PASS | 09-27. [화면/발견 결함](UI_UX_REVIEW.md). 겹치는 테스트를 전체 건수에 합산하지 않음 |
| Production smoke | 6 PASS | 09-27. 실제 GitHub OAuth 성공을 검증하는 테스트가 아님 |
| Production 합성 100개 조작 관찰 | 1 PASS | 09-27. [원자료](evidence/ui-interaction.json), 아래 측정 범위 참조 |
| 새 소스·빈 로컬 DB 재현 | PASS | 09-26. [환경·해시·절차](evidence/d13-reproduction.json) |
| 실제 앱 시연/녹화 | 4 PASS, PNG 8·WebM 5 | 09-26. [파일 해시](evidence/d13-demo-results.json), [시연](DEMO.md). UI 개선 전 영상 |
| D14 문서·라이선스·관련 회귀 | 문서 검사·lint·보호 6 PASS | 09-27. Markdown 21개 로컬 경로/heading·실행 명령 검사. 직접 의존성 28개와 폰트 대조 |
| GitHub CI | PASS (03b844f) | 09-28 app·DB 46·격리 UI 35. 수정 전 e7d8221의 실패와 구분, 상단 실행 링크 참조 |
| 실제 OAuth / 공개 배포 smoke | NOT_RUN | 외부 앱/호스팅 미설정 |

위 숫자는 서로 다른 검증 층과 날짜다. 하나의 전체 성공률로 합산하지 않는다. 이번 문서 변경만으로 과거 앱 테스트를 오늘 다시 실행했다고 표시하지 않는다.

## D14 문서 검증

`pnpm test:docs`, `pnpm lint`, `pnpm test:local-tools`(6건) PASS. README 분리로 끊어진 PROGRESS의 OAuth heading 링크를 수정했다. 문서 검사기는 pnpm 버전 문장을 명령으로 오인한 문제를 수정하고 다시 PASS를 확인했다. 코드펜스 밖 로컬 Markdown 링크·heading과 실행 안내의 package script를 검사하며, 임의 HTML/동적 사이트 전체를 검증하는 도구는 아니다.

[외부 링크 검사](evidence/d14-external-links.json)는 공개 URL 37개 중 HTTP GET 36개 PASS, TanStack 1개는 제한 시간 내 응답을 얻지 못해 NOT_RUN이다. 해당 [공식 페이지](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)는 별도 웹 조회로 내용을 확인했으며 GET 결과를 성공으로 덮어쓰지 않았다. 외부 페이지 내 fragment와 향후 가용성은 보장하지 않는다. [직접 의존성 28개·SUIT 해시](evidence/d14-licenses.json)도 대조했다.

D14는 문서·검사 도구·CI의 문서 검사 단계·package 라이선스만 변경했다. 앱/SQL/의존성 버전은 유지했다. 따라서 앱 typecheck/단위/build/DB/E2E·새 브라우저 촬영은 이번 단계에서 NOT_RUN이며 위의 마지막 실제 실행 결과를 참조한다. D13 실행 재현을 D14 문서로 새 OS에서 다시 수행한 것은 아니다.

## 수용 기준별 근거

| AC | 현재 근거 | 남은 범위 |
|---|---|---|
| 01 | D13 별도 git archive·새 project/빈 DB·28개 고정 의존성 설치·migration 6·seed·실제 로그인/등록/편집/reload PASS | 원격 clone·새 OS·독립 사용자 재현 NOT_RUN |
| 02 | DB 25개 상태 쌍·필수조건·Done 편집 거부·오래된 검증·원자성/과거 기록, UI 전체 상태 경로 PASS | 별도 운영 환경 미검증 |
| 03 | Owner/Member/Viewer/타팀/anon 실제 토큰, 직접 DML·forged FK·Owner 주입·프로필 최소 공개 PASS | hosted 설정 미검증 |
| 04 | 초대 동시 수락·만료/재사용·해시·Member 고정, UI 생성/수락/강등 PASS | Owner 이전은 미지원 |
| 05 | 지연 중 overlay/저장 표시, A 명령의 실제 DB 거부 후 A만 복구 PASS | 정량적 이동 지연 개선 측정 아님 |
| 06 | A 거부/B 성공, pending 중 원격 변경·늦은 응답에서 최신 값 유지 PASS | 장기 반복 부하 미검증 |
| 07 | 같은 requestId 동시 재전송/다른 payload 거부, commit 후 응답 유실에도 검증·활동·receipt·댓글·알림 중복 없음 PASS | reload 후 미확정 요청 복원 없음 |
| 08 | 두 계정/context에서 같은 version의 서로 다른 필드 저장: 성공 1·CONFLICT 1·version+1, 초안/복사/재편집 PASS | 자동 필드 병합 없음 |
| 09 | 실제 publication·RLS·댓글/활동/알림 스트림, 실제 WS 프레임 중복·구독 중 변경·낮은 version 응답 PASS | 최초 콜드스타트 대기 실패 1회 원인 미확정 |
| 10 | A 단절/B 변경/A 복귀 및 복구 중 재변경·초안 유지·무자동 큐 PASS | 서버 재기동/장기 단절 반복 NOT_RUN |
| 11 | HTTP/WS 별도 실패·폴링·재마운트/팀 전환/로그아웃·강등/멤버십 소실·세션 만료 PASS | 실제 운영 세션·브라우저 다양성 미검증 |
| 12 | 두 멤버·Viewer·타팀, 멘션 중복/자기 알림 제거·수신자만 조회/읽음·본문 version 불변 PASS | 이메일/푸시는 범위 밖 |
| 13 | 파서/정규화·composition 이벤트·URL 공유/reload/history/0건·잘못된 값 PASS | 실제 OS 한글 IME NOT_RUN |
| 14 | Tab/Shift+Tab/Enter 생성→완료, Escape·오류 연결·첫/복귀 포커스 PASS | 실제 스크린리더·터치·외부 사용자 NOT_RUN |
| 15 | 로딩/빈 팀/검색 0건/권한/통신 오류·재시도·긴 한글 100개·390/768/1440px PASS | 브라우저 1종, 확대/다른 브라우저 NOT_RUN |
| 16 | D13 재현/시연 PASS, D14 코드/문서/라이선스 대조 | 실제 OAuth 성공/취소 NOT_RUN. 후보 유지 |

세부 이름은 JSON 결과 및 [DB 테스트](../tests/db), [브라우저 테스트](../tests/db-ui), [단위/UI 테스트](../src)를 따른다. 판정 기준 자체는 [ACCEPTANCE](ACCEPTANCE.md)에 보존했다.

## 실패에서 확인한 수정

- D12 첫 격리 UI는 19 PASS/1 FAIL/15 NOT_RUN이었다. 드래그 직후 Enter가 dnd-kit의 50ms click 억제 타이머에 걸렸다. 설치 코드로 확인하고 제어 시계로 그 타이머를 진행했다. 임의 sleep이나 assertion 삭제 없이 전체 35건 재실행 PASS였다.
- UI 개선 중 첫 전체 실행은 30 PASS/5 FAIL이었다. 바뀐 라벨을 정확한 새 사용자 동작으로 맞춘 4건과, 실제 복구 버튼이 접힌 영역에 숨은 결함 1건을 수정했다. 최종 전체 35 PASS다. 모바일 필터의 native details/React 상태 불일치도 직접 확인해 수정했다. [전후·추가 회귀](UI_UX_REVIEW.md)
- D11에는 상태 이동 뒤 포커스가 body로 빠지고 모바일 상세의 닫기가 사라지는 결함을 수정했다. 현재 UI 회귀에서도 키보드 경로와 고정 닫기를 확인했다.
- D9 최초 기동에서 실제 이벤트 대기 실패가 1회 있었다. 이후 전체 회귀는 PASS지만 원인을 확정하지 못했다. 해결된 결함이라고 표시하지 않는다.

## 재현·데이터 보호·관찰 범위

D13은 소스 1f0b86c의 별도 archive와 새 프로젝트/볼륨에서 README 순서대로 시작했다. 원본 node_modules/.env/.local을 복사하지 않았다. 같은 OS의 pnpm store·Docker 이미지·Chromium 캐시는 재사용했으므로 새 OS 설치나 외부 clone 검증이 아니다. 새 DB 선택 검사 4건은 전체 46건 재실행과 구분한다. 원본 10개 제품 테이블·사용자 id·환경/config/계정 파일의 전후 해시가 일치했다.

UI 개선 후에도 테스트 이슈/임시 팀을 정리하고 원본 데이터·계정/환경 해시 일치를 확인했다. 소스 232개/production 201개 검사에서 알려진 실제 비밀 값 일치 0이었다. 이는 가능한 모든 비밀을 탐지하는 보안 감사가 아니다. 원시 Auth 로그/storageState는 공개 증빙에 포함하지 않았다.

합성 100개, production, Ryzen 5 5600/16GiB, Chromium, 1440×1000, 로컬 무제한 네트워크에서 warm 조작 각각 10회 event→DOM→2 rAF를 관찰했다. 09-27 중앙값/최대는 상세 30/30ms, 필터 25/34ms, 검색 319/324ms(300ms debounce 포함), 관찰 구간 Long Task 0이었다. **INP·두 사용자 전파 지연·전후 성능 개선율이 아니다.** 눈에 띄는 렌더 병목이 없어 Profiler 최적화는 수행하지 않았다.

## 릴리스 판단

로컬 핵심 검증은 PASS지만 실제 OAuth와 원격 CI·배포는 NOT_RUN이며 비공개 신고 채널도 미설정이다. AC16 전체를 통과했다고 표시하지 않는다. 실제 OS IME·스크린리더·외부 사용자 관찰·전파 지연 20회·장기 단절은 별도 미검증이다. [릴리스 메모](RELEASE_NOTES.md)의 외부 작업을 완료하거나 범위 제외를 명시적으로 결정하기 전까지 **릴리스 후보**로 남긴다.
