# 기여 안내

ReproBoard는 v0.1.0 릴리스 후보이며 D10 이후 신규 기능을 동결했다. 현재는 재현 가능한 결함·접근성·문서 불일치 수정에 집중한다. 제품 조건은 [PRD](docs/PRD.md), 상태 소유권과 DB 계약은 [ARCHITECTURE](docs/ARCHITECTURE.md)를 먼저 읽는다.

## 개발 환경

Node 24.19.0·pnpm 11.19.0을 사용하고 lockfile을 유지한다. [개발 안내](docs/DEVELOPMENT.md)의 설치→로컬 Docker/Supabase→migration→seed→환경 변수→개발 서버 순서를 따른다. `.env.example`에는 예시만 넣는다. 계정·실제 비밀 값·Auth storageState·원시 테스트 로그는 커밋하지 않는다.

기존 변경을 먼저 확인하고 보존한다. DB 수정은 새 migration으로 남기며 hosted DB reset은 사용하지 않는다. 테스트 fixture는 실행 UUID로 구분한 로컬 사용자/팀만 정리한다. 타입 변경은 `pnpm db:types`로 생성하고 diff를 검토한다.

## 변경과 검증

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:local-tools
pnpm test:docs
```

권한/명령/상태 변경은 `pnpm test:integration:db`, 협업/화면 변경은 `pnpm test:integration:ui`, production 영향은 `pnpm build`와 `pnpm test:e2e`를 실행한다. 상세한 전제·포트·격리는 개발 안내를 따른다. 단순 문서 변경은 문서 검사와 관련 정적 검사로 범위를 정하고 이전 앱 테스트의 실행 날짜를 유지한다. CI 구성은 있지만 원격 실행 결과는 아직 없다.

테스트를 삭제·skip하거나 assertion을 약화해 실패를 숨기지 않는다. PASS/FAIL/NOT_RUN, 환경, 재현 절차를 구분한다. 장애 주입은 테스트 전용이어야 하며 서비스 키로 사용자 동작을 대체하지 않는다. UI 수정은 키보드 대안·포커스·긴 한국어·390/768/1440px를 확인한다.

## 변경 설명

브랜치를 만들면 `codex/` 접두사를 사용한다. 변경 설명은 문제와 최종 동작, 영향받는 규칙, 실행한 검증과 미실행 이유, 필요한 캡처를 포함한다. 작업 대화 전체를 공개 문서에 복사하지 않는다. PROGRESS는 단계당 5~10줄, 중요한 설계 결정은 기존 ADR 3건에 연결한다.

서버 데이터는 Query, 공유 임시 요청 상태는 Zustand, 검색·필터·정렬·상세는 URL이 소유한다. DB의 권한·version·멱등성·상태 조건을 UI 편의 때문에 완화하지 않는다. 사용자 승인 없는 공개 게시·운영 변경은 수행하지 않는다.

보안 문제는 공개 이슈에 비밀 값이나 악용 절차를 올리지 말고 [SECURITY](SECURITY.md)를 따른다. 현재 비공개 신고 채널은 개설 전이다. 기여 시 [MIT](LICENSE)와 [외부 자산 고지](THIRD_PARTY_NOTICES.md)를 보존하고 출처가 있는 자산은 원래 라이선스를 함께 남긴다.
