# ReproBoard

**버그 재현부터 수정 후 재검증까지, 소규모 개발팀을 위한 협업 보드.**

제목만으로 버그를 접수하고, 재현 방법과 처리 이력을 한곳에서 관리합니다. 수정이 끝난 버그는 실제 환경에서 다시 확인한 뒤 완료합니다.

[주요 기능](#주요-기능) · [기술 사례](docs/CASE_STUDY.md) · [시연 영상](docs/DEMO.md) · [시작하기](#시작하기)

![ReproBoard — 재현 정보와 처리 상태를 함께 확인하는 버그 보드](docs/evidence/ui-after/board-1440.png)

*합성 데이터로 구성한 실제 앱 화면입니다. [버그 상세](docs/evidence/ui-after/detail-1440.png) · [모바일 화면](docs/evidence/ui-after/detail-390.png)*

## 주요 기능

**접수 → 진행 대기 → 수정 중 → 재검증 → 완료**

- **빠른 접수와 구조화된 재현 정보** — 제목만으로 등록하고 재현 단계·기대 결과·실제 결과·환경을 보완합니다. 부족한 정보를 보여주고, 다음 단계에 필요한 조건을 안내합니다.
- **수정과 재검증을 구분하는 흐름** — 담당자·심각도·우선순위를 정하고 수정 메모와 앱 버전을 남깁니다. 완료에는 현재 버전의 통과 기록이 필요하며, 실패·재오픈 이력도 보존합니다.
- **팀 협업과 접근 권한** — 관리자·멤버·읽기 전용 역할, 일회용 초대, 댓글·팀 멘션·개인 알림을 제공합니다. 다른 팀의 데이터에는 접근할 수 없습니다.
- **작업 맥락을 유지하는 탐색** — 제목·이슈 번호 검색, 분류·담당자 필터, 정렬과 상세 선택을 URL로 공유합니다. 드래그와 키보드 이동 메뉴, 모바일 전체 화면 상세를 지원합니다.

## 핵심 설계

동시 작업과 네트워크 장애에서도 사용자의 변경을 잃지 않는 데 집중했습니다.

| 문제 | 구현 |
|---|---|
| 한 카드의 저장 실패가 다른 카드의 성공까지 되돌리는 문제 | 서버 데이터와 요청별 임시 표시를 분리합니다. 실패한 요청만 복구하고, 응답 유실은 저장 거부와 구분합니다. |
| 두 사용자가 같은 버그를 수정하며 상대의 내용을 덮어쓰는 문제 | DB에서 version을 검사해 한 요청만 성공시킵니다. 충돌한 사용자는 입력을 유지한 채 최신 내용 비교·복사·다시 편집을 선택합니다. |
| 연결이 끊긴 동안 변경을 놓치는 문제 | 실시간 이벤트를 재조회 신호로 사용합니다. 구독 복구 후 최신 데이터를 읽고, 조회 중 발생한 변경도 다시 확인합니다. |

권한·상태 전환 조건·중복 요청 검사는 DB에서도 강제합니다. 변경 내용과 활동·검증 기록은 같은 트랜잭션으로 저장합니다.

[설계 대안과 검증 사례](docs/CASE_STUDY.md) · [아키텍처](docs/ARCHITECTURE.md) · [설계 결정 3건](docs/DECISIONS.md)

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | Next.js App Router · React · TypeScript |
| 상태 관리 | TanStack Query — 서버 데이터 / Zustand — 공유 임시 UI / URL — 검색·필터·상세 |
| 인증·데이터·실시간 | Supabase Auth · PostgreSQL · Row Level Security · Postgres Changes |
| 상호작용 | dnd-kit · 키보드 상태 이동 메뉴 |
| 테스트 | Vitest · Testing Library · Playwright · 실제 로컬 DB/API 테스트 |
| CI | GitHub Actions |

정확한 버전은 [package.json](package.json)과 [lockfile](pnpm-lock.yaml)에 고정되어 있습니다.

## 시작하기

Node **24.19.0**, pnpm **11.19.0**, Linux 컨테이너를 실행하는 **Docker**가 필요합니다. Supabase CLI는 프로젝트에 포함되어 있습니다.

```bash
git clone https://github.com/YouthCorp/reproboard.git
cd reproboard
pnpm install --frozen-lockfile
node scripts/ci-stack.mjs start
pnpm db:migrate
pnpm db:seed
pnpm db:env
pnpm dev
```

[로컬 로그인](http://127.0.0.1:3000/login)에서 **합성 Owner → 개발 계정으로 로그인**을 선택합니다. 로컬 seed는 사용자 4명과 팀 2개를 준비합니다. 위 명령은 로컬 개발용이며 운영 DB에 seed/reset을 실행하지 않습니다.

환경 변수는 [.env.example](.env.example)을 기준으로 `pnpm db:env`가 준비합니다. Windows/WSL 설정, OAuth 등록, DB 타입 생성, 종료 방법은 [개발 안내](docs/DEVELOPMENT.md)를 참고하세요.

## 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:docs
```

규칙·UI 단위 테스트와 실제 Supabase의 권한·경합·중복 요청 검증을 구분합니다. Playwright에서는 서로 다른 사용자 세션으로 동시 수정, 저장 실패, 응답 유실과 재연결을 확인합니다.

전체 DB/E2E 실행 방법은 [개발 안내](docs/DEVELOPMENT.md), 실행 환경·결과·미검증 범위는 [검증 보고서](docs/TEST_REPORT.md)에 있습니다.

## 프로젝트 상태

현재 **v0.1.0 릴리스 후보**이며 로컬 개발 계정으로 실행·시연할 수 있습니다. 공개 호스팅은 제공하지 않으며 GitHub OAuth의 실제 공급자 연동은 검증 전입니다.

초안과 미확정 요청은 새로고침·팀 이탈 후 복원하지 않습니다. 오프라인 쓰기 큐와 자동 필드 병합은 지원하지 않습니다. 상세한 범위와 남은 확인 사항은 [제품 규칙](docs/PRD.md)과 [릴리스 메모](docs/RELEASE_NOTES.md)에 정리했습니다.

## 기여와 라이선스

결함 제보와 수정 절차는 [기여 안내](CONTRIBUTING.md), 보안 문제는 [보안 정책](SECURITY.md)을 확인해 주세요. 작성자의 역할과 Codex 활용 범위는 [기술 사례](docs/CASE_STUDY.md#작업-범위와-역할)에 명시했습니다.

[MIT License](LICENSE). SUIT 폰트 등 외부 자산의 라이선스는 [별도 고지](THIRD_PARTY_NOTICES.md)를 따릅니다.
