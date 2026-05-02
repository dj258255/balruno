# Licensing FAQ — PowerBalance / balruno

PowerBalance 는 디렉토리별로 다른 라이센스로 구성됩니다. 사용자 입장에서 헷갈리지 않게 케이스별로 정리합니다.

> **공식 결정 문서**: `docs/backend/decisions/0005-oss-monetization.md`
> **법적 효력 문구**: 각 디렉토리의 `LICENSE` 파일 (이 문서는 안내용)

---

## 한눈에 보기

| 디렉토리 | 라이센스 | 의미 |
|---|---|---|
| `packages/web/` | **MIT** | Next.js 웹 앱. 자유롭게 fork/임베드/재사용 |
| `packages/shared/` | **MIT** | 공유 코드 (types + 게임 도메인 로직: 수식, 시뮬, 분석). 라이브러리처럼 자유 사용 |
| `packages/desktop/` | **MIT** | Electron 데스크톱 앱. self-build 자유 |
| `packages/backend/` (예정) | **AGPL v3** | 서버 코드. self-host 자유. 단 수정 후 SaaS 로 제공 시 코드 공개 의무 |
| `docs/` (공개분) | **MIT** | 공개 문서. (`docs/backend/`, `docs/archive/` 는 .gitignore 로 비공개 — 내부 설계 노트) |

---

## 케이스별 답변

### Q1. "PowerBalance 를 회사에서 내부 도구로 쓰고 싶어요"

**자유롭게 사용 가능. 비용 0.**
- 사내 인트라넷에 self-host: OK (모든 디렉토리 모두 내부 사용 무제한)
- 코드 수정: OK
- 수정한 코드 공개: 의무 없음 (외부 사용자에게 SaaS 로 제공하지 않는 한)

### Q2. "PowerBalance 를 fork 해서 우리 회사 SaaS 로 출시하고 싶어요"

**조건부 가능 — backend 의 AGPL 의무를 따라야 함.**
- packages/web, packages/shared, packages/desktop (MIT): 자유. fork / 임베드 OK
- packages/backend (AGPL v3): 사용자에게 네트워크로 제공한다면 **수정한 모든 backend 소스코드 공개 의무**
- 의무를 회피하고 싶다면: **상용 라이센스 구매** (dj258255@naver.com 연락)

### Q3. "PowerBalance 의 게임 수식 엔진만 가져다 쓰고 싶어요"

**완전히 자유.**
- 수식 엔진은 `packages/shared/src/lib/formulaEngine.ts` (MIT)
- 게임 함수 라이브러리는 `packages/shared/src/lib/formulas/` (MIT)
- npm 패키지처럼 import 해서 다른 게임 도구 만들어도 OK
- 출처 표기 (LICENSE 파일 포함) 만 지키면 됩니다

### Q4. "PowerBalance UI 컴포넌트를 우리 사이트에 임베드하고 싶어요"

**자유.** packages/web 이 MIT 라 가능. 임베드 / fork / 리브랜딩 OK.

### Q5. "balruno.com 과 똑같은 SaaS 를 차리고 싶어요"

**기술적으로는 가능, 법적으로는 backend AGPL 의무 발생.**
- backend 수정 (또는 그대로) → 사용자에게 SaaS 제공 → 모든 backend 변경사항 공개 의무
- 차별화한 backend 코드를 비공개로 유지하고 싶다면 **상용 라이센스 구매**
- "PowerBalance" / "balruno" 이름과 로고는 **사용 금지** (TRADEMARK.md)

### Q6. "내가 작성한 PR 의 라이센스는?"

**기여한 디렉토리의 라이센스를 따릅니다.**
- `packages/web/` 또는 `packages/shared/` 또는 `packages/desktop/` 에 PR → MIT
- `packages/backend/` 에 PR → AGPL v3
- CLA (Contributor License Agreement) 동의 필요 — PR 시 자동 안내 (CLA Assistant)

### Q7. "balruno 의 Cloud (balruno.com) 는 무료인가요?"

**무료 + Pro 모델.**
- Free: 빡빡 모드 한도 (워크스페이스 3개, 워크스페이스당 프로젝트 5개, 프로젝트당 시트 10개, 사용자당 저장 10MB)
- Pro: 한도 해제 (가격 미정 — 베타 후 결정)
- 어떤 플랜이든 self-host 는 항상 무료. Cloud 는 "운영 편의 + 협업" 에 대한 비용

### Q8. "AGPL 이 무서워서 backend 를 안 쓰고 싶어요"

**옵션:**
1. **자체 백엔드 작성** — packages/web (MIT) 만 가져가서 자기 백엔드와 연결
2. **상용 라이센스 구매** — AGPL 의무 면제 (dj258255@naver.com)
3. **balruno.com Cloud 이용** — 백엔드 직접 안 다룸. 사용료만 지불
4. **수정 안 하고 원본 그대로 self-host** — 이 경우는 AGPL 의무 발생 안 함 (소스 그대로 = 이미 공개된 상태)

### Q9. "데스크톱 앱은 어떻게 받나요?"

- self-build: `packages/desktop/` 에서 `npm run package:mac` (또는 `:win` / `:linux`)
- 정식 배포: GitHub Releases — `v0.x.x` 태그 push 시 자동 빌드 + 배포 (auto-update 동작)

---

## 트레이드마크 (Trademark)

"PowerBalance", "balruno", 로고는 **라이센스와 별개로 보호됩니다**. 자세한 내용은 `TRADEMARK.md` 참조.

요약: 코드는 가져가도 되지만 이름과 로고는 못 씁니다.

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-03 | 최초 작성. ADR 0005 확정에 따른 라이센스 분리 안내 (frontend MIT + backend AGPL v3) |
| 2026-05-03 | Monorepo 변환 반영 — `frontend/` → `packages/web/`. `packages/shared`, `packages/desktop` 추가 (모두 MIT). Q3 의 formulaEngine 경로 갱신. Q9 데스크톱 빌드 추가. |
