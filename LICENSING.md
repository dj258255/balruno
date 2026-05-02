# Licensing FAQ — PowerBalance / balruno

PowerBalance 는 두 라이센스로 구성됩니다. 사용자 입장에서 헷갈리지 않게 케이스별로 정리합니다.

> **공식 결정 문서**: `docs/backend/decisions/0005-oss-monetization.md`
> **법적 효력 문구**: 각 디렉토리의 `LICENSE` 파일 (이 문서는 안내용)

---

## 한눈에 보기

| 디렉토리 | 라이센스 | 비유 |
|---|---|---|
| `frontend/` | **MIT** | "마음대로 써. 출처만 적어줘" |
| `backend/` (예정) | **AGPL v3** | "마음대로 써. 단 우리처럼 SaaS 만들어 팔 거면 네 코드도 공개해" |

---

## 케이스별 답변

### Q1. "PowerBalance 를 회사에서 내부 도구로 쓰고 싶어요"

**자유롭게 사용 가능. 비용 0.**
- 사내 인트라넷에 self-host: OK (frontend MIT + backend AGPL 양쪽 다 내부 사용은 무제한)
- 코드 수정: OK
- 수정한 코드 공개: 의무 없음 (외부 사용자에게 SaaS 로 제공하지 않는 한)

### Q2. "PowerBalance 를 fork 해서 우리 회사 SaaS 로 출시하고 싶어요"

**조건부 가능 — AGPL 의무를 따라야 함.**
- frontend (MIT): 자유. fork / 임베드 OK
- backend (AGPL v3): 사용자에게 네트워크로 제공한다면 **수정한 모든 backend 소스코드 공개 의무**
- 의무를 회피하고 싶다면: **상용 라이센스 구매** (dj258255@naver.com 연락)

### Q3. "PowerBalance 의 게임 수식 엔진만 가져다 쓰고 싶어요"

**완전히 자유.**
- 수식 엔진은 `frontend/src/lib/formulaEngine.ts` (MIT)
- npm 패키지처럼 import 해서 다른 게임 도구 만들어도 OK
- 출처 표기 (LICENSE 파일 포함) 만 지키면 됩니다

### Q4. "PowerBalance UI 컴포넌트를 우리 사이트에 임베드하고 싶어요"

**자유.** frontend 가 MIT 라 가능. 임베드 / fork / 리브랜딩 OK.

### Q5. "balruno.com 과 똑같은 SaaS 를 차리고 싶어요"

**기술적으로는 가능, 법적으로는 backend AGPL 의무 발생.**
- backend 수정 (또는 그대로) → 사용자에게 SaaS 제공 → 모든 backend 변경사항 공개 의무
- 차별화한 backend 코드를 비공개로 유지하고 싶다면 **상용 라이센스 구매**
- "PowerBalance" / "balruno" 이름과 로고는 **사용 금지** (TRADEMARK.md)

### Q6. "내가 작성한 PR 의 라이센스는?"

**기여한 디렉토리의 라이센스를 따릅니다.**
- `frontend/` 에 PR → MIT
- `backend/` 에 PR → AGPL v3
- CLA (Contributor License Agreement) 동의 필요 — PR 시 자동 안내 (CLA Assistant)

### Q7. "balruno 의 Cloud (balruno.com) 는 무료인가요?"

**무료 + Pro 모델.**
- Free: 빡빡 모드 한도 (워크스페이스 3개, 프로젝트 워크스페이스당 5개, 시트 프로젝트당 10개, 저장 10MB)
- Pro: 한도 해제 (가격 미정 — 베타 후 결정)
- 어떤 플랜이든 self-host 는 항상 무료. Cloud 는 "운영 편의 + 협업" 에 대한 비용

### Q8. "AGPL 이 무서워서 backend 를 안 쓰고 싶어요"

**옵션:**
1. **자체 백엔드 작성** — frontend (MIT) 만 가져가서 자기 백엔드와 연결
2. **상용 라이센스 구매** — AGPL 의무 면제 (dj258255@naver.com)
3. **balruno.com Cloud 이용** — 백엔드 직접 안 다룸. 사용료만 지불
4. **수정 안 하고 원본 그대로 self-host** — 이 경우는 AGPL 의무 발생 안 함 (소스 그대로 = 이미 공개된 상태)

---

## 트레이드마크 (Trademark)

"PowerBalance", "balruno", 로고는 **라이센스와 별개로 보호됩니다**. 자세한 내용은 `TRADEMARK.md` 참조.

요약: 코드는 가져가도 되지만 이름과 로고는 못 씁니다.

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-03 | 최초 작성. ADR 0005 확정에 따른 라이센스 분리 안내 (frontend MIT + backend AGPL v3) |
