# 실제 앱 시연과 녹화

신규 `/demo` 화면은 D10 기능 동결에 따라 후속이다. 기존 앱·실제 로컬 Supabase·합성 개발 계정으로 시연한다. 2026-09-26 별도 소스 복사본·새 로컬 DB에서 4/4 시연 PASS, PNG 8개·WebM 5개를 기록했다. 실제 사용자 데이터/사용성 관찰이나 성능 측정 영상으로 소개하지 않는다.

## 실제 증빙

[정상 흐름 6.28초](evidence/d13-normal-flow.webm) · [충돌 Owner 3.88초](evidence/d13-owner.webm) · [충돌 Member 3.80초](evidence/d13-member.webm) · [A 실패/B 성공 4.28초](evidence/d13-request-isolation.webm) · [단절 복구 3.96초](evidence/d13-offline-recovery.webm).

무음 자동 조작 원본이다. 전체 영상을 해설한 3~4분 편집본은 NOT_RUN이며 아래는 직접 제작할 클릭 순서다. 충돌 Owner/Member는 같은 실행의 별도 context이며 시작 시각이 달라 파일 길이가 다르다. 8개 PNG와 영상 샘플 프레임을 직접 검토하고 ffprobe로 실제 길이를 확인했다.

[전체 보드](evidence/d13-board.png) · [Ready 누락](evidence/d13-ready-missing.png) · [검증 입력](evidence/d13-verification-dialog.png) · [Done·기록](evidence/d13-done-history.png) · [충돌 비교](evidence/d13-conflict.png) · [실패 격리](evidence/d13-isolated-failure.png) · [오프라인 초안](evidence/d13-offline-draft.png) · [복구 후 초안](evidence/d13-recovered-draft.png).

[시연 결과·파일 해시](evidence/d13-demo-results.json) · [환경·소스 커밋·새 DB 재현 결과](evidence/d13-reproduction.json). 새 DB 소스는 1f0b86c, 녹화 구도·추출 도구는 e929668이다. 첫 보드 PNG에서 카드가 화면 밖으로 잘려 fullPage와 명시적 viewport로 재녹화했다. 앱 동작/assertion은 바꾸지 않았다.

## 재현·녹화 명령

[README의 깨끗한 복사본 절차](../README.md#d13-깨끗한-소스새-로컬-db-재현)대로 설치→별도 Docker 프로젝트→migration→seed→env를 준비한다. 합성 Owner/Member/Viewer/타팀 Owner 4명과 팀 2개가 만들어진다. 테스트는 장면별 필요한 1~2개 이슈와 임시 팀을 실제 명령으로 준비하고 종료 후 정리한다. 임의로 12개가 준비됐다고 가정하지 않는다.

```text
pnpm exec playwright install chromium
pnpm test:demo
node scripts/export-demo.mjs
```

3000 포트에서 자동 dev 서버를 시작하거나 같은 복사본의 기존 서버를 사용한다. 다른 폴더의 서버/스택을 동시에 켜지 않는다. 단일 worker·retry=0, 서로 다른 context의 실제 계정 세션이다. `.local/demo/report.json`은 실행 결과, `test-results/demo`는 원본 PNG/WebM이다. trace/storageState는 저장하지 않는다. HTML/JSON 원시 리포트를 공개하기보다 확인된 PNG/WebM과 비밀 값 없는 테스트 결과만 선정한다. 영상은 context 종료 후 완성된다. `export-demo`가 네 장면 모두 단일 PASS인지 확인하고 `.local/demo/export`에 13개 미디어와 결과 manifest를 추출한다. 실패/부분 실행의 증빙은 완성본으로 추출하지 않는다.

4개 선택 사례:

| 장면 | 실제 검증과 장애 방법 | 녹화 대상 |
|---|---|---|
| 정상/재검증 | D5 UI completes: 제목 생성, 누락 Ready 거부, 보완·할당·수정·검증 실패·재검증 통과·Done·재오픈, Viewer 기록 조회 | Owner 기본 page |
| 충돌 | D7 two browser users race: Owner 제목/Member 환경을 같은 version으로 보내도록 Playwright request gate, DB 성공 1/CONFLICT 1·초안/복사·명시적 재편집 | Owner와 Member 동시 실행 각각 원본 영상 |
| 실패 격리 | D6 delayed A: A 상태 명령을 gate에서 보류, B 저장 성공, 다른 Member가 A를 실제 수정한 뒤 gate 해제→A의 오래된 version만 DB 거부 | Owner; 상대 수정은 실제 Member RPC |
| 재연결 | D8 A offline: A context offline, B 브라우저 저장, A online 뒤 snapshot 응답 gate 사이 B 추가 저장→dirty 재조회·초안 보존·자동 쓰기 0 | A Owner; B는 별도 Member browser context |

장애/동시 전송 제어는 테스트 파일의 Playwright 네트워크 제어에만 있다. 앱/production에 장애 버튼을 추가하지 않았다. 녹화를 길게 만들려고 테스트에 임의 sleep을 넣지 않는다. 짧은 원본 클립이므로 일시정지/느린 재생으로 설명한다. 충돌 두 영상은 같은 실행이며 승자는 고정하지 않는다.

## 직접 설명하며 녹화할 클릭 순서 (목표 3~4분, 실측 길이 아님)

OS 녹화 도구로 앱 창만 선택하고 개발자 도구의 Network/쿠키/토큰 화면은 제외한다. 브라우저 A 일반 프로필과 B 시크릿/별도 프로필에 각각 `/login` → **개발 계정** Owner/Member → **개발 계정으로 로그인**. 같은 **합성 ReproBoard 팀**을 선택한다. 두 탭을 같은 프로필에서 열면 세션이 공유되므로 두 사용자 증거가 아니다.

1. **새 이슈 제목**에 `합성 · 필터 변경 뒤 이전 목록 표시` → **Inbox에 생성** → 카드 상세 → **Ready로 이동**. 누락 안내를 보여주고 Escape. 재현 단계 `1. 보드 열기 2. 필터 변경`, 기대 결과 `새 조건의 목록`, 실제 결과 `이전 목록`, 환경 `Windows · Chromium · 합성`, 재현 상태 `재현됨`, 심각도 S2, 우선순위 P1 → **변경 저장** → **Ready로 이동** → **이동 확인**.
2. 담당자 **합성 Member** → 저장 → **In Progress로 이동** → 확인. 수정 메모 `오래된 조회 응답 제외`, 대상 빌드 `synthetic-demo-1` → 저장 → **Verify로 이동** → 확인. **검증 통과 → Done**에서 검증 환경 `Windows · Chromium · 합성`과 메모를 입력 → **통과 기록 후 Done**. 본문 잠금과 과거 기록을 보여준다. 재검증 실패를 설명할 때는 Done 전에 실패 이유를 남겨 In Progress로 돌아간 뒤 다시 Verify로 이동한다.
3. 충돌은 새 Inbox 이슈를 A/B 모두 연다. A에 제목 초안, B에 환경 초안을 입력하고 B만 저장한다. A의 초안 보존·**최신 값 보기**·**내 입력 복사**·**최신 값으로 다시 편집** 후 명시적 저장을 보여준다. 원격 변경을 이미 받은 A는 저장이 잠기는 것이 정상이다. 같은 version의 정확한 DB 경합은 위 `test:demo` 두 사용자 원본을 사용한다.
4. 실패 격리는 위 자동 녹화의 A 지연/B 성공/실제 DB 충돌 구간을 사용하고 **개발 환경에서 저장 지연·경합 주입**이라고 설명한다. DevTools 전체 Offline은 특정 A만 거부시키는 시나리오와 다르므로 같은 증거로 쓰지 않는다.
5. 재연결은 A 보드 **새 이슈 제목**에 초안 입력 → A만 DevTools Network Offline → B에서 기존 이슈 제목 저장 → A에서 Offline 해제. 최신 카드가 갱신돼도 초안은 남고 자동 생성되지 않는다. **Inbox에 생성**을 직접 눌러야 저장된다. 복구 조회 중 추가 변경의 정밀 경합은 자동 녹화로 보여준다.
6. A 로그아웃 → Viewer 로그인 → 기존 상세에서 읽기·검증 기록은 보이고 쓰기/드래그는 없는지 보여준다. 마지막에 [실제 결과](TEST_REPORT.md)를 열어 로컬 PASS와 OAuth/원격 CI/배포 NOT_RUN을 구분한다.

## 캡처 선정과 공개 전 확인

대표 보드, Ready 누락 안내, 검증 입력/Done 기록, 충돌 비교, 단절/복구 초안은 테스트가 실제 확인한 직후 PNG로 첨부한다. 결과 증빙은 실행 환경·소스 커밋·테스트 이름/상태를 가진 JSON으로 남긴다. 저장된 경로가 존재하는지와 영상의 실제 프레임/길이를 확인한 후에만 문서 링크를 만든다. 실제 이메일·secret·토큰·자격 파일은 넣지 않는다.

원본 영상을 편집할 경우 합성 데이터·장애 주입·편집 사실을 설명한다. 서로 다른 실행을 동시 협업처럼 붙이지 않는다. 3~4분 내레이션 버전은 직접 녹화 전까지 제작 완료로 쓰지 않는다. 외부 업로드·공개 영상 링크는 아직 없다.

## 공개 환경

README의 외부 설정 목록대로 대상·OAuth·환경별 URL·RLS·production smoke가 준비된 이후 별도 실행한다. 개발 계정을 배포하거나 공유 Owner 암호를 공개하지 않는다. RLS를 해제하지 않는다. 현재 시연은 loopback 로컬 전용이다.
