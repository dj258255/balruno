# Balruno 마스터 계획 (프론트 + 전략 + UX)

> **작성**: 2026-04-18 (v4, 백엔드 분리 후)
> **위치**: `docs/draft/` (개인 작업 공간)
> **범위**: 전략, 프론트엔드 기능, UX, 30일 계획
> **백엔드**: [`BACKEND_KO.md`](./BACKEND_KO.md) 별도 문서 (Java + Spring Boot + MySQL)
> **원칙**: 유저 검증 없이 큰 기술 투자 금지.

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [지금 상황](#2-지금-상황)
3. [제품 비전](#3-제품-비전)
4. [기술 스택 개요](#4-기술-스택-개요)
5. [프론트엔드 기능](#5-프론트엔드-기능)
6. [UX 전략 (자체 설명)](#6-ux-전략-자체-설명)
7. [30일 실행 계획](#7-30일-실행-계획)
8. [Day 30 이후 시나리오](#8-day-30-이후-시나리오)
9. [중단 기준](#9-중단-기준)
10. [웹 리서치 출처](#10-웹-리서치-출처)
11. [부록](#부록-a-이전-문서-요약-학습-기록)

---

## 1. 한눈에 보기

### 제품 정체성 (2026-04-18 프레이밍 확정)
**"Airtable for Game Designers"** — 게임 기획자를 위한 에어테이블.

- **Airtable 계보**: Base(프로젝트) / Table(시트) / Field(컬럼) / Record(행) / View(뷰) / Linked Records(관계)
- **게임 전용 해자** (Airtable이 못 하는 것):
  1. 수식 70+ (DPS/TTK/EHP/GACHA_PITY 등 게임 도메인 내장)
  2. Monte Carlo · DPS 분산 · 이코노미 시뮬
  3. Unity/Unreal/Godot 자동 Export
  4. 장르별 템플릿 (RPG/FPS/Idle/Roguelike/MOBA)
  5. 게임 도메인 용어 (Character/Weapon/Stage/Skill)
  6. 로컬 우선 + 오프라인 완전 지원 (IndexedDB)

### 제품 한 줄 정의 (부가)
**"게임 밸런스 데이터를 입력·시뮬·통계까지 온프렘 한 곳에서 처리하는 Open Core 플랫폼"**
— B2B 판매 시 덧붙이는 2차 포지셔닝. 1차는 "Airtable for Game Designers".

### 핵심 차별화
- ✅ **"게임판 Airtable"**: 친숙한 DB 모델 + 게임 수식/시뮬/Export 내장
- ✅ **온프렘 Java/Spring**: 스튜디오 서버 안에서 돌아감 (IP 유출 0, 한국 엔터프라이즈 친화)
- ✅ **스냅샷 기반 통계**: 긴 쿼리 대신 미리 계산된 스냅샷에서 즉시 조회
- ✅ **전투 시뮬 데이터 레이어**: 편집 데이터와 시뮬 데이터 분리
- ✅ **70+ 게임 수식**: DPS/TTK/EHP/GACHA_PITY 등 내장
- ✅ **엔진 중립 Export**: Unity / Unreal / Godot 동시 지원
- ✅ **MIT Open Core**: 코어 무료, Enterprise 기능만 유료

### 지금 확정된 것 (2026-04-18 업데이트)
1. ✅ `formulaEngine` O(N²) 버그 수정 완료 (WeakMap 캐시, 29 테스트 전원 통과)
2. ✅ `sync/`, `sdk/` 죽은 코드 제거 완료
3. ✅ 브랜드 통일 완료 (balruno.com 도메인 + GitHub 레포 + Vercel + LICENSE)
4. ✅ 정체성 프레이밍 확정: "Airtable for Game Designers"

### 이후 모든 것은 Day 30 유저 대화 후 결정
온프렘 백엔드 / 스냅샷 서버 / 통계 UI / Linked Records / 추가 View — 전부 유저가 실제로 원하는지 확인 후 착수.
**단, 리스크 낮은 Field 타입 확장 + UI 청소는 인터뷰와 병행 가능.**

---

## 2. 지금 상황

### 제품 현재 상태
- **배포**: `https://www.balruno.com` (Vercel + Cloudflare, MIT 오픈소스) · `indiebalancing.vercel.app` (기본 URL 보조)
- Next.js 16 + React 19 + TypeScript + Zustand + IndexedDB
- 70+ 게임 수식 + Monte Carlo 시뮬 + 엔진 Export
- 등급: **B급 인디 제품** (엔터프라이즈 판매는 아직 불가, 청소 + Phase 1 이후 재평가)

### 확인된 기술 문제 (2026-04-18 코드 감사 후 업데이트)

#### ✅ 이미 해결
| 문제 | 위치 | 상태 |
|---|---|---|
| ~~시트 전체 재계산 O(N²)~~ | ~~`formulaEngine.ts:699`~~ | ✅ WeakMap 캐시 적용, 200행 < 500ms |
| ~~죽은 코드 `sync/`, `sdk/`~~ | — | ✅ 삭제 완료 |
| ~~테스트 0건~~ | — | ✅ `formulaEngine` 29 테스트 통과 |

#### 🚨 크리티컬 (90분 청소 묶음)
| 문제 | 위치 | 영향 |
|---|---|---|
| 중복 파일 10개 | `src/components/` 루트 (Calculator/ComparisonChart/FormulaHelper/GrowthCurveChart/OnboardingGuide/ReferencesModal/SheetTable/SheetTabs/Sidebar/TemplateSelector) | `panels/` 와 다른 내용 · 어디서도 import 안 됨 · 혼란 |
| `authStore` 고아 코드 | `stores/authStore.ts` | `setUser`/`setTokens` 호출부 0 · sync/sdk 잔존물 |
| ErrorBoundary 없음 | 전체 | 수식 1개 터지면 앱 크래시 |
| 접근성 속성 10건만 | 13K+줄 컴포넌트 전체 | 스크린리더 0 · B2B 조달 감점 |

#### 🟡 중형 (각 4-8h, 선택적)
| 문제 | 위치 | 영향 |
|---|---|---|
| god component 3종 | `page.tsx` 766 / `projectStore.ts` 1,259 / `GrowthCurveChart.tsx` 1,971 | 리렌더 폭탄, 유지보수 ↓ |
| 패널 17개 (목표 11-12) | `components/panels/` | 인지 과부하 |
| `formulaEngine.ts` 1,970줄 단일 | `lib/formulaEngine.ts` | 카테고리별 분리 필요 |

#### 🟡 Airtable 정렬 격차
| 문제 | 위치 | 영향 |
|---|---|---|
| Field 타입 빈약 | `Column.type: 'general' \| 'formula'` 2종만 | Airtable 대비 20종 부재 |
| Linked Records 없음 | `processSheetReferences` 휴리스틱 (`formulaEngine.ts:743`) | 관계 데이터 "애매함"의 근원 |
| View = Grid만 | 전체 | Kanban/Calendar/Gallery/Gantt 0 |
| ⌘K Command Palette 없음 | — | 셀/수식/프로젝트 빠른 접근 불가 |
| 전역 검색 없음 | — | 대규모 시트에서 탐색 수동 스크롤 |
| 저장 상태 UI 모호 | `storage.ts` autosave | 유저가 "지금 저장됨" 확인 어려움 |

#### 🟡 Day 30 유저 검증 후 결정
| 항목 | 상태 |
|---|---|
| 백엔드/스냅샷 서버 | 유저 "온프렘 필요" 답 3+ 시 착수 |
| 통계 대시보드 | 수요 확인 후 |
| 온프렘 배포 | B2B 계약 전제 조건 확인 후 |
| 실시간 협업 (Yjs) | "Airtable 수준 협업 필요" 답 검증 후 |

### 검증되지 않은 가설 (인터뷰 대상)
- 게임 기획자가 스냅샷 기반 통계를 **실제로** 원하는가?
- 온프렘이 정말 필수인가?
- 전투 시뮬 결과를 통계로 보는 수요가 있는가?
- 스튜디오가 이런 플랫폼에 연 $15-50K 지불하는가?
- **Airtable 스타일 Linked Records + 다양한 View 가 기획에 필요한가?** (신규)
- **"Airtable for Game Designers" 포지셔닝이 실제 기획자에게 공명하는가?** (신규)

**Day 30 유저 대화 검증 필수.**

---

## 3. 제품 비전

### 3.1 3계층 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  [Layer 1] 편집 레이어 — 스프레드시트 + 수식 엔진             │
│  Next.js 프론트 + mathjs 엔진                                 │
│  - Grid UI, 70+ 게임 함수, Import/Export                     │
│  - 기본 사용자가 90% 시간 보내는 곳                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (자동 스냅샷)
┌─────────────────────────────────────────────────────────────┐
│  [Layer 2] 스냅샷 레이어 — 시점별 데이터 저장소               │
│  Spring Boot API + MySQL snapshots 테이블                    │
│  - 편집 완료/커밋 시점 전체 시트 immutable 저장               │
│  - 년/월/일 pre-aggregated 테이블                            │
│  - 긴 쿼리 대신 여기서 조회 = 즉시 응답                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (참조)
┌─────────────────────────────────────────────────────────────┐
│  [Layer 3] 시뮬 레이어 — 전투 시뮬 독립 데이터 스트림         │
│  Spring Boot API + MySQL simulation_events 테이블            │
│  - 시뮬 실행 시 모든 이벤트 저장                              │
│  - 편집 레이어와 독립                                         │
│  - snapshot_id로 시뮬 시점 추적                               │
└─────────────────────────────────────────────────────────────┘
```

상세 DB 스키마, 파이프라인 구현 → [`BACKEND_KO.md`](./BACKEND_KO.md)

### 3.2 왜 이 구조인가

**문제 (현재)**:
- 유저 "지난 달 평균 DPS" 요청 → 전체 편집 기록 스캔 + 수식 재평가 → **30초+**

**해결**:
- 매일 자정 자동 스냅샷 + 일/월/년 aggregate 미리 계산
- 유저 요청 시 `daily_stats` 테이블에서 SELECT → **200ms**

**업계 증거**:
- CQRS + Event Sourcing: 전통 대비 **30% 빠른 읽기**
- MySQL 파티셔닝 + @Scheduled 집계: 검증된 엔터프라이즈 패턴

---

## 4. 기술 스택 개요

### 4.1 프론트엔드 (변경 없음)

| 영역 | 스택 |
|---|---|
| 프레임워크 | Next.js 16 (Turbopack) |
| UI | React 19 |
| 언어 | TypeScript |
| 상태 | Zustand 5 |
| 로컬 저장 | IndexedDB (idb) |
| 수식 | mathjs |
| 차트 | Recharts |
| i18n | next-intl (EN/KO) |

### 4.2 백엔드 (Phase 2+ 도입)

| 영역 | 스택 |
|---|---|
| 언어 | **Java 21 LTS** |
| 프레임워크 | **Spring Boot 3.4** |
| DB | **MySQL 8.4 LTS** |
| 캐시 | Redis 7 |
| ORM | Spring Data JPA + Hibernate 6 |
| 빌드 | Gradle |
| 배포 | Docker Compose |

**왜 Java/Spring/MySQL**:
- 한국 엔터프라이즈 표준 → 영업 시 "팀이 익숙" 유리
- 이미 있는 `api-spec.md` 가 Spring Boot 가정
- MySQL은 사내 DBA 팀이 다룰 수 있음
- 사내 Nexus/Maven 레포지토리 연동 용이

상세 → [`BACKEND_KO.md`](./BACKEND_KO.md)

---

## 5. 프론트엔드 기능

### 5.1 기존 자산 (유지)

- 수식 엔진 + 70+ 게임 함수 (`formulaEngine.ts`, 1,945줄)
- 16개 도구 패널 (Calculator, SimulationPanel, CurveFitting 등)
- 게임 엔진 Export (Unity/Unreal/Godot)
- 장르별 템플릿
- Monte Carlo 시뮬레이션
- i18n (EN/KO)
- 다크모드
- 모바일 반응형 (뷰잉 전용으로 축소 예정)

### 5.2 삭제/통합 (Week 1-2)

| 대상 | 처리 |
|---|---|
| `src/lib/sync/` | **삭제** (서버 없이 동작 안 함) |
| `src/lib/sdk/` | **삭제** (현재 제품과 통합 안 됨) |
| Calculator + FormulaHelper | FormulaHelper로 **통합** |
| OnboardingGuide + Tour | Tour 시스템으로 **통합** |
| BalanceValidator + ImbalanceDetector | ImbalanceDetector로 **통합** 검토 |

결과: **16 패널 → 11-12 패널, 약 5,000줄 감소**.

### 5.3 성능 수정 (Day 1-7, 최우선)

**문제**: `formulaEngine.ts:699` - `computeCellValue`가 셀 하나 평가할 때마다 전체 시트 재계산 (O(N²))

**해결**: DAG 기반 증분 재계산
```typescript
// 1. 모든 셀의 의존성 그래프 구축
// 2. 변경된 셀의 downstream만 재계산
// 3. 메모이제이션 + WeakMap 캐시
```

**목표**: 200행 기준 30초 → 500ms 이하

### 5.4 Airtable 정렬 로드맵 (검증 후)

**원칙**: Airtable이 있는 기능 = Balruno가 갖춰야 할 것. Airtable이 없는 게임 기능 = Balruno 해자 강화.

#### Phase 1 — Field 타입 확장 (Day 1-30 병행 가능, 리스크 낮음)
기존 `Column.type: 'general' | 'formula'` 2종을 Airtable 수준으로 확장:

| 신규 타입 | 용도 (게임 기획 맥락) |
|---|---|
| `'checkbox'` | 스킬 활성/비활성, 장비 획득 여부 |
| `'select'` | 등급(커먼/레어/에픽), 원소 속성 — 이미 `ValidationConfig.allowedValues` 있음 |
| `'multiSelect'` | 태그, 다중 속성 (불+얼음) |
| `'date'` | 패치 날짜, 이벤트 스케줄 |
| `'url'` | 참고 자료, 원화 링크 |
| `'attachment'` | 캐릭터 아이콘, 스킬 컷인 (IndexedDB blob) |
| `'rating'` | 밸런스 피드백 별점 |

- 기존 프로젝트 호환: `type` 미지정 = `'general'` fallback
- 소요: 2-3일 · 유저 인터뷰와 병행 가능

#### Phase 1.5 — 기존 자산 재활용 UI (Day 1-30 병행 가능)
- **Import 자동 진단** — Excel 붙여넣기 → `imbalanceDetector.ts` 자동 실행 → "23% 과대 감지"
- **빈 상태 3-카드** — 샘플 / 장르 템플릿 / Excel 가져오기

#### Phase 2 — Linked Records (Day 30+ 유저 검증 후)
**핵심: "애매함" 근본 해결**
- `Column.type: 'link'` 추가 + `linkedSheetId` + `linkedColumnId` (PK)
- UI: 컬럼 만들 때 "Link to another table" 선택 → 대상 시트/PK 드롭다운
- 수식 관계 traversal: `{캐릭터}.DPS` (현재 행의 관계 따라가기)
- 기존 문자열 참조 (`캐릭터.CHAR_001.DPS`) = deprecated but 호환
- 이게 `processSheetReferences` 휴리스틱 전체를 대체

#### Phase 2 — 추가 View 타입 (Day 30+ 유저 검증 후)
- **Kanban** — 기획/구현/테스트/런칭 단계 트래킹
- **Gallery** — 캐릭터/무기 카드 (Attachment 필드 필요)
- **Calendar** — 패치 일정, 이벤트 스케줄
- **Gantt/Timeline** — 릴리즈 로드맵, 밸런스 변경 이력
- **Dashboard** — 여러 시트 KPI 집계 (평균 DPS, 파워 곡선)

#### Phase 2 — 탐색 UX (Day 30+)
- **⌘K Command Palette** — 모든 기능/시트/컬럼/수식 검색 접근
- **상단 검색 바** — ⌘K 힌트 상시 노출
- **통계 대시보드** — (백엔드 진행 시) daily/monthly/yearly_stats 시각화
- **스냅샷 타임라인** — (백엔드 진행 시) "지난 버전과 비교" UI
- **전투 시뮬 결과 대시보드** — (백엔드 진행 시) 이벤트 타임라인 + 집계

#### Phase 3 — 협업 (18개월+, 유저 검증된 경우에만)
- **Automations** — "레코드 업데이트 시 알림" 등 트리거 규칙
- **행 단위 댓글 + @멘션**
- **실시간 멀티플레이 (Yjs CRDT)**
- **권한** (view / edit / admin)
- **공유 링크** (read-only / 댓글 가능)
- **상태 컬럼 (monday 스타일)** — Phase 1 `select` 타입으로 대체 가능

### 5.5 모바일 전략 — 뷰잉 전용

**결론**: 편집 포기, 대시보드/시뮬/댓글 읽기만.
이유: 편집 사용성 끔찍, 유지 비용 큼.

---

## 6. UX 전략 (자체 설명)

### 6.1 원칙: "설명서 없이 사용"

웹 리서치 (Chameleon 2026):
> "엔터프라이즈 플랫폼은 복잡하다. 유저는 매뉴얼에 의존할 수 없다. **맥락적 도움이 유일한 해결책**."

### 6.2 4단계 레이어드 도움말

```
Layer 1: 즉각 인식 가능
  - 아이콘 + 명확한 라벨 (아이콘만 안 됨)
  - 색상 구분 (status 초록/노랑/빨강)
  - 빈 상태에 "클릭하세요" 명시

Layer 2: Hover 툴팁
  - 모든 버튼에 1줄 설명
  - 단축키 힌트

Layer 3: 트리거 기반 힌트
  - 5초 이상 정지 시 팝업
  - 첫 사용 기능에 "새 기능!" 뱃지
  - 자주 실수하는 지점 선제 경고

Layer 4: 맥락적 도움말 `?`
  - 각 도구 우측 상단 `?` 아이콘
  - 1줄 정의 + 30초 데모 GIF
  - "자세히" 외부 docs 링크
```

### 6.3 3-경로 진입 (검색 + 사이드바 + ⌘K)

ONE 경로에 의존 금지:
1. **상단 검색 바** (시각, 항상 보임)
2. **좌측 사이드바** (아이콘 + 라벨)
3. **⌘K Command Palette** (파워 유저)

### 6.4 초보자 보호

```
[처음 접속]
  ↓
 샘플 프로젝트 자동 열림
  ↓
 3단계 오버레이 투어 (스킵 가능):
   1. "이 셀을 더블클릭해 편집"
   2. "이 컬럼 수식 봐보세요: =DPS(..)"
   3. "결과 차트 여기"
  ↓
 튜토리얼 완료 시 "Pro 1주일 무료" 인센티브
```

### 6.5 측정 지표

- **Time to First Formula**: 90초 이하 목표
- **Help Panel Open Rate**: 2주 후 90% 감소 (익숙해지면)
- **Task Completion Rate**: 빈 상태 3카드 → 80%+ 편집 진입

### 6.6 디자인 언어 — "조용한 전문성"

참고 제품: Linear / Raycast / Arc Browser

- 색상 최소 (그레이 85% + Primary 1개)
- 여백 넓게 (고급감)
- 애니메이션 "목적 있는 것만"
- 한글 Pretendard + 영문 Inter

---

## 7. 30일 실행 계획

### Day 1-7: 프론트엔드 기반 정리

#### ✅ 완료 (2026-04-18)
- formulaEngine WeakMap 캐시 리팩터 (29 테스트 전원 통과, 200행 < 500ms)
- sync/, sdk/ 삭제
- Vitest 설치 + formulaEngine 단위/성능 테스트 29개
- 성능 벤치마크 확인
- 브랜드 통일: balruno.com 도메인 구매 + Vercel 연결 + GitHub 레포명 + LICENSE
- 정체성 프레이밍: "Airtable for Game Designers"

#### ☐ Day 1-7 잔여 — "90분 청소 묶음" (리스크 낮음, 한 번에 가능)
```
☐ 중복 파일 10개 정리
   → src/components/ 루트 vs src/components/panels/
   → diff 후 최신 버전 남기고 나머지 삭제
☐ src/stores/authStore.ts 삭제
   → 호출부 0 (sync/sdk 잔존물)
☐ 루트 ErrorBoundary 추가
   → Next.js app/error.tsx + 패널별 boundary
☐ 주요 버튼/입력 aria-label 최소 30개
   → SheetHeader, PanelHeader, 모달 닫기 버튼, 툴바
```

#### Day 1-7 잔여 — 중형 작업 (2026-04-18 진행 후 업데이트)
```
✅ stores/slices/ 삭제 (1,023줄 미사용 dead code — 어디서도 import 안 됨)
   → projectStore 전면 마이그레이션은 테스트 커버리지 선행 필요 (35 consumers, 리스크 상)
✅ GrowthCurveChart.tsx 순수 계산 함수 추출
   → 1,971줄 → 1,814줄 (-157)
   → 신규 `growth-curve-chart.helpers.ts` (193줄): hermiteInterpolate, calculateDiminishing, calculateXPRequired, calculateSegmentedValue, GrowthSegment, InterpolationType, ViewMode, PANEL_COLOR, CURVE_COLORS, SCENARIO_COLORS, CURVE_KEYS

✅ formulaEngine.ts 카테고리 분리 완료
   1,970줄 → 1,418줄 (-552, -28%)
   신규 `lib/formulas/` 6파일:
   - game.ts (199줄): 게임 전용 (SCALE/DAMAGE/DPS/TTK/EHP/DROP_RATE/GACHA_PITY/COST/WAVE_POWER/DIMINISHING/ELEMENT_MULT/STAMINA_REGEN/COMBO_MULT/STAR_RATING/TIER_INDEX)
   - math.ts (133줄): 수학 유틸 + Excel 호환 + 삼각함수 + PI/E 상수
   - stats.ts (44줄): SUM/AVERAGE/MIN/MAX/COUNT/MEDIAN/STDEV/VARIANCE
   - prob.ts (32줄): CHANCE/EXPECTED_ATTEMPTS/COMPOUND/RAND/RANDBETWEEN
   - logic.ts (23줄): IF/AND/OR/NOT
   - index.ts (72줄): 집계 re-exports + `formulaBundle` (math.import 용)
   formulaEngine.ts 는 엔진 로직(parser/캐시/시트 참조/availableFunctions 메타)만 유지.
   공개 API (`SCALE` 등 22개 함수) 는 re-export 로 하위호환.

✅ projectStore.ts 전면 분해 완료
   1,259줄 → 208줄 (-1,051, -83%)
   신규 `stores/slices/` 4파일 (Zustand 슬라이스 패턴):
   - projectSlice.ts (381줄): Projects CRUD + Folders
   - sheetSlice.ts (257줄): Sheets CRUD + openSheetTabs
   - cellSlice.ts (573줄): Columns + Rows + Cells + CellStyles + Stickers
   - selectionSlice.ts (72줄): selectedRows + cellSelectionMode
   projectStore.ts 는 ProjectState 인터페이스 + 초기 상태 + 슬라이스 컴포지션만.
   35개 consumer 영향 없음 (ProjectState 공개 API 동일 유지).

☐ 패널 통합 (17 → 11-12) — **인터뷰 후 결정**
   사유: Calculator+FormulaHelper 통합이나 BalanceValidator+ImbalanceDetectorPanel 통합은 UX 결정 · Day 8-30 인터뷰에서 "어느 기능을 같이 쓰는가" 확인 후 병합 방향 결정
```

#### ☐ Day 1-30 병행 — Airtable Phase 1 (인터뷰 준비하면서 틈틈이)
```
☐ Field 타입 확장 (checkbox/select/multiSelect/date/url/attachment/rating)
   → Column.type 유니온 확장 + 각 타입 렌더러
☐ Import 자동 진단 UI (imbalanceDetector 재활용)
☐ 빈 상태 3-카드 (샘플/템플릿/Excel Import)
```

**성공 기준**: 청소 묶음 4개 + Field 타입 확장 시작 + 인터뷰 아웃리치 20명 리스트

### Day 8-30: 유저 5명 대화 (최우선)
```
☐ 접촉 리스트 20명 (2-hop 거리)
☐ 1:1 개인 컨택 (단체 금지)
☐ 30분 대화 5건 확보
☐ 질문 고정:
   Q1. "지금 밸런싱 어떤 도구 쓰세요?"
   Q2. "가장 고통스러운 순간은?"
   Q3. "월 얼마까지 쓸 수 있어요?"
   Q4. "온프렘이 정말 필수인가요? 왜요?"
   Q5. "통계 보는 빈도는? 주간/월간?"
   Q6. "전투 시뮬 수요가 있나요?"
   Q7. "Excel Add-on vs 독립 앱 중 뭐?"
   Q8. "Airtable 써보셨어요? 게임 기획에 써보거나 고려해본 적? 부족한 점은?"
        (신규 — "Airtable for Game Designers" 포지셔닝 공명 여부 확인)
   Q9. "지금 엑셀/구글시트에서 캐릭터 시트랑 무기 시트 연결하실 때 어떻게 하세요? 안 되는 점은?"
        (신규 — Linked Records 수요 검증)
☐ 각 대화 24시간 내 메모
☐ Day 30: Top 3 패턴 종합 + Airtable 프레이밍 반응 요약
```

### ⚠️ 백엔드는 Day 30 전 착수 금지
유저가 "온프렘 불필요" 응답 시 [`BACKEND_KO.md`](./BACKEND_KO.md) 전체 낭비.
**검증 먼저, 구현은 그 다음.**

### Day 31: 결정
```
☐ 유저 피드백 기반 §3-§6 우선순위 재조정
☐ 백엔드 진행 여부 확정
☐ 시나리오 A/B/C/D 선택 (§8)
```

---

## 8. Day 30 이후 시나리오

### 시나리오 A: "온프렘 + 스냅샷 통계 돈 낸다"
→ Phase 2 진입:
- Month 2-3: Spring Boot 초기화 + MVP API ([BACKEND_KO.md Stage 1-2](./BACKEND_KO.md))
- Month 4-5: 첫 디자인 파트너 스튜디오 설치
- Month 6: MRR $500+ 목표

### 시나리오 B: "성능 필요, 백엔드는 과잉"
→ **축소**:
- 백엔드 없이 브라우저 IndexedDB 스냅샷
- Pro 티어 = "고급 분석 + 클라우드 백업 $5-9"
- BACKEND_KO.md 보류

### 시나리오 C: "전투 시뮬 분석이 진짜 가치"
→ **피봇**:
- 메인 제품을 "게임 시뮬 분석 도구"로 재포지셔닝
- 편집 기능은 부가
- Stage 3 먼저 구현 ([BACKEND_KO.md §11](./BACKEND_KO.md))

### 시나리오 D: "수요 애매"
→ **인디 OSS 유지**:
- B2B 계획 포기, 성능 버그만 수정
- 본업/컨설팅 집중
- BACKEND_KO.md 완전 보류

---

## 9. 중단 기준

| 시점 | 실패 조건 | 행동 |
|---|---|---|
| Day 7 | 성능 수정 실패 | 외부 개발자 도움 또는 범위 축소 |
| Day 30 | 유저 대화 <3건 | 아웃리치 수정, 2주 연장 |
| Day 30 | 5건 중 지불 의사 0 | B2B 계획 철회 (시나리오 D) |
| Day 90 | 백엔드 MVP 미완성 | 브라우저 전용 축소 |
| Day 180 | 유료 고객 0 | 시나리오 D |
| Day 365 | MRR < $500 | 개인 프로젝트 |

---

## 10. 웹 리서치 출처

### 전략 / 포지셔닝
- [B2B SaaS UX Design 2026 (Onething Design)](https://www.onething.design/post/b2b-saas-ux-design)
- [12 UX Mistakes That Kill SaaS Conversion (Raw.Studio)](https://raw.studio/blog/the-12-ux-mistakes-that-kill-saas-conversion/)

### 자체 설명 UX
- [Contextual Help UX 2026 (Chameleon)](https://www.chameleon.io/blog/contextual-help-ux)
- [Tooltip Best Practices 2026 (UXPin)](https://www.uxpin.com/studio/blog/what-is-a-tooltip-in-ui-ux/)
- [Enterprise UX Design 2026 (Fuse Lab)](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/)

### Command Palette
- [Command Palette UX Patterns (Medium)](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [How to build a remarkable command palette (Superhuman)](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)

### 게임 분석 패턴
- [Tencent Games' Event-Driven Analytics](https://thenewstack.io/inside-tencent-games-real-time-event-driven-analytics-system/)
- [AWS Game Analytics Pipeline](https://aws.amazon.com/blogs/gametech/level-up-data-driven-player-insights-with-the-updated-game-analytics-pipeline/)

### 백엔드 기술 (상세는 BACKEND_KO.md)
- [MySQL Time Series 2026 (OneUptime)](https://oneuptime.com/blog/post/2026-03-31-mysql-use-mysql-for-time-series-data/view)
- [Spring Boot CQRS Event Sourcing 2026 (Medium)](https://medium.com/@karunakunwar899/cqrs-event-sourcing-in-spring-boot-68756af665a8)

---

## 부록 A. 이전 문서 요약 (학습 기록)

`archive/` 에 있는 이전 문서들의 핵심 인사이트:

### PRODUCT_STRATEGY_KO.md 에서 살아남은 것
- OSS 닫지 말 것 (1인 발견 경로 상실)
- ~~"살짝 monday.com" 차용~~ → **"Airtable for Game Designers"로 승계** (2026-04-18 리프레이밍). 상태 컬럼은 Phase 1 Field 타입 `select`로 자연스럽게 해결됨.
- "Grid는 Excel처럼 담백, Board/Dashboard는 monday처럼 경쾌" → **"Grid는 Excel 친숙, 다른 View는 Airtable 경쾌"로 승계**

### FEATURE_AUDIT_KO.md 에서 살아남은 것
- 16 패널 → 11-12로 축소
- Calculator + FormulaHelper 통합
- 모바일 뷰잉 전용
- 템플릿 확장 (장르별 5-10개)
- `sync/`, `sdk/` 제거

### UX_REDESIGN_KO.md 에서 살아남은 것
- ⌘K + 상단 검색 + 좌측 사이드바 3-경로
- 빈 상태 3-카드
- "조용한 전문성" 디자인
- Contextual help `?`

### reference/B2B_PLAYBOOK_KO.md (Day 90+ 이후)
- BANT 디스커버리 콜
- POC 설계 체크리스트
- MSA/SOW/LOI 계약서 템플릿
- 한국 VC + 피치 덱
- 디자인 파트너 아웃리치

---

## 부록 B. 오늘 할 일 (2026-04-18 업데이트)

```
1. 캘린더에 Day 30 체크인 등록 (5분)
2. 아래 중 하나 선택, 최소 2시간 집중:
   [A] 90분 청소 묶음 (중복 파일 + authStore + ErrorBoundary + aria-label)
       → git commit 3개로 분리:
         1) chore: rename project to balruno (URLs, LICENSE, exports)
         2) perf: fix O(N²) in computeSheetRows + tests
         3) chore: remove duplicates/authStore + add ErrorBoundary + a11y
   [B] 아웃리치 대상 20명 실제 이름+연락처 작성
3. 다른 모든 작업 금지 (특히 문서 추가 작성 금지)
```

### Week 1 목표 (Day 7 체크)
다음 중 3개 이상:
- [x] 성능 수정 (≤500ms) — ✅ 완료
- [x] 죽은 코드 정리 (sync/sdk) — ✅ 완료
- [x] 브랜드 통일 (balruno.com) — ✅ 완료
- [ ] 90분 청소 묶음 (중복파일/authStore/ErrorBoundary/aria-label)
- [ ] 아웃리치 20명 중 5명 발송

3개 미만 = Week 2 재검토.

---

## 부록 C. 문서 관계도

```
docs/
├── DESIGN_EN.md / DESIGN_KO.md    ← 제품 원본 설계
├── api-spec.md                     ← 과거 API 스펙
└── draft/                          ← 이 폴더 (개인 작업 공간)
    ├── MASTER_PLAN_KO.md  ⭐ 👈 지금 이 문서 (전략 + 프론트 + UX)
    ├── BACKEND_KO.md      ⭐     (Java/Spring/MySQL 백엔드 상세)
    ├── archive/                    (이전 탐색 문서)
    └── reference/                  (B2B_PLAYBOOK 등 Day 90+ 용)
```

**읽는 순서**:
1. 항상 `MASTER_PLAN_KO.md` 먼저
2. 백엔드 관련 작업 시 `BACKEND_KO.md`
3. 영업 단계 진입 시 `reference/B2B_PLAYBOOK_KO.md`

---

*이 문서는 Day 30 유저 대화 결과로 §3-§6 대부분이 재작성된다.*
