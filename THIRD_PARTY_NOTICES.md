# 외부 자산과 의존성 라이선스

2026-09-27 저장소·설치된 고정 버전의 package.json·동봉 라이선스를 대조했다. 원본 코드/문서의 [MIT LICENSE](LICENSE)는 `Copyright (c) 2026 ReproBoard contributors`다. 최초 저장소의 집합 저작권 표기를 보존했으며 개인의 법적 실명으로 추정해 바꾸지 않았다. package.json에도 MIT를 명시했다. Codex 활용 범위는 [사례 연구](docs/CASE_STUDY.md)에 공개한다.

## 배포에 포함하는 자산

| 자산 | 출처·버전 | 라이선스·보존 |
|---|---|---|
| `public/fonts/SUIT-Variable.woff2` (625,480 bytes) | [SUIT v2.0.1](https://github.com/sun-typeface/SUIT/releases/tag/v2.0.1), 원본 파일 | Copyright 2022 SUNN, Reserved Font Name SUIT. SIL OFL 1.1 [동봉 전문](public/fonts/SUIT-LICENSE.txt)·[공식 전문](https://github.com/sun-typeface/SUIT/blob/v2.0.1/LICENSE) |
| ReproBoard SVG 심볼·UI 코드 | 이 저장소에서 작성, 외부 아이콘/사진 팩 미사용 | 원본 MIT |
| `docs/evidence` 화면·영상 | 합성 데이터의 실제 로컬 앱 실행 | 원본 프로젝트 증빙. 실제 고객/외부 사용자 연구 자료가 아님 |

SUIT SHA-256: `db2759b2be68ef40651f5007208fafe7eb89e8737cfd57809f49ce2b90d786c6`.

폰트 비교 캡처의 Pretendard 1.3.9는 [OFL 1.1 프로젝트](https://github.com/orioncactus/pretendard)이며 폰트 바이너리를 배포하지 않는다. 맑은 고딕은 Windows에 설치된 시스템 폰트를 비교에 사용했으며 바이너리를 포함하지 않는다. 최종 앱의 외부 폰트 네트워크 요청은 없다. 제3자 서체의 권리가 원본 MIT로 바뀌는 것은 아니다.

[설치된 버전·라이선스·폰트 해시 대조 결과](docs/evidence/d14-licenses.json)

## 직접 의존성 28개

아래는 설치된 직접 의존성의 고정 버전/라이선스 대조 결과다. 전체 전이 의존성의 독립 법률 심사를 의미하지 않는다. 배포 형식에 따라 node_modules에 포함된 각 패키지의 LICENSE/NOTICE를 함께 보존한다. 버전 변경 시 lockfile과 실제 패키지 고지를 다시 확인한다.

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| @dnd-kit/core | 6.3.1 | MIT |
| @supabase/ssr | 0.12.7 | MIT |
| @supabase/supabase-js | 2.116.0 | MIT |
| @tanstack/react-query | 5.102.8 | MIT |
| next | 16.3.5 | MIT |
| react / react-dom | 19.3.0 | MIT |
| zustand | 5.0.15 | MIT |
| @eslint/js | 10.0.1 | MIT |
| @next/eslint-plugin-next | 16.3.5 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| @testing-library/dom | 10.4.1 | MIT |
| @testing-library/jest-dom | 7.0.1 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @testing-library/user-event | 14.6.7 | MIT |
| @types/node | 24.10.1 | MIT |
| @types/react / @types/react-dom | 19.3.0 | MIT |
| @vitejs/plugin-react | 6.1.1 | MIT |
| eslint | 10.10.0 | MIT |
| eslint-plugin-react-hooks | 7.1.1 | MIT |
| jsdom | 30.0.1 | MIT |
| pg | 8.23.0 | MIT |
| supabase | 2.117.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| typescript-eslint | 8.70.0 | MIT |
| vite | 8.3.0 | MIT |
| vitest | 5.0.0 | MIT |

Node/pnpm/Docker/브라우저 등 개발 실행 도구는 이 저장소가 재배포하는 자산이 아니다. [MIT 공식 문구](https://opensource.org/license/mit)와 저장소 전문을 대조했으며 저작권·허가·면책 조항을 보존한다.
