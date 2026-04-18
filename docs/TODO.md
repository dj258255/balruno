# Balruno 전체 할 일

> **최종 업데이트**: 2026-04-18 (Yjs-first + 백엔드 확정 + AI 최후 반영)
> **원칙**: 시간·비용 고려 없이 **기술적으로 올바른 것** 기준으로 정리. 의존성 순서만 지키면 됨.
> **방향**: 프론트 + 백엔드 둘 다 진행. AI는 모든 트랙 완료 후 맨 마지막에 얹음.
> **문서 3분할**: 전체(이 문서) · [프론트](./TODO_FRONTEND.md) · [백엔드](./TODO_BACKEND.md)

---

## 1. 제품 정체성

**"Airtable for Game Designers"** — 게임 기획자를 위한 에어테이블.

### 해자 (경쟁자가 동시에 못 주는 조합)
1. 게임 수식 내장 70+ (DPS/TTK/EHP/GACHA_PITY 등)
2. Monte Carlo · DPS 분산 · 이코노미 시뮬레이션
3. Unity / Unreal / Godot 자동 Export (엔진 중립)
4. 장르별 템플릿 (RPG/FPS/Idle/Roguelike/MOBA)
5. 게임 도메인 용어 (Character/Weapon/Stage/Skill)
6. 로컬 우선 + 오프라인 완전 지원

### 경쟁자 대비 위치
- vs **Airtable**: 게임 수식/시뮬/엔진 Export 없음 → Balruno 우위
- vs **Machinations**: 노드 패러다임, 진입 장벽 높음 → 다른 유저층 (스프레드 친숙자)
- vs **Balancy**: Unity 락인 → Balruno 엔진 중립 우위
- vs **Notion**: 너무 느슨한 DB, 게임 특화 0
- vs **Linear**: 다른 도메인 (이슈 트래커)

### 2차 포지셔닝 (B2B 영업 시)
"게임 밸런스 데이터를 입력·시뮬·통계까지 온프렘 한 곳에서 처리하는 Open Core 플랫폼"

---

## 2. 현재 상태

### 배포
- **프로덕션**: https://www.balruno.com (Cloudflare + Vercel)
- **레포**: github.com/dj258255/balruno (MIT)
- **기본 URL**: indiebalancing.vercel.app (보조)

### 완료된 것 (2026-04-18 ~ 04-19)

#### 기반 정리 (Pre-Track 0)
1. ✅ `formulaEngine` O(N²) 버그 수정 (WeakMap 캐시, 29 테스트)
2. ✅ `sync/`, `sdk/` 죽은 코드 제거
3. ✅ 브랜드 통일 (balruno.com + GitHub + Vercel + LICENSE)
4. ✅ 정체성 프레이밍: "Airtable for Game Designers"
5. ✅ `formulaEngine` 카테고리 분리 (1,970 → 1,418줄, `lib/formulas/` 6파일)
6. ✅ `projectStore` 슬라이스 분해 (1,259 → 208줄, `stores/slices/` 4파일)
7. ✅ ErrorBoundary 2단 (`app/error.tsx` + `global-error.tsx`)
8. ✅ 접근성 `aria-*` 31개
9. ✅ 중복 파일 10개 정리

#### Track 0 — Yjs 마이그레이션 (완료)
10. 🔥 **Track 0 완료** — Phase 1+2+3+4
    - `ydoc.ts` 27 helper (Sheet/Column/Row/Cell/Sticker/Folder)
    - 모든 slice write → Y.Doc 경유 (observer → Zustand sync)
    - `Y.UndoManager` 로 `historyStore` 교체 (500ms merge)
    - `y-indexeddb` persist + 자동 마이그레이션

#### Track 5~8B — 독립 트랙 (완료/부분)
11. ✅ **Track 5 완료** — ⌘K Command Palette (`cmdk`, 5 카테고리)
12. ✅ **Track 6 완료** — 도킹 레이아웃 (17→9 그룹, 우측 `DockedToolbox` 420px)
13. ✅ **Track 6-후속** — 하단 독바 9 그룹 통일 (`BottomDock`, macOS style)
14. ✅ **Track 7 완료** — Import 자동 진단 + WelcomeScreen Excel 카드
15. ✅ **Track 8B Infra** — y-webrtc P2P 협업 `attachWebrtc` / `detachWebrtc` helper

#### Track 1~4 — MVP 수준 (확장 필요)
16. 🟡 **Track 1 MVP** — Field 타입 7종 (checkbox/select/multiSelect/date/url/currency/rating)
    - 표시 포맷 + ColumnModal 설정 UI 완료
    - **남음**: 타입별 전용 CellEditor (checkbox 클릭 토글, rating 별 클릭, date picker 인라인)
17. 🟡 **Track 2 MVP** — Linked Records (단방향)
    - `link` 컬럼 + 대상 시트/표시 컬럼 선택 + 다중 참조
    - **남음**: 양방향 자동 미러링, 레코드 피커 UI (현재는 rowId 텍스트 입력)
18. 🟡 **Track 3 MVP** — Lookup / Rollup
    - SUM/AVG/MIN/MAX/COUNT/CONCAT 집계
    - **남음**: 순환 참조 방지, 수식 엔진 traversal 문법 통합
19. 🟡 **Track 4 MVP** — 6 뷰 전부
    - Grid (기존), Form (완성), Kanban (드래그), Calendar (월 뷰), Gallery (카드), Gantt (타임라인)
    - **남음**: 각 뷰 고급 기능 (아래 "MVP 상태 매트릭스" 참조)
    - **근본 한계**: 시트당 단일 `activeView`. Airtable 처럼 "뷰 여러 개 저장" X

#### Track 9~11 — Scaffold (타입만)
20. 🟠 **Track 9 Scaffold** — `types/interface.ts` (Widget/Interface 타입). UI 구현 X
21. 🟠 **Track 10 Scaffold** — `types/automation.ts` (Trigger/Condition/Action 타입). 런타임 엔진/에디터 X
22. 🟠 **Track 11 Scaffold** — `/api/ai/formula` Route Handler (501 stub). 실제 LLM 호출 X

#### UX 개선
23. ✅ `SidebarResizer` + `DockedToolbox` 크기 조절 일관성 (1.5px bar + pointer events)

---

## 2.4. 비관적 현황 분석 (2026-04-19)

**낙관적 평가만 하면 자기기만**. 반대 관점에서 본 Balruno 상태:

### 기능 완성도 (실사용 가능한가?)
| 영역 | 실제 상태 | 실사용 가능? |
|---|---|---|
| Grid 뷰 | 완성 (기존 자산) | ✅ 가능 |
| 70+ 게임 수식 | 완성 | ✅ 가능 |
| 엔진 Export | 완성 | ✅ 가능 |
| Field 타입 (Track 1) | 표시 포맷 + 전용 CellEditor | 🟡 **select 는 드롭다운 O, date picker O, checkbox/rating 토글 O — 실사용 가능** |
| Linked Records (Track 2) | 양방향 미러링 구현 | ❌ **레코드 피커 UI 없음 → 사용자가 rowId 직접 입력해야 함 = 비현실적** |
| Lookup/Rollup (Track 3) | 집계 O | ✅ 가능 (Track 2 가능 조건 하에) |
| Kanban 카드 편집 | 사이드 패널 O | ✅ 가능 |
| Calendar 월 뷰 | O, 이벤트 클릭 편집 O | 🟡 주/일 뷰 없음, 드래그로 날짜 변경 없음 — 간단한 일정에만 |
| Gallery | 카드 그리드 O | 🟡 attachment 없음, url 기반 이미지만 |
| Gantt | 단일 막대 | 🟡 range/의존성 없음 → **실무 Gantt 기능 아님, 사실상 placeholder** |
| Y.Doc 실시간 sync | 로컬 IndexedDB | 🟡 WebRTC infra 있지만 UI 미통합 |
| AI Auto-Balancer (Track 11) | API stub (501) | ❌ **동작 안 함** |
| Interface Designer (Track 9) | 타입 정의만 | ❌ **UI 없음** |
| Automations (Track 10) | 타입 정의만 | ❌ **UI 없음** |

### 경쟁 대비 냉정한 비교
| 지표 | Balruno (현재) | Airtable | Helika | PlayFab |
|---|---|---|---|---|
| 개발 기간 | 약 2-3 주 | 10+ 년 | 2+ 년 | 10+ 년 |
| 팀 사이즈 | 1인 | 수백 명 | 30+ 명 ($8M) | MS 인수 (수백 명) |
| 유료 사용자 | 0 | 10만+ | 스튜디오 수십 | 10만+ 개발자 |
| 기능 완성도 | MVP (약 25%) | 완성형 | 완성형 | 완성형 |
| 마케팅 예산 | 0 | $수백M | $수백만 | MS 백업 |

**현실**: Balruno 는 **경쟁 제품의 프로덕션 수준 대비 25-35% 완성도**. "Airtable 처럼 보이지만 Airtable 은 아님".

### 구조적 리스크
1. **1인 개발 한계**: 게임사 파트너십/세일즈 인프라 없음 → B2B 영업 불가
2. **출시 전 상태**: 실사용자 0명 → PMF 검증 전
3. **AI 경쟁사 속도**: Helika $8M 투자받음, Xsolla 이미 LiveOps 출시 → **"블루오션" 이 이미 닫히는 중**
4. **게임사 도입 장벽**: 엔터프라이즈 영업 = 보통 6-12개월 사이클
5. **브라우저 검증 부족**: 21+ 커밋이 실사용 검증 없이 main 에 올라감 — 숨은 버그 다수 존재 가능성
6. **테스트 범위**: 42 테스트 중 대부분 formulaEngine/ydoc.ts unit. 통합 테스트 / E2E 없음

### 이 비관 분석이 의미하는 것
- **"다 만들면 된다"는 판타지** — 경쟁 제품 완성도 = 10년 + 수십억 투자 결과
- **실제 전략**: 게임 기획자 **니치 3-5명 얼리 어답터** 확보 → 피드백 기반 개선 → B2B 파트너십 →...
- **지금 우선순위**: 기능 70% 완성보다 **10명 사용자 찾기** 가 더 중요

---

## 2.5. 현재 MVP 상태 매트릭스 (Airtable/경쟁 제품 대비)

| 트랙 / 뷰 | MVP 포함 | **남은 고급 기능** | 경쟁 제품 기준 |
|---|---|---|---|
| Track 1 Field | 타입 9종, 표시 포맷, 설정 UI | 타입별 CellEditor (checkbox 토글/rating 클릭/date picker) | Airtable 20종 필드 |
| Track 2 Link | 단방향, 표시 컬럼, 다중 참조 | 양방향 자동 미러링, 레코드 피커 UI | Airtable 표준 |
| Track 3 Lookup/Rollup | 6 집계 함수 | 순환 참조 방지, 수식 traversal | Airtable 표준 |
| **Track 4 Grid** | 완성 (기존 자산) | — | — |
| **Track 4 Form** | Field 타입 반영, submit | — | — |
| **Track 4 Kanban** | select 그룹, 드래그 | 카드 편집 사이드 패널, 커버 이미지, 필드 표시 토글, 색상 | Airtable/Trello |
| **Track 4 Calendar** | 월 뷰, 이전/다음/오늘 | 주/일 뷰, 드래그로 날짜 변경, start+end range | Airtable/Notion |
| **Track 4 Gallery** | 카드 그리드, url→이미지 | attachment 필드 (Track 1 확장), 카드 크기 조절 | Airtable |
| **Track 4 Gantt** | 수평 단일 막대 | start+end range, 의존성 선, 드래그 재스케줄 | SVAR Gantt, MS Project |
| Track 8B | y-webrtc infra | Presence/Cursor UI, 4+명 뱃지, SettingsModal 공유 버튼 | Figma/Linear |
| Track 9 | 타입만 | 위젯 11종 + react-grid-layout + 편집기 | Airtable Interface Designer |
| Track 10 | 타입만 | 노드 그래프 에디터 + 런타임 엔진 + 실행 로그 | Zapier/n8n |
| Track 11 | API stub | 5단계 validator 파이프라인, 실제 LLM 호출, NL→수식/쿼리/대시보드 | ChatGPT Advanced + Airtable Omni |

---

## 2.45. UX/UI 전면 재설계 필요한가? (2026-04-19)

**결론: 전면 재설계 ❌, 부분 "첫인상 폴리시" ⭕**

### 현재 UI 상태 진단
✅ **기본 뼈대 OK**:
- CSS 변수 기반 디자인 시스템 (light/dark 모드)
- Tailwind + 반응형 (단 우측 도킹은 모바일 숨김)
- 모바일 터치 타겟 44px (Apple HIG 준수)
- 좌 Sidebar / 중 Sheet / 우 DockedToolbox / 하 BottomDock 4-zone 레이아웃
- macOS-style 독바 (hover scale, accent indicator)
- 일관된 border/shadow 토큰

🟡 **완성도 부족 (MVP 수준)**:
- 각 뷰 empty state 디자인 기본 ("표시할 레코드가 없습니다" 단순 텍스트)
- 온보딩 부족 → 새 사용자가 "어디서 뭐부터?" 불명확
- 애니메이션 최소 (scaleIn 정도만, 마이크로 인터랙션 부족)
- 에러 메시지 UI 기본 (inline 빨간 텍스트)
- 비게임 기획자에게 도메인 난해 (수식 목록 70개 = 압도적)
- Kanban 카드/Calendar 이벤트 등 **"비어 보임"** (게임 기획자가 느끼는 첫인상: "뭔가 허전")

❌ **구조적 약점**:
- 각 뷰가 내부 상태 독립 → 뷰 전환 시 검색/필터/선택 리셋
- 키보드 단축키 문서화 부족 (Cmd+K 외)
- 다국어 지원되지만 한국 게임 용어 정확도 미검증
- 접근성 (a11y) aria-label 31개 → 부족 (Airtable 은 수백 개)

### 전면 재설계 불필요 이유
1. **기능이 먼저 안정화되어야** — UI 재설계 2번 손대면 작업 2배
2. **현재 뼈대가 올바른 방향** — Airtable/Linear/Notion 패턴 따름
3. **사용자 피드백 전** — 뭐가 진짜 문제인지 모름. 가정 기반 재설계 = 낭비

### 최소 "첫인상 개선" 권장 (UX 리프레시)
**목표**: 테스트 유저 5-10명이 "계속 써볼 만하다" 느끼게 만들기

| 작업 | 효과 | 규모 |
|---|---|---|
| **온보딩 투어 개선** — 샘플 프로젝트 자동 열기 → 주요 기능 3-5 스텝 가이드 | 첫 경험 극대화 | 1-2일 |
| **Empty state 일러스트/CTA** — 각 뷰 빈 상태에 "샘플 채우기" 버튼 | 빈 화면 공포 해소 | 1일 |
| **Kanban 카드 visual polish** — 색상 바, 우선순위 아이콘, 더 풍성 | Airtable 수준 근접 | 1일 |
| **게임 도메인 온보딩** — RPG/FPS/MOBA/Idle 4 프리셋 + 용어 해설 팝오버 | 도메인 이해도 | 1일 |
| **마이크로 애니메이션** — 셀 편집 확정 시 체크마크, 성공 토스트 | 피드백 명확 | ½일 |
| **키보드 단축키 치트시트** (Cmd+/) | 파워유저 초기 정착 | ½일 |

**합계 5-6일 분량 → 1 세션 (방치 가능)**. **Phase B (AI Auto-Balancer 등) 와 병렬 진행 가능**.

### 본격 재설계가 필요한 시점
다음 조건 중 2+ 충족 시:
- 실사용자 10명+ 인터뷰 후 "UX 자체가 혼란" 피드백 지속
- Airtable/Linear 수준 완성도 영업 필수인 엔터프라이즈 고객 대기
- 디자이너 영입 (1인 개발 한계)
- 시드 투자 유치 후 (자금 생기면 재설계 가능)

**현재 단계**: 위 조건 미충족. 재설계 불필요. 기능 완성 + 첫인상 폴리시가 우선.

---

## 2.65. 포지셔닝 진화 — "Kubernetes for Game Data" (2026-04-19)

**백엔드고수 + 팝콘도팝(현직) 피드백 + 2차 심화 리서치 결과**:

### 시장 빈 자리 발견
```
기존 제품 카테고리:
  Excel / Airtable          = 도커 (단일 컨테이너 = 시트 하나)
  PlayFab / AccelByte       = 게임 인프라 (BaaS)
  Balancy / Metaplay / Xsolla = LiveOps 운영 (OTA 업데이트, 세그먼트)
  Machinations              = 이코노미 시뮬 (노드 그래프)
  Helika                    = AI 플레이어 분석 (운영 측)
  Modl:play                 = AI 밸런스 분석 (사후)

❌ 빠진 것: 게임 데이터 "오케스트레이션" 레이어
   - 여러 시트 + 버전 + 배포 + A/B + AI 추천 + 시뮬 통합
   - kubectl apply 처럼 "원하는 밸런스 선언 → 자동 적용"
```

### 포지셔닝 이중 구조
- **Phase 1 (현재)**: "Airtable for Game Designers" — 게임 기획자용 스프레드시트
- **Phase 2 (목표)**: "Kubernetes for Game Data" — 게임 데이터 오케스트레이션 플랫폼

시장 신호:
- **Xsolla LiveOps Management Suite** 2025-08 출시 (D2C 경제 운영)
- **Helika $8M 투자** 유치 (AI 게임 관리)
- **GDC 2025: 47% 개발자 AI 밸런싱 사용 중**
- **AccelByte vs PlayFab** 평가 재검토 흐름

→ **자본 몰리는 중**. "기획자 네이티브 오케스트레이션" 은 **진짜 빈 자리**.

### Phase 2 에 추가될 핵심 기능
1. **Balance Version Control** (Git-like) — 버전 태그, 롤백, diff, merge
2. **Canary 배포** — 일부 유저에게만 새 밸런스 (A/B 테스트)
3. **AI 요구사항 → 추천 설정** (아래 2.66 참조)
4. **비즈니스 효과 시뮬** — DAU/LTV/이탈률 예측 (게임사 백오피스 니즈)
5. **Live Runtime Push** — Unity/Unreal/Godot 런타임 즉시 반영

---

## 2.66. AI 요구사항 분석 → 초기 밸런스 자동 생성 (팝콘도팝 아이디어)

### 현재 경쟁 AI 기능 한계
| 제품 | AI 기능 | 한계 |
|---|---|---|
| **Modl:play** | 밸런스 분석 (사후) | 초기 설계 X |
| **Helika** | 플레이어 세그먼트 (운영) | 설계 X |
| **Machinations AI-Balancer** | 수치 최적화 (target-seeking) | 수치 튜닝만 |
| Balruno 현재 Track 11 계획 | NL → formula | 수식 하나씩만 |

### ✨ 빈 자리: "요구사항 → 전체 밸런스 테이블 자동 생성"

**입력 예시**:
```
"메트로이드바니아 장르, 난이도 중상, 플레이 시간 20시간 목표,
스킬 트리 30개 노드, F2P 가챠 없음, 콘솔+PC 타겟"
```

**AI 자동 생성 출력**:
- 캐릭터 스탯 테이블 (HP/ATK/DEF/SPEED 초기값 + 성장 곡선)
- 스킬 트리 30 노드 (데미지/쿨다운/소모값)
- 적/보스 테이블 (HP/공격력/AI 패턴)
- 아이템 드롭률 테이블
- 레벨 테이블 (경험치 곡선)
- **지역별 난이도 커브** (중상 목표에 맞춤)

### 구현 스택 (LangChain + Vercel AI SDK)
```
사용자 텍스트 → LangChain Agent
                  ↓
                  [Tool 1: 장르 템플릿 매칭] (우리 40 템플릿)
                  [Tool 2: 게임 수식 적용] (우리 70 수식)
                  [Tool 3: imbalanceDetector] (사후 검증)
                  [Tool 4: Monte Carlo] (시뮬)
                  ↓
LangChain Agent → 초기 밸런스 제안
                  ↓
사용자 확인 → Y.Doc 에 적용
```

### 왜 이게 차별화인가
- **Notion/Confluence 에서 요구사항 작성** → Balruno 에 URL 붙여넣기 → **초기 시트 전체 자동 생성**
- 게임 기획자의 **"설계 → 수치화"** 단계 단축 (현재 수백 시간 → AI 초안 + 수정)
- Modl:play (사후 분석) + Machinations (수치 튜닝) 모두 커버 못 하는 **"설계 초기"** 영역

---

## 2.6. 리서치 기반 게임 밸런싱 차별화 기능 (신규 우선순위)

2026-04-19 리서치 결과 (Balancy / Machinations / BalanceGraph / Unity Game Simulation / GDC 2025 분석):

### 🎯 Top 1: **AI Auto-Balancer (Target-seeking)**
- **출처**: Machinations AI-Balancer 의 핵심 차별화
- **기능**: 유저가 "TTK = 10초" 설정 → AI 가 ATK/DEF/HP 자동 조정
- **Balruno 강점**: 이미 `imbalanceDetector` + Monte Carlo 있어 평가 함수 절반 완료
- **구현 범위**: Track 11 AI 로 흡수. `/api/ai/auto-balance` endpoint + Vercel AI SDK + gradient/random search
- **GDC 2025**: 47% 개발자가 AI 밸런싱 사용 중

### 🎯 Top 2: **Probability Flow Diagram (확률 흐름 다이어그램)**
- **출처**: Machinations 노드 그래프 의 독특한 가치
- **기능**: "드랍 테이블 → 가공 → 보상" 흐름을 시트 옆에 시각화. 각 노드 확률/배율.
- **Balruno 전략**: Track 10 Automations 노드 그래프를 **"확률 흐름" 모드 + "자동화" 모드** 2가지로 확장. Machinations 대체 가능한 유일한 "시트 + 노드" 하이브리드 웹 SaaS.

### 🎯 Top 3: **Loot / Gacha Simulator**
- **출처**: 모바일 게임사 핵심 니즈 (가챠 확률 + 천장)
- **기능**: 10,000회 시뮬 → "평균 몇 회에 5성?" "90% 유저의 지출" 분포 히스토그램
- **Balruno 강점**: `GACHA_PITY` 함수 + Monte Carlo 이미 있음
- **구현 범위**: 기존 Simulation 패널에 "Gacha Mode" 탭 추가

### 🎯 Top 4: **Power Curve Compare (다중 엔티티 곡선)**
- **출처**: 게임 기획자 실무 (같은 레벨 대역 캐릭터/무기 비교)
- **기능**: Chart 뷰에 "Compare Mode" — select 컬럼 그룹별 곡선 overlay
- **구현 범위**: 기존 Growth Curve Chart 확장. ½일

### 🎯 Top 5: **Live Runtime Push (Balancy 벤치마크)**
- **출처**: Balancy 의 진짜 강점 — 시트 수정 → Unity/Godot 에 즉시 반영
- **기능**: 기존 엔진 export 확장. Unity SDK "balruno-watcher" 추가 → HTTP/WS 로 값 fetch
- **구현 범위**: 1~2 세션. 단 서버 필요 (BE-1)

---

---

## 3. 기능 맵 (기술 의존성 트리)

각 Track은 독립 작업 단위. 화살표는 **기술적 선행 필요** 를 의미.
**🔥 Track 0 (Yjs 마이그레이션) 이 모든 것의 기반** — 백엔드 붙일 것이므로 Y.Doc 이 진실의 소스.

```
[기존] Grid View, Column.type: general/formula, 로컬 IndexedDB, 수식 70+, Export
  │
  ├─── 🔥 Track 0: Yjs 마이그레이션 (전제 조건, 최우선)
  │      └─ Track 8 Stage A: Local Yjs Y.Doc + y-indexeddb
  │         ├─ Zustand slices 중 "데이터" 영역 → Y.Doc 으로 이관
  │         ├─ Zustand 는 UI 상태만 유지 (activeSheet, 모달, 선택 등)
  │         ├─ 기존 storage.ts 는 하위호환 + 내보내기 용도로만
  │         └─ 이게 완료돼야 Track 2/8 Stage B/9/10 가 올바르게 sync 가능
  │
  ├─── Track 1: Field 타입 확장 (11종)
  │      ├─ 기본 독립: checkbox, select, multiSelect, date, url, currency, rating
  │      └─ Attachment → 서버 S3/MinIO 업로드 + IndexedDB 썸네일 캐시
  │          (백엔드 확정이라 이 전략 채택, 로컬 blob 회피)
  │
  ├─── Track 2: Linked Records (양방향 자동 미러링)
  │      ← Track 0 + Track 1 필요 (Y.Map 기반 구현)
  │      └─ Column.type: 'link' + linkedSheetId + linkedColumnId
  │             │
  │             ├─── Track 3: Computed Link Fields
  │             │      ├─ lookup (연결된 레코드 필드 끌어오기)
  │             │      └─ rollup (연결된 레코드 집계)
  │             │
  │             └─── View 다양화에 기여 (Kanban 그룹 기준 등)
  │
  ├─── Track 4: View 다양화
  │      ← Track 0 필요 (Y.Doc 에서 구독)
  │      ├─ Kanban  ← select 필드 필요 (상태 컬럼)
  │      ├─ Calendar ← date 필드 필요
  │      ├─ Gallery  ← attachment 필드 필요
  │      ├─ Gantt/Timeline ← date + duration 필요
  │      ├─ Form     ← 독립, 언제든 가능
  │      └─ Dashboard ← 모든 뷰 + 집계 (Track 9 로 별도 분리)
  │
  ├─── Track 5: ⌘K Command Palette (독립)
  │      └─ cmdk 라이브러리 + 전역 인덱스
  │
  ├─── Track 6: 패널 통합 + 도킹 레이아웃 (독립)
  │      └─ 17개 패널 → 9개 통합, 도킹 존 고정
  │
  ├─── Track 7: Import 자동 진단 UI (독립)
  │      └─ 기존 imbalanceDetector 재활용
  │
  ├─── Track 8: 협업 (Yjs CRDT)
  │      ├─ Stage A: 위 Track 0 과 동일 (통합)
  │      ├─ Stage B: y-webrtc P2P (백엔드 없이도 협업)
  │      │      ├─ Presence / Cursors (Yjs awareness API)
  │      │      ├─ Comments + @mentions
  │      │      └─ 4명 이상 UI: +N 뱃지, 30초 유휴 숨김
  │      └─ Stage C: y-websocket + 서버 (백엔드 Track 6 와 연결)
  │
  ├─── 백엔드 확정 — [TODO_BACKEND.md](./TODO_BACKEND.md) 전부 active
  │      ├─ BE-1: Auth + 기본 CRUD
  │      ├─ BE-2: 스냅샷 레이어
  │      ├─ BE-3: Pre-agg 통계
  │      ├─ BE-4: 시뮬 이벤트 파이프라인
  │      ├─ BE-5: 권한 + 공유
  │      ├─ BE-6: y-websocket (Track 8 Stage C 와 페어)
  │      ├─ BE-7: 온프렘 패키징
  │      └─ BE-8: 모니터링
  │
  ├─── Track 9: Interface Designer / Dashboard Builder
  │      ← Track 1 + Track 2 + Track 4 모두 필요
  │      ├─ 드래그앤드롭 위젯 배치 (react-grid-layout)
  │      ├─ Chart 위젯 / Metric tile / Table 임베드 / Kanban 임베드 / Button
  │      ├─ 조건부 표시 (필터 전파)
  │      ├─ 커스텀 브랜딩 (색상, 로고)
  │      └─ 저장/공유 (한 Base 에 여러 Interface, 공유 링크)
  │
  ├─── Track 10: Automations
  │      ← Track 2 (Linked Records) 있으면 훨씬 유용
  │      ├─ Trigger: 필드 업데이트 / 일정 / 버튼 / 웹훅 / 폼 제출 / 뷰 진입
  │      ├─ Condition: 필터 로직 (AND/OR 트리)
  │      ├─ Action: 필드 업데이트 / 레코드 생성/삭제 / Find Records / 알림 / 외부 API
  │      └─ 시각 워크플로 에디터 (n8n 스타일 노드 그래프, Zapier 선형 X)
  │
  └─── 🎯 Track 11: AI 기능 (맨 마지막, 위 전부 완료 후)
         ← Track 9 (Dashboard) 가 있어야 AI 대시보드 생성 가치 발휘
         ← 다른 모든 Track 이 있어야 AI 가 조작할 표면이 충분
         ├─ 자연어 수식 제안 (NL → formula) — 5단계 validator 파이프라인
         ├─ 자연어 쿼리 ("DPS 상위 10 캐릭터")
         ├─ AI 대시보드 자동 생성 (Airtable Omni 방식)
         ├─ AI 필드 제안
         └─ AI 밸런스 리뷰 (imbalanceDetector 결과 자연어 해설)
```

---

## 4. 실행 순서 (2026-04-19 리서치 반영 재조정)

**원칙 변경**: Track 11 AI 를 "맨 마지막" → **Track 9/10 이후 바로** 로 당김.
이유: GDC 2025 "47% 개발자가 AI 밸런싱 사용 중" + Machinations AI-Balancer 가 **1위 차별화 포인트** 로 확인됨.

### 다음 세션 우선순위

```
Phase A (UX 완성도) — 가시 효과 최대
  ├─ Track 1 확장: 타입별 전용 CellEditor (checkbox 토글, rating 클릭, date picker)
  ├─ Track 2 확장: 양방향 자동 미러링 + 레코드 피커 UI
  ├─ Track 4 Kanban 확장: 카드 편집 사이드 패널 + 커버 이미지 + 필드 토글
  └─ Track 4 Calendar/Gallery/Gantt 확장 (우선순위 하)

Phase B (게임 도메인 차별화) — 리서치 기반 Top 5
  ├─ 🎯 AI Auto-Balancer (Target-seeking) — Track 11 부분 진입
  │    평가 함수는 imbalanceDetector + Monte Carlo 재활용
  ├─ 🎯 Loot/Gacha Simulator — 기존 Monte Carlo 확장
  ├─ 🎯 Power Curve Compare — 기존 Growth Curve 확장
  └─ 🎯 Probability Flow Diagram — Track 10 노드 그래프로 진입

Phase C (Interface / Automation 본격)
  ├─ Track 9: 위젯 시스템 + react-grid-layout
  └─ Track 10: 노드 그래프 에디터 + 런타임 엔진
  └─ Track 11 완전판: NL→formula 5단계 validator + NL 쿼리 + 대시보드 AI 생성

Phase D (협업 + 배포)
  ├─ Track 8B UI 통합: Presence/Cursor + SettingsModal 공유 버튼
  ├─ Live Runtime Push: Balancy 벤치마크 (엔진 SDK 확장, BE-1 필요)
  ├─ 백엔드 BE-1~8 (Spring Boot + MySQL + Docker)
  └─ Track 8C y-websocket (BE-6 연결)
```

### 리서치 기반 **권장 다음 세션 (1-2 세션)**

| 순위 | 작업 | 이유 |
|---|---|---|
| 1 | **Track 11 AI Auto-Balancer MVP** (Phase B) | 리서치 Top 1. imbalanceDetector + MC 이미 있어 빠름. 차별화 최강. |
| 2 | **Track 4 Kanban 완성도** (Phase A) | 게임 기획자 주력 뷰 (스킬 트리, 캐릭터 상태). 카드 편집 패널. |
| 3 | **Track 2 양방향 미러링** (Phase A) | 현재 단방향이라 실사용 불편. 수식 엔진 영향 크므로 조심. |

### 기존 의존성 (참고)

- **Track 0** (Yjs) 완료 ✅ — 모든 트랙의 기반
- **Track 5/6/7** 완료 ✅ — Track 0 독립
- **Track 1** MVP ✅ → 확장 시 Track 2/4 완성도 동반 상승
- **Track 3** Lookup/Rollup ← Track 2 완성 (양방향) 의존
- **Track 9** Interface ← Track 1/2/4 완성 후 (현재 scaffold)
- **Track 10** Automations ← Track 2 완성 시 더 유용
- **Track 8C** WebSocket ← BE-6 필요
- **Track 1 Attachment** ← BE-1 (S3 업로드)

---

## 5. 기술 스택 결정 (리서치 결과 반영)

| 트랙 | 선택 | 이유 |
|------|------|------|
| **Track 0 (Yjs 기반)** | **Yjs + y-indexeddb + y-webrtc + y-websocket** | 진실의 소스. Tiptap/Excalidraw 검증. 백엔드 붙일 거라 필수 |
| Track 1 Attachment | **서버 S3/MinIO 업로드 + IndexedDB 썸네일** | Firefox blob 저장 성능 문제 회피. 백엔드 있으니 자연스러움 |
| Track 4 View | **`shadcn-data-views` 검토 → 적합하면 채택** | 단일 JSON 스키마로 Grid/Kanban/Gallery/Calendar/Form 자동 생성 (2026-01 출시) |
| Track 4 Gantt | **SVAR React Gantt (MIT)** | 의존성 화살표, 드래그 편집, TypeScript 지원 |
| Track 5 ⌘K | **`cmdk` + `react-window`** (2000+ 아이템) | Linear/Raycast 사용. React 18 호환 |
| Track 8 Stage B | **공용 y-webrtc 신호서버 먼저 → 수요 확인 시 자체 호스트** | 데이터는 E2E 암호화라 신호서버는 메타데이터만 봄 |
| Track 9 Dashboard | **react-grid-layout** | 12-col grid, 드래그/리사이즈, 반응형 breakpoints |
| Track 10 Automations | **n8n 스타일 노드 그래프** (자체 구현) | 게임 기획자에게 시각 분기 친화. Zapier 선형 X |
| Track 11 AI | **Vercel AI SDK v6 + Claude** | 2025-12 출시, 25+ 프로바이더 2줄 교체. Gemini 2.5 Flash 180ms 최속 |

---

## 6. 백엔드 — 확정 진행

[TODO_BACKEND.md](./TODO_BACKEND.md) 전 트랙 active.
프론트 Track 0 (Yjs) 완료 후 BE-6 (y-websocket) 가 연결 포인트.
BE-1 (Auth/CRUD) 는 Track 0 와 독립적으로 언제든 착수 가능.

### 공존 전략
- **로컬 모드** — 오프라인에서도 완전 동작 (y-indexeddb)
- **클라우드 모드** — 로그인 후 Y.Doc 이 y-websocket 로 서버와 sync
- **하이브리드** — 로컬 기본, 원할 때 클라우드 sync 활성 (`SettingsModal` Sync 탭)

이 구조로 Open Core 3단 가격 지원:
- 무료: 로컬만 (오픈소스, MIT)
- Pro: 클라우드 백업 + AI 토큰
- Team: 공유/협업/권한
- Enterprise: 온프렘 설치

---

## 7. 게임 도메인 강화 트랙 (경쟁자 관찰)

Machinations (노드 기반 시뮬) 에서 차용 고려:
- **확률 흐름 다이어그램** — 수식 테이블 옆에 "원천 → 가공 → 결과" 시각화
- **Artificial Player 시뮬** — 여러 전략 자동 플레이 → 지배 전략 탐지

Balancy (Unity 플러그인) 에서 차용 고려:
- **런타임 데이터 배포** — Balruno 시트 변경 → Unity 게임에 즉시 반영 (HTTP/WS)

이 두 트랙은 Balruno 의 스프레드 메타포 위에 **게임 특화 상위 레이어** 추가.

---

## 8. 다음 세션 작업 (2026-04-19 기준)

```
【A】🎯 Track 11 AI Auto-Balancer MVP (Phase B 진입)
    ├─ /api/ai/auto-balance endpoint: target + tunables → 조정값 제안
    ├─ 평가 함수: imbalanceDetector + Monte Carlo 결과 스칼라화
    ├─ 간단한 search (gradient/random) — LLM 없이도 동작
    ├─ 추후 Vercel AI SDK v6 로 고급화
    └─ 근거: 리서치 Top 1, GDC 2025 47% 개발자 사용

【B】🟡 Track 4 Kanban 완성도
    ├─ 카드 클릭 → 우측/중앙 편집 사이드 패널 (모든 필드)
    ├─ 커버 이미지 필드 설정 (url 또는 attachment)
    ├─ 카드에 표시할 필드 토글 (현재는 자동 앞 4개)
    └─ 카드 색상 = select 옵션 color 반영

【C】🟡 Track 1 타입별 전용 CellEditor
    ├─ checkbox: 클릭 시 바로 토글 (에디터 없이)
    ├─ rating: 별 클릭으로 값 변경
    ├─ date: 셀 편집 진입 시 native date picker 팝업
    └─ select/multiSelect: 드롭다운 에디터 (현재 CSV 입력)

【D】🟡 Track 2 양방향 미러링
    ├─ link 컬럼 생성 시 반대쪽 시트에 reverse 컬럼 자동 추가
    ├─ 한쪽 편집 → 반대쪽 즉시 반영
    ├─ 삭제 시 cascade 정리
    └─ 수식 엔진 traversal 문법 (={캐릭터}.DPS) 추가

품질 게이트: 매 커밋 lint + test + build 통과.
세션당 1-2 커밋 단위로 작게 쪼개서 진행.
```

---

## 8.5. 리서치 기반 차별화 기능 상세 스펙 (Phase B)

### 🎯 AI Auto-Balancer MVP

**데이터 흐름**:
```
1. 유저가 설정:
   - target: "TTK(치유사, 보스) = 10초" or "승률(팀A vs 팀B) = 50%"
   - tunables: ["치유사.ATK", "치유사.HP", "치유사.DEF"]
   - constraints: "각 값 ±30% 이내"

2. 평가 함수 f(params) → score (0~1)
   - 시트 값을 params 로 임시 교체
   - Monte Carlo 1,000회 돌려 TTK 평균 계산
   - |실제 - target| 을 score 로 환산

3. 탐색:
   - MVP: random search 500 iterations (빠르고 단순)
   - 후속: gradient / Bayesian / LLM 제안

4. UI:
   - 상위 10 제안 리스트 + "적용" 버튼
   - before/after diff 표시
```

**필요한 신규 파일**:
- `src/lib/autoBalancer.ts` — 탐색 엔진
- `src/components/panels/AutoBalancerPanel.tsx` — UI
- `src/app/api/ai/auto-balance/route.ts` — (추후 LLM 통합 시)

### 🎯 Loot / Gacha Simulator

**데이터 흐름**:
```
1. 유저 설정:
   - 가챠 테이블 시트 (rarity / prob / pity_threshold)
   - 시뮬 회수 (10,000)
   - 타깃 (예: 5성 1회)

2. 시뮬:
   - GACHA_PITY 함수 재활용
   - 각 반복마다 "5성 뽑기까지 몇 회?" 기록
   - 히스토그램 생성

3. UI:
   - 분포 차트 (x: 뽑기 횟수, y: 유저 비율)
   - P50/P90/P99 마커
   - "비용 / 5성" 계산
```

**필요한 신규 파일**:
- `src/components/panels/GachaSimulator.tsx` (기존 SimulationPanel 내부 탭으로)

### 🎯 Probability Flow Diagram

Track 10 Automations 노드 에디터 확장 (2 모드):
- **Automation 모드**: Trigger → Condition → Action (기존 계획)
- **Probability Flow 모드** (신규): Source → Gate (prob) → Sink. Machinations 스타일.

MVP: React Flow 설치, 노드 3종 (Source/Gate/Sink), 각 노드 세팅, Monte Carlo 기반 시뮬.

### 🎯 Power Curve Compare

기존 `GrowthCurveChart.tsx` 에 "Compare Mode" 토글 추가:
- select 컬럼 선택 → 그룹별 곡선 overlay
- 각 곡선 색 = select 옵션 color
- 예: 직업별 HP 곡선 6개 overlay

### 🎯 Live Runtime Push

BE-1 완료 후:
- 시트 수정 → y-websocket 통해 Unity SDK 로 즉시 반영
- Unity 측: `balruno-unity-sdk` Git 서브모듈 + HTTP polling fallback
- Unreal/Godot 는 후속

---

## 9. 웹 리서치 출처 요약

### 2026-04-18 리서치 (이전 세션)
- **Airtable** — 필드 20종, Linked Records 양방향 자동 미러링 (1:1/1:N/N:N), Interface Designer 드래그앤드롭 + AI 생성 (Omni, 2026)
- **Linear** — ⌘K 중심 UX, AI-native, 2026-03 UI 리디자인
- **Notion** — Dashboard view 2026-03 추가, 카드/차트/메트릭 타일
- **Figma** — 2026-01 UI3 사용자 반란 → Fixed panels 복귀 → **도킹 > 플로팅 공식 확인**
- **shadcn-data-views** — 2026-01 신규, JSON 스키마 → 5개 뷰 자동 생성
- **Yjs** — IndexedDB + WebRTC/WebSocket. Tiptap, Excalidraw 검증
- **cmdk** — Linear/Raycast 백본. React 18, 2000-3000 아이템까지 성능 OK

### 2026-04-19 심화 리서치 — 오케스트레이션 / LiveOps / AI 트렌드

**LiveOps 플랫폼 경쟁**:
- **Metaplay**: 게임 config 오케스트레이션 (OTA 업데이트). Unity 특화
- **PlayFab** (MS): Full Stack LiveOps, 경제/이벤트/CMS
- **AccelByte**: PlayFab 대체로 부상, 80% 서비스 + 20% 커스텀
- **Xsolla LiveOps Management Suite** (2025-08 출시, D2C 특화)
- **Helika**: AI 게임 관리, $8M 투자. Web3 + 전통 게임
- **Balancy**: Unity 데이터 관리 + 런타임 배포 + Virtual Economy

**게임 BaaS**:
- Nakama (오픈소스), Beamable, LootLocker, Namazu

**AI 트렌드**:
- LangChain + Vercel AI SDK 가 표준 agent 프레임워크
- Modl:play = AI 밸런스 분석
- **빈 자리: "요구사항 → 전체 시트 생성"** 아직 없음

### 2026-04-19 리서치 (게임 밸런싱 도메인 심화)
- **Balancy** (balancy.co, Unity Asset Store) — 데이터 템플릿 + Virtual Economy 도구 (Hard Currency 환율 자동 계산) + 태그 시스템 + **런타임 배포**
- **Machinations** (machinations.io) — 노드 그래프 + **Monte Carlo** + **AI-Balancer (Target-seeking 자동 최적화)**
  - 50K+ 개발자, 300+ 스튜디오
  - 독특한 가치: "시트로 못 그리는 확률 흐름"
- **BalanceGraph** (Unity Editor) — 노드 기반 Monte Carlo 시뮬레이터
- **Unity Game Simulation** — 클라우드 대량 시뮬, 자동 플레이 → 매개변수 탐색
- **GDC 2025 핵심 인사이트**:
  - **47% 개발자가 AI 를 playtesting + balancing 에 사용**
  - 90% 개발자가 어떤 형태로든 AI workflow 사용
  - Live Service Games Summit 에서 밸런스 최적화 강조
  - Databricks + HeroicLabs 데이터 파이프라인 시연

### 게임 기획자 실제 고통 (인용)
- "몬스터 하나 세팅 8시간, 월 100시간"
- "숫자 하나 바꿨더니 스프레드시트 반이 깨짐"
- "정렬하면 컬럼마다 행 엇갈림"
- "JSON 손으로 타이핑, 스킬 설명 복붙"

→ Balruno 가 전부 해결 + AI Auto-Balancer 추가 시 **차별화 완성**

게임 기획자 실제 고통 (웹 리서치 인용):
- "몬스터 하나 세팅 8시간, 월 100시간"
- "숫자 하나 바꿨더니 스프레드시트 반이 깨짐"
- "정렬하면 컬럼마다 행 엇갈림"
- "JSON 손으로 타이핑, 스킬 설명 복붙"

→ Balruno 가 전부 해결하는 문제. PMF 시그널 강함.

---

## 10. 관련 문서

- **[TODO_FRONTEND.md](./TODO_FRONTEND.md)** — 프론트 Track 1~11 상세
- **[TODO_BACKEND.md](./TODO_BACKEND.md)** — 백엔드 (시나리오 A 선택 시 활성)
- **[DESIGN_KO.md](./DESIGN_KO.md)** — 제품 원본 설계 (참고용)
- **[api-spec.md](./api-spec.md)** — API 스펙 (백엔드 착수 시 기반)
- **archive/** — 이전 탐색 문서 (학습 기록)
