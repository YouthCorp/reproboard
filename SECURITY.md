# 보안 정책

현재는 **v0.1.0 릴리스 후보**이며 공개 서비스·지원 중인 운영 버전이 없다. 이 문서는 구현 경계와 공개 전 조건을 설명한다. 침투 테스트나 독립 보안 심사 완료를 의미하지 않는다.

## 취약점 신고

현재 Git 원격과 비공개 보안 신고 채널이 설정되지 않았다. 따라서 동작하지 않는 신고 링크나 개인 연락처를 제공하지 않는다. **공개 이슈·댓글에 secret, 실제 사용자 데이터, 재현용 계정, 악용 가능한 상세 내용을 올리지 않는다.** 저장소 공개 전에 관리자가 아래 채널을 개설하고 실제 접수 가능 여부를 확인해야 한다.

GitHub 저장소의 Settings → Security and quality → Advanced Security에서 Private vulnerability reporting을 활성화한다. 이후 Security → Advisories → Report a vulnerability의 접근을 확인하고 이 문서에 실제 신고 경로를 연결한다. 정확한 설정 위치는 [GitHub 공식 안내](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)를 따른다. 현재 접수 응답 시간이나 지원 SLA를 약속하지 않는다.

채널 개설 후 신고에는 영향 범위·최소 재현 절차·사용 버전을 포함하되 비밀 값과 개인정보는 제거한다. 수정/공개 일정은 신고자와 관리자가 해당 비공개 채널에서 조율한다.

## 현재 방어 경계

- 사용자 Auth 세션·RLS/grant로 팀 조회를 제한한다. 직접 table 쓰기는 차단하고 RPC에서 auth.uid·현재 멤버십·허용 필드·같은 팀 참조를 검사한다.
- SECURITY DEFINER 함수는 스키마를 한정하고 search_path/execute 권한을 제한한다. Owner를 임의 지정하거나 Owner를 자가 강등하는 경로를 제공하지 않는다.
- expectedVersion·requestId 검사와 실제 변경/활동/receipt 원자성을 DB에서 강제한다. 초대는 24시간·1회·Member 고정·서버 해시 저장이다.
- 댓글은 일반 텍스트로 렌더링한다. 알림은 현재 팀에 속한 수신자만 조회·읽음 처리한다. 프로필은 같은 팀 표시 정보만 제공한다.
- 개발 로그인은 development+명시적 플래그+로컬 Supabase 조건으로 제한한다. production 앱에 service role/OAuth secret/장애 주입 도구를 넣지 않는다.
- seed/reset/통합 fixture는 loopback과 해당 프로젝트 컨테이너를 검사한 로컬 DB만 대상으로 한다. 일반 사용자 동작을 관리자 키로 대신하지 않는다.

실제 테스트 범위와 남은 검증은 [TEST_REPORT](docs/TEST_REPORT.md), 외부 설정은 [DEVELOPMENT](docs/DEVELOPMENT.md)를 따른다.

## 배포 전 필수 확인과 한계

OAuth App과 Supabase redirect URL을 환경별로 분리하고 실제 성공·취소·로그아웃을 확인한다. 배포 대상의 migration/RLS/grant/publication, 일반 사용자·Viewer·타팀 접근, production 개발 도구 미노출을 검사한다. 환경 변수는 빌드 전에 대상 환경과 일치시킨다. 공유 관리자 계정이나 RLS 해제로 데모를 제공하지 않는다.

비밀 값이 노출됐다면 출력/공유를 중단하고 소유자가 해당 자격 증명을 폐기·교체한 뒤 영향과 기록 노출 범위를 확인한다. Git 이력에서 파일만 지우는 것으로 키 폐기를 대신하지 않는다.

현재 미검증: 실제 OAuth 공급자, hosted 배포, 운영 백업/복구·모니터링·장기 보존·독립 보안 감사. request receipt 정리 정책과 reload 후 미확정 요청 복원도 없다. 로컬 테스트 PASS를 운영 안전 보장으로 해석하지 않는다.
