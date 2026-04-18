# Balruno 기능 감사 — 각 기능은 진짜 괜찮은가

> 작성일: 2026-04-18
> 목적: 현재 제품의 모든 기능을 "실제 유용성 + B2B 준비도 + Open Core 분류"의 3축으로 냉정히 평가
> 결론: **현재 코드베이스 총 20,000줄 중 약 30%는 보석, 40%는 유지 가능, 30%는 삭제 또는 통합 필요**

---

## 감사 기준 (3축 평가)

각 기능에 대해:

1. **실제 유용성** (★1-5): 게임 기획자가 진짜로 자주 쓰는가?
2. **완성도** (A/B/C/D): A=출시 수준, B=베타, C=프로토타입, D=부서짐
3. **B2B 준비도** (○△✕): ○=그대로 됨, △=보완 필요, ✕=B2B에 불필요
4. **Open Core 분류**: Free / Pro / Team / Enterprise / Remove

---

## 1. Core 엔진 (가장 큰 자산)

### 1.1 `formulaEngine.ts` (1,945줄)
- **유용성**: ★★★★★ — 제품의 심장
- **완성도**: B (동작하지만 §8 성능 버그 심각)
- **B2B 준비도**: △ — 성능 수정 후 ○
- **Open Core**: **Free** (핵심, 오픈소스 유지)
- **이슈**:
  - ⚠️ **30초 지연 버그** (`computeCellValue` line 699이 시트 전체 재계산) — Phase 1 즉시 수정
  - 타입 안전성 부족 (`CellValue = string | number | null`)
  - 테스트 0건 — 회귀 위험
- **권고**: 
  - ✅ DAG 기반 증분 재계산으로 리팩터
  - ✅ Vitest로 각 함수 유닛 테스트
  - ✅ Rust/WASM 포팅은 Phase 3까지 연기

### 1.2 70+ 게임 수식 (DPS, TTK, EHP, GACHA_PITY 등)
- **유용성**: ★★★★★ — 경쟁자 대비 차별화
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free** (프리티어 홍보용)
- **권고**: ✅ 확장 계속 — 장르별 수식 더 추가 (`GACHA_EV`, `META_SHIFT` 등)

---

## 2. 시뮬레이션 엔진

### 2.1 `simulation/battleEngine.ts` + `monteCarloSimulator.ts`
- **유용성**: ★★★★
- **완성도**: B
- **B2B 준비도**: △ — Web Worker 오프로드 필요
- **Open Core**: **Pro** (대형 시뮬은 유료)
- **이슈**:
  - 10만 회 시뮬 실행 시 UI 블로킹
  - 파라미터 입력 UX 복잡
- **권고**:
  - ✅ Web Worker로 메인 스레드 분리
  - ✅ 시뮬 결과 저장/비교 기능 추가
  - ✅ Free 한도 1,000회 / Pro 100,000회

### 2.2 `dpsVarianceSimulator.ts` (355줄)
- **유용성**: ★★★★ — 밸런서가 진짜 필요
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free** (기본), **Pro** (대량 시뮬)
- **권고**: ✅ 유지 + Web Worker

### 2.3 `economySimulator.ts` (775줄)
- **유용성**: ★★★ — MMO/가챠 게임 한정
- **완성도**: B
- **B2B 준비도**: △
- **Open Core**: **Pro** (비즈니스 가치 큼)
- **이슈**:
  - Faucet/Sink 개념 기획자 학습 곡선
  - UI 복잡도 극심 (`EconomyPanel.tsx` 827줄)
- **권고**:
  - ⚠️ UX 단순화 필수 (템플릿부터 시작하게)
  - ✅ MMO 스튜디오 타겟 시 킬러 기능

---

## 3. 분석 도구

### 3.1 `balanceAnalysis.ts` (602줄) — Perfect Imbalance
- **유용성**: ★★★ — PvP 게임만 유용
- **완성도**: B
- **B2B 준비도**: △
- **Open Core**: **Pro**
- **이슈**: 
  - 개념 설명 부족 (Nash Equilibrium 처음 보는 기획자 당황)
  - UI에서 결과 해석 어려움
- **권고**: 
  - ✅ 결과 해석 자동 요약 추가
  - ✅ "이게 뭐야?" 버튼으로 개념 설명 팝업

### 3.2 `imbalanceDetector.ts` (469줄) — 9종 패턴 자동 감지
- **유용성**: ★★★★★ — 매우 유용
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free** (기본 3종), **Pro** (전체 9종)
- **권고**: ✅ 대표 기능으로 마케팅. 결과 자동 이메일 리포트 추가

### 3.3 `goalSolver.ts` (444줄) — 역산
- **유용성**: ★★★★ — 실용성 높음
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free**
- **권고**: ✅ 유지. "TTK 목표 입력" UI가 직관적

### 3.4 `curveFitting.ts` (471줄) — 회귀 7종
- **유용성**: ★★★ — 숙련 밸런서만 활용
- **완성도**: A (수학적으로 탄탄)
- **B2B 준비도**: ○
- **Open Core**: **Pro**
- **권고**: 
  - ✅ 유지
  - ⚠️ UI가 점 찍기 중심 → "엑셀 데이터 붙여넣기" 모드 추가 필요

### 3.5 `presetComparison.ts` (501줄)
- **유용성**: ★★★
- **완성도**: B
- **B2B 준비도**: △
- **Open Core**: **Pro**
- **권고**: ✅ 유지

---

## 4. UI — 도구 패널 (16개)

현재 플로팅 패널 16개. **너무 많음**. 통합/삭제 필요.

| 패널 | 줄수 | 유용성 | 권고 |
|---|---:|:---:|---|
| `GrowthCurveChart` | 1,971 | ★★★★ | ✅ 유지 (가장 자주 씀) |
| `DPSVariancePanel` | 851 | ★★★★ | ✅ 유지 |
| `ComparisonChart` | 834 | ★★★★ | ✅ 유지 |
| `EconomyPanel` | 827 | ★★★ | ⚠️ UX 단순화 필요 |
| `CurveFittingPanel` | 802 | ★★★ | ⚠️ "엑셀 붙여넣기" 추가 |
| `BalanceValidator` | 588 | ★★ | ⚠️ `ImbalanceDetector`와 통합 검토 |
| `TemplateSelector` | 586 | ★★★★★ | ✅ 핵심 온보딩 도구 |
| `ImbalanceDetectorPanel` | 512 | ★★★★★ | ✅ 유지 |
| `Calculator` | 432 | ★★★ | 🔀 `FormulaHelper`와 통합 |
| `FormulaHelper` | 403 | ★★★★ | ✅ 유지 (강화 필요) |
| `SheetSelector` | 377 | ★★★ | 🔀 UI에 내장 가능 |
| `SimulationPanel` | 343 | ★★★★ | ✅ 유지 |
| `GoalSolverPanel` | 325 | ★★★★ | ✅ 유지 |
| `FormulaPresetPicker` | 320 | ★★★ | ✅ 유지 |
| `DifficultyCurve` | 257 | ★★★ | 🤔 `GrowthCurveChart`와 통합? |
| `BalanceAnalysisPanel` | 247 | ★★★ | ✅ 유지 |
| `EntityDefinition` | 235 | ★★★★ | ✅ 유지 |

**총 16개 → 12-13개로 축소 권고**. 중복 도구 통합 시 유지보수 비용 크게 감소.

---

## 5. Import / Export

### 5.1 `gameEngineExport.ts` (518줄) + `ExportModal.tsx` (923줄)
- **유용성**: ★★★★★ — 핵심 차별화
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free** (JSON), **Pro** (Unity ScriptableObject, Unreal DataTable, Godot Resource)
- **권고**:
  - ✅ 유지
  - ⚠️ Export 테스트 자동화 (실제 Unity 프로젝트에 임포트되는지 CI에서 검증)
  - ✅ C# enum 타입 감지 로직 개선

### 5.2 `gameEngineImport.ts` (565줄) + `ImportModal.tsx` (664줄)
- **유용성**: ★★★
- **완성도**: B
- **B2B 준비도**: △
- **Open Core**: **Pro**
- **이슈**: 역방향 import는 엣지케이스 많음
- **권고**:
  - ✅ 유지하되 "Unity/Unreal에서 직접 임포트" 부분은 Pro로 게이트

---

## 6. 저장소 & 데이터

### 6.1 `storage.ts` (332줄) — IndexedDB 래퍼
- **유용성**: ★★★★★ — 로컬 우선 핵심
- **완성도**: A
- **B2B 준비도**: ○ (Free 티어용), 서버 저장은 별도 구현 필요
- **Open Core**: **Free**
- **권고**:
  - ✅ 유지
  - ⚠️ 브라우저 IndexedDB 용량 한계 알림 UI 추가 (50MB 초과 시)

### 6.2 `sync/` 모듈 (CloudSyncProvider 등)
- **유용성**: 현재 ★★★ (미래 ★★★★★)
- **완성도**: C — **서버 미구현으로 실제 동작 안 함**
- **B2B 준비도**: ✕ — 추상화만 있고 구현 없음
- **Open Core**: **Pro/Team/Enterprise** (구현 시)
- **이슈**: WebSocket + Operation 전송 코드는 있으나 수신할 서버가 없음
- **권고**:
  - ⚠️ **현재 상태 그대로는 미완성 기능**. 코드는 보존하되 **UI에서 "Cloud" 옵션 숨김** 권고
  - 🔜 Phase 2에서 실제 백엔드 구축 시 부활

### 6.3 `sdk/gameDataClient.ts` + `useGameData.ts` (SDK)
- **유용성**: 현재 ★ (미래 ★★★★)
- **완성도**: C — 스펙만 있음, 실제 백엔드 없음
- **B2B 준비도**: ✕
- **Open Core**: **Enterprise** (별도 SDK 패키지로)
- **이슈**: 
  - REST/WebSocket/Firebase 3종 지원하지만 테스트 불가
  - 현재 제품과 통합 안 됨 (독립된 파일로만 존재)
- **권고**:
  - 🗑 **현재 상태로는 죽은 코드**. 삭제 또는 archived 폴더로 이동
  - 🔜 Enterprise 티어 SDK 개발 시 재작성

---

## 7. 템플릿 & 샘플

### 7.1 `templates/` (10개 파일, 약 597줄)
- **유용성**: ★★★★★ — 온보딩 필수
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free**
- **장르**: RPG, Action, FPS, Strategy, Idle, Roguelike, MOBA, Card, Puzzle, Simulation
- **카테고리**: Config, Character, Equipment, Skill, Enemy, Unit, Item, Card, Stage, Progression, Economy, Gacha, Reward, Analysis
- **권고**:
  - ✅ 유지 + 지속 확장 (장르별 5-10 템플릿)
  - ⚠️ 실제 게임 베이스 템플릿 추가 (예: "Dota2 스타일", "원신 스타일")
  - ✅ 유료 티어에 "고급 장르별 플레이북" 묶음 판매 가능

### 7.2 `data/sampleProjects.ts` — 샘플 프로젝트
- **유용성**: ★★★★
- **완성도**: A
- **권고**: ✅ 유지

---

## 8. UX 시스템

### 8.1 Tour 시스템 (`components/tour/` + `hooks/useTour.ts`)
- **유용성**: ★★★★ — 신규 유저 필수
- **완성도**: B
- **B2B 준비도**: △
- **Open Core**: **Free**
- **권고**:
  - ✅ 역할별 투어 추가 (기획자/PD/개발자)
  - ✅ B2B 데모 시 결정적 UX

### 8.2 `OnboardingGuide.tsx` (685줄)
- **유용성**: ★★★
- **완성도**: B
- **권고**:
  - ⚠️ Tour 시스템과 기능 중복 — 통합 필요
  - 🔀 둘을 합쳐 단일 온보딩 플로우로

### 8.3 i18n (`next-intl`, EN/KO)
- **유용성**: ★★★★★ — 글로벌 필수
- **완성도**: A
- **B2B 준비도**: ○
- **Open Core**: **Free**
- **권고**:
  - ✅ 유지
  - ⚠️ 일본어 추가 (게임 대국)
  - ⚠️ 중국어 간체 추가 (최대 시장)

### 8.4 Undo/Redo (`useHistory.ts` + `historyStore.ts`)
- **유용성**: ★★★★★
- **완성도**: A
- **권고**: ✅ 유지

### 8.5 모바일 반응형
- **유용성**: ★★ — 스프레드시트 편집을 모바일에서 하나?
- **완성도**: B
- **권고**:
  - 🤔 **재검토**: B2B 게임 기획자는 데스크톱 전용. 모바일 지원은 **읽기 전용**으로 축소해도 됨
  - 💰 개발/유지보수 비용 상당
  - ⚠️ 간단 모드 (대시보드 뷰만 모바일 대응) 권고

---

## 9. 현재 없지만 B2B에 필요한 기능

우선순위 순서:

### P0 (6개월 내 필수)
1. **실시간 성능 개선** — 30초 지연 해결 (DAG 엔진)
2. **사용자 계정 + 인증** — 현재 로컬 전용, B2B는 불가
3. **공유 워크스페이스** — 최소 2-3인 동시 접속
4. **변경 히스토리 UI** — 현재 Undo만, 감사용 아님
5. **기본 댓글 (행 단위)** — 비동기 협업
6. **Git Backup 자동화** — 주기적 커밋

### P1 (12개월 내)
7. **상태 컬럼** — monday 스타일
8. **Webhook (GitHub/GitLab)** — 양방향 동기화
9. **감사 로그** — 누가 언제 무엇을
10. **대시보드 위젯** — 디렉터용 KPI 뷰
11. **스냅샷 + 시계열 통계** — 월/년별 트렌드

### P2 (18개월 내)
12. **SSO (SAML/OIDC)** — 엔터프라이즈 필수
13. **RBAC (역할 권한)** — 기획자/PD/개발자 분리
14. **SLA 모니터링** — uptime 공개
15. **실시간 멀티플레이어** — Yjs CRDT (수요 검증 후)
16. **Automation Center** — no-code 규칙

### P3 (필요 시)
17. **Perforce 연동** — 한국 대형 스튜디오
18. **AI 어시스턴트** — 수식 생성, 밸런스 추천
19. **Mobile 네이티브 앱** — 읽기 전용
20. **Enterprise 감사 보고서 자동 생성**

---

## 10. 전체 코드베이스 평가

### 강점
- ✅ **도메인 전문성**: 70+ 게임 함수는 진짜 자산
- ✅ **핵심 엔진 견고**: mathjs 기반 수식 엔진은 확장 가능
- ✅ **온보딩 투자**: Tour + Templates + Sample Projects 3종 세트
- ✅ **엔진 중립 Export**: Unity/Unreal/Godot 모두 지원은 차별화
- ✅ **i18n 구축**: EN/KO 이미 완료
- ✅ **모던 스택**: Next.js 16 + React 19 + TypeScript

### 약점
- ❌ **성능 병목** (`formulaEngine.ts:699`)
- ❌ **테스트 0건** — 회귀 보호 없음
- ❌ **죽은 코드**: sync/ 와 sdk/ 가 서버 없이 존재
- ❌ **과잉 기능**: 16개 패널은 너무 많음
- ❌ **B2B 기본 부재**: 계정/팀/권한 하나도 없음
- ❌ **macOS 중복 파일 흔적**: 방금 정리했지만 개발 환경 재점검 필요
- ❌ **문서화 부족**: API 문서, 컴포넌트 스토리북 없음

### 점수표

| 영역 | 현재 | Phase 1 후 목표 | Phase 2 후 목표 |
|---|:---:|:---:|:---:|
| 엔진 성능 | D | A | A |
| 핵심 기능 | B+ | A | A |
| UX 완성도 | B | B+ | A |
| B2B 준비도 | D | C | B+ |
| 테스트 | F | C | B |
| 문서화 | D | C | B |
| 국제화 | B | B+ | A |

**현재 총평**: B급 개인 프로젝트. B2B 전환 시 상당한 리팩터 + 신규 기능 개발 필요.
**Phase 1 후**: 유료 판매 가능한 Pro 제품 수준.
**Phase 2 후**: 소규모 Team 라이선스 판매 가능.

---

## 11. 즉시 실행 권고 (우선순위)

### 🔴 Critical (1-2주)
1. `formulaEngine.ts:699` 성능 버그 수정 (DAG 증분 재계산)
2. `sync/` 와 `sdk/` 를 `archive/` 폴더로 이동 (죽은 코드 제거)
3. 기본 테스트 Suite 구축 (Vitest, 수식 함수 70개)

### 🟡 Important (1개월)
4. `Calculator` + `FormulaHelper` 통합
5. `BalanceValidator` + `ImbalanceDetectorPanel` 통합 검토
6. `OnboardingGuide` + Tour 통합
7. Export 자동 테스트 (Unity 프로젝트에 실제 임포트되는지)
8. 일본어/중국어 i18n 추가

### 🟢 Nice to have (3개월)
9. IndexedDB 용량 한계 UX
10. 모바일 지원 축소 (읽기 전용으로)
11. Storybook 컴포넌트 카탈로그
12. 공식 API 문서 (Docusaurus)

---

## 12. Open Core 티어별 기능 매핑 (최종)

### Free (MIT 오픈소스)
- 전체 수식 엔진 (70+ 함수)
- 스프레드시트 UI (Grid View)
- 로컬 저장 (IndexedDB)
- Export: JSON, CSV
- Monte Carlo (1,000회 한도)
- 기본 분석: `imbalanceDetector` 3종
- 템플릿 + 샘플 프로젝트
- Tour + Onboarding
- i18n
- 자체 Git 백업 (사용자 토큰)

### Pro ($9/유저/월)
- 클라우드 저장
- 버전 히스토리 UI (90일)
- 2-3인 공유 워크스페이스
- 행 단위 댓글
- Monte Carlo (100,000회)
- 전체 분석 도구 9종
- Export: Unity/Unreal/Godot 코드
- `economySimulator` 전체
- `curveFitting` 전체
- `presetComparison`
- 이메일 알림
- 이메일 지원 48시간

### Team ($29/유저/월)
- 무제한 워크스페이스
- 상태 컬럼 + 칸반/간트 뷰
- 팀 대시보드 위젯
- GitHub/GitLab Webhook 양방향
- 기본 감사 로그
- Slack/팀즈 알림
- Import: Unity/Unreal 역방향

### Enterprise (연 $15-50K)
- 온프렘 정식 지원 + 설치
- SSO (SAML/OIDC)
- RBAC
- 상세 감사 로그 + SIEM
- 실시간 멀티플레이어 (Yjs)
- 24/7 지원 + 99.9% SLA
- 커스텀 수식 개발
- K-ISMS/SOC 2 컴플라이언스
- 전담 Customer Success Manager
- 교육 세션 (팀 온보딩 포함)

---

## 부록 A. 감사 결과 한 장 요약

| 질문 | 답 |
|---|---|
| 제품이 지금 B2B 팔 수 있나? | ❌ 아니요. 최소 6개월 Phase 1 필요 |
| 현재 코드 중 몇 %가 재사용? | 약 70% |
| 삭제해야 할 코드? | `sync/`, `sdk/` 약 3,000줄 |
| 최우선 수정? | `formulaEngine.ts:699` 성능 버그 |
| B2B 차별화 가능 기능? | 70+ 게임 수식 + Export 엔진 중립성 |
| 없어서 치명적인 것? | 인증, 팀, 권한, 감사, 댓글 |
| 현재 수준 가격 매길 수 있다면? | Free Indie 제품 수준 |
| 얼마나 걸려야 Pro $9 되나? | 3-4개월 (Phase 1) |
| 얼마나 걸려야 Enterprise 되나? | 18-24개월 (Phase 3) |

---

*이 감사는 2026-04-18 기준. 코드 변경 시 재감사 필요.*
