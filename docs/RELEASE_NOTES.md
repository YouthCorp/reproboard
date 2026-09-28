# v0.1.0 릴리스 메모 초안

작성일: 2026-09-27 · **릴리스 후보**. package 버전은 0.1.0이지만 Git 태그·GitHub Release·공개 배포는 아직 만들지 않았다. 실행 가능한 로컬 소스와 합성 시연 증빙을 준비했다. Git 원격은 [YouthCorp/reproboard](https://github.com/YouthCorp/reproboard)에 비공개로 연결했다. 존재하지 않는 공개 데모 링크는 제공하지 않는다.

## 포함된 동작

- 제목만으로 버그 접수, 5개 고정 상태, 재현 정보·분류·담당자·수정 메모/앱 버전, 현재 version의 통과/실패 재검증과 재오픈 이력.
- GitHub OAuth/SSR callback·logout 코드와 로컬 개발 사용자의 실제 로그인. 관리자·멤버·읽기 전용, 해시 저장 일회용 초대·역할 변경.
- 요청별 낙관적 이동, 실패 격리, requestId 중복 방지, DB version 충돌과 초안 비교·복사·명시적 재편집.
- 실제 Postgres Changes 재조회, WS/HTTP 구분, 구독 후 최신 조회와 dirty 재조회, 강등·멤버십 소실·로그아웃 정리.
- 텍스트 댓글·팀 멘션·개인 알림, URL 검색/필터/정렬/상세, 키보드 이동과 모바일 상세.
- 한국어 정보 위계·문서형 상세·SUIT 타이포그래피 개선. 1440/768/390px [현재 화면](UI_UX_REVIEW.md).

## 검증과 재현

[TEST_REPORT](TEST_REPORT.md)의 날짜별 로컬 PASS: 단위/UI 57·격리 DB 46·격리 E2E 35·production smoke 6. UI 변경 후 실제 DB UI 35건도 PASS다. D13 별도 소스/새 DB 설치·seed·실제 저장 재현과 시연 4건(PNG 8/WebM 5)이 있다. 동일 OS 캐시를 재사용했으며 새 OS/원격 clone 결과는 아니다. 현재 문서/링크 검사는 `pnpm test:docs`로 재현한다.

[README](../README.md) → [개발 안내](DEVELOPMENT.md) → [시연](DEMO.md) 순서로 실행한다. 처음 설치는 고정 Node/pnpm·Docker를 확인하고 migration→seed→env를 준비한다. 기존 로컬 데이터가 있으면 reset하지 않고 `pnpm db:migrate`를 사용한다. 앱의 DB 타입은 migration 6개와 대조한 생성 파일이다. 신규 기능은 동결했다.

## 알려진 한계

초안/미확정 요청의 reload·이탈 후 복원, 자동 필드 병합, 오프라인 쓰기 큐, 파일 업로드, 이슈 삭제, 새로운 `/demo` 화면은 없다. 실제 OS IME·스크린리더·외부 사용자 관찰·장기 단절·전파 지연 20회는 NOT_RUN이다. 09-28 CI의 첫 구독 경합은 수정·전체 회귀 PASS했으며, 과거 D9 대기 실패 1회까지 동일 원인이었는지는 원시 근거 부족으로 단정하지 않는다. 3~8명/500개는 목표 범위이며 운영 규모 검증 결과가 아니다.

## 공개할 정확한 결과물

1. 이 저장소의 검토된 로컬 커밋: 코드·migration 6개·lockfile·`.env.example`·테스트·CI·실행 문서. `.env.local`, `.local`, 계정/secret/storageState는 제외한다.
2. [README](../README.md), [사례 연구 3건과 2페이지 설명](CASE_STUDY.md), [검증 보고서](TEST_REPORT.md), [현재 UI 전후](UI_UX_REVIEW.md), [실제 시연/촬영 절차](DEMO.md).
3. MIT [원본 LICENSE](../LICENSE)와 [외부 자산 고지](../THIRD_PARTY_NOTICES.md), SUIT OFL 전문. 현재 collective 저작권 표기를 보존한다.
4. 본 파일을 기반으로 한 v0.1.0 릴리스 설명. 필수 확인이 끝나기 전 정식 태그를 만들거나 공개 완료라고 표시하지 않는다.

## 남은 외부 작업 — 한 번에 준비할 항목

- **저장소와 권한**: YouthCorp/reproboard 비공개 저장소에 main push를 완료했다. 공개 전환 여부를 정한다. 비공개 취약점 신고를 활성화하고 [SECURITY](../SECURITY.md)에 실제 경로를 연결한다. 공개 승인 후에만 push/Release를 진행한다.
- **CI(2026-09-28)**: `03b844f`는 app·DB 46·UI 35 전체 PASS였지만 후속 `d8235ea`는 스택 기동 단계에서 실패했다. 최신 판정과 기동 진단 보완은 [검증 기록](TEST_REPORT.md)을 따른다. 과거 PASS로 후속 실패를 대체하지 않는다.
- **OAuth**: 개발/운영별 GitHub OAuth App과 Supabase provider, callback·site/redirect URL을 [정확한 설정 절차](DEVELOPMENT.md)에 맞춘다. 성공·취소·콜백·로그아웃을 수동으로 확인한다. 개발 계정 로그인은 이 확인의 대체가 아니다.
- **배포를 선택할 때**: 호스팅·HTTPS origin·hosted Supabase를 정하고 승인된 대상에만 migration/환경 변수를 적용한다. RLS/grant/publication, 일반 사용자·Viewer·타팀, production 개발 도구 미노출, 저장·충돌·복구 smoke를 확인한다. 공유 관리자 계정/RLS 해제는 사용하지 않는다.

D14 이후 사용자의 요청으로 비공개 원격 생성/연결/push와 CI 전체 PASS 확인을 완료했다. OAuth·공개 전환·배포는 별도 확인 대상이다. 포트폴리오에서는 실제 구현과 검증한 기술 사례를 소개할 수 있지만, **운영 중인 서비스·OAuth 검증 완료·정식 출시**라고 설명하지 않는다.
