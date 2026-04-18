# Balruno 프론트 할 일

> **상위 문서**: [TODO.md](./TODO.md) (전체 맵 + 의존성 트리)
> **동반 문서**: [TODO_BACKEND.md](./TODO_BACKEND.md)
> **최종 업데이트**: 2026-04-18 (Yjs-first + AI 최후 반영)
> **원칙**: 시간 견적 없음. **기술 의존성 + 품질 게이트** 만 추적.
> **🔥 선행 조건**: Track 0 (Yjs 마이그레이션) 이 Track 1~10 의 전제. 먼저 끝내는 게 유리.
> **🎯 최후**: Track 11 (AI) 은 전부 완료 후 얹음.

---

## 1. 현재 상태

### 배포
`https://www.balruno.com` (Next.js 16 + Vercel, MIT 오픈소스)

### 스택
Next.js 16 (App Router · Turbopack) · React 19 · TypeScript strict · Zustand 5 · IndexedDB(idb) · mathjs · Recharts · next-intl(EN/KO) · Tailwind 3.4 · Vercel Analytics

### 완료 자산 (유지)
- 수식 엔진 70+ 함수 (`lib/formulas/` 분할됨)
- 16개 도구 패널 (Track 6 통합 대상)
- Monte Carlo 시뮬 · DPS 분산 · 이코노미 시뮬
- Unity/Unreal/Godot 엔진 Export
- 장르별 템플릿 (RPG/FPS/Idle/Roguelike/MOBA)
- i18n EN/KO · 다크모드 · 모바일 반응형
- Undo/Redo (`historyStore`)
- Auto save + 자동 백업 (IndexedDB 3 stores)
- ErrorBoundary 2단
- 성능 수정 + 29 테스트
- 접근성 `aria-*` 31개

### 저장소 (IndexedDB 3 stores)
- `projects` (by-updated 인덱스)
- `metadata`
- `backups` (timestamp 키, 자동 백업)

---

## 2. 기술 부채 (어느 트랙보다 먼저 정리 권장 OR 트랙 중 겸사겸사)

### 🟡 큰 파일 분해
- `app/page.tsx` (766줄) — god component
- `GrowthCurveChart.tsx` (1,814줄) — 추가 서브컴포넌트 추출 (`CustomSelect`, `ToggleSwitch`, `PreviewCard`, `NumberInput`)

### 🟡 모바일 전략 결정
현재: `MobileHeader` / `MobileSidebar` / `MobileSelectionHandles` / `MobileContextMenu` — 편집 UI 포함
방향 옵션: (a) 뷰잉 전용으로 축소 (편집 코드 삭제) · (b) 편집 유지

### 🟡 테스트 커버리지 확대
현재: `formulaEngine` 29개만.
추가 후보:
- `projectStore` 슬라이스별 smoke test
- `imbalanceDetector` / `balanceAnalysis` / `dpsVarianceSimulator` 숫자 검증
- `gameEngineExport` / `gameEngineImport` 라운드트립

### 🟡 접근성 추가 (현재 31건 → 목표 80+)
- `SheetBody` / `SheetCell` / `SheetHeader` — ARIA grid role + 키보드 네비
- `FormulaBar` / `FormulaAutocomplete` — aria-combobox
- 각 패널 내부 버튼

### 🟡 `authStore` 재평가
현재: `SettingsModal` Cloud Sync 탭만 사용. 백엔드 미구현.
- 백엔드 진행 시 → 유지 + 구현
- 브라우저 완결 (시나리오 D) → 삭제 + Sync 탭 제거

---

## 🔥 Track 0. Yjs 마이그레이션 (최우선 선행)

백엔드 확정이라 **Y.Doc 이 진실의 소스**가 돼야 함. 후속 트랙들이 Y.Doc 위에서 동작해야 서버 sync 가 깔끔.

### 원칙
- Zustand 슬라이스의 **데이터 영역** (projects/sheets/columns/rows/cells) → **Y.Doc** 으로 이관
- Zustand 에는 **UI 상태만 유지** (activeSheet, 모달 오픈, selectedRows, cellSelectionMode 등)
- `storage.ts` 는 하위호환 (기존 유저 데이터 마이그레이션) + 내보내기/백업 용도로만
- `y-indexeddb` provider 가 자동 persistence (트랜잭션 최적화 내장)

### 데이터 구조 매핑
```
Y.Doc (per project)
├─ Y.Map "meta"       — project 메타(name, description, updatedAt)
├─ Y.Array "sheets"   — Sheet[] (각 Sheet 는 Y.Map)
│    └─ Y.Map (per sheet)
│         ├─ "columns" — Y.Array<Column>
│         ├─ "rows"    — Y.Array<Row>
│         │    └─ Y.Map (per row)
│         │         ├─ "cells" — Y.Map<columnId, CellValue>
│         │         ├─ "cellStyles" — Y.Map
│         │         └─ "cellMemos"  — Y.Map
│         └─ "stickers" — Y.Array<Sticker>
└─ Y.Map "folders"    — Folder[]
```

### 체크리스트

#### ✅ 완료 (2026-04-18 스캐폴딩)
- [x] `npm install yjs y-indexeddb` (yjs@13.6.30, y-indexeddb@9.0.12)
- [x] `lib/ydoc.ts` 스캐폴딩
  - `getProjectDoc(id)` — 프로젝트별 Y.Doc 캐시
  - `persistDoc(id)` — y-indexeddb provider 연결
  - `detachDoc(id)` — 메모리 정리
  - `hydrateDocFromProject(doc, project)` — Project → Y.Doc 직렬화
  - `docToProject(doc)` — Y.Doc → Project 역직렬화 (하위호환)
  - `updateCellInDoc(...)` — CRDT 기반 셀 업데이트
  - `updateProjectMeta(...)` — 메타 업데이트
- [x] `lib/ydoc.test.ts` 8개 테스트 (라운드트립/수식/빈값/편집/**CRDT merge**/캐시)
- [x] 기존 29 테스트 전원 통과 유지 (**총 37 테스트**)
- [x] 빌드 + TS 타입 체크 통과

#### ☐ 잔여 (후속 커밋)
- [ ] Y.Doc ↔ Zustand 선택적 구독 어댑터 (`useYDoc` 커스텀 훅 or `useSyncExternalStore`)
- [ ] `stores/slices/cellSlice.ts` 의 `updateCell` 을 Y.Doc write 로 전환 (첫 파일럿)
  - 나머지 action 들은 순차 migration
- [ ] Zustand slices 는 UI 상태만 (selectedRows, cellSelectionMode 등) — 리팩터
- [ ] 기존 `storage.ts` → Y.Doc 초기화 시 마이그레이션 경로
- [ ] `migrateIndexedDBToYDoc()` 일회성 함수 (기존 유저)
- [ ] y-indexeddb provider 통합 테스트 (DOM 환경, vitest + jsdom)
- [ ] Undo/Redo 를 `Y.UndoManager` 로 교체 (기존 `historyStore` 제거 가능)

### Undo/Redo 재구현
Y.Doc 은 `UndoManager` 내장. 기존 `historyStore` 제거 가능.
- [ ] `new Y.UndoManager(ydoc.getArray('sheets'))` 로 교체
- [ ] 프론트 Undo/Redo 훅 연결
- [ ] Undo 단위 병합 (100ms 이내 편집은 한 스텝으로)

### 마이그레이션 전략 (기존 유저)
1. 앱 시작 시 IndexedDB `projects` store 스캔
2. 각 프로젝트를 Y.Doc 으로 변환 → `y-indexeddb` 로 저장
3. 성공하면 구 store 데이터 → `projects_legacy` 로 이관 (즉시 삭제 X, 2버전 유지 후)
4. 버전 플래그 `metadata.migratedToYjs = true`

### 후속 트랙에 미치는 영향
- Track 2 (Linked Records) — Y.Map 기반 양방향 미러링 자연스러움
- Track 8 Stage B (WebRTC) — provider 한 줄 추가로 즉시 P2P 협업
- Track 8 Stage C (WebSocket) — 백엔드 BE-6 완성 후 또 한 줄로 서버 sync
- Track 9 (Interface) — 위젯이 Y.Doc 구독하면 실시간 갱신 자동

---

## Track 1. Field 타입 확장 (11종)

현재 `Column.type: 'general' | 'formula'` (2종) → **11종**

### 기본 7종 (독립, 의존성 0)
- `checkbox` — 불리언 (스킬 활성/비활성, 장비 획득 여부)
- `select` — 단일 선택 (등급, 원소 속성)
- `multiSelect` — 다중 태그
- `date` — 날짜/시간 (패치, 이벤트 스케줄)
- `url` — 참고 링크
- `currency` — 통화 포맷 (가챠/상점 비용)
- `rating` — 별점 (피드백)

### 의존성 있음
- `attachment` — **서버 S3/MinIO 업로드 + IndexedDB 썸네일 캐시** (Firefox blob 성능 문제 회피). 백엔드 BE-1 완료 후 본격 구현
  - 오프라인 시: `pending_uploads` store 에 임시 저장 → 온라인 복귀 자동 업로드
  - 썸네일: 클라이언트에서 300×300 리사이즈 후 IndexedDB 저장 (20KB 이하)
- `lookup` — Track 2 (Linked Records) 완료 후. 연결된 레코드 필드 끌어오기
- `rollup` — Track 2 완료 후. 연결된 레코드 집계 (SUM/AVG/MIN/MAX)

### 체크리스트
- [ ] `types/index.ts`: `ColumnType` 유니온 확장
- [ ] `stores/slices/cellSlice.ts`: `updateCell` 타입별 validation
- [ ] `components/sheet/CellEditor.tsx`: 타입별 에디터 (날짜 피커, 파일 업로더, 별점 등)
- [ ] `components/sheet/SheetCell.tsx`: 타입별 렌더러
- [ ] `components/sheet/ColumnModal.tsx`: 타입 드롭다운 + 타입별 설정 (enum values, 통화 기호 등)
- [ ] `ValidationConfig.allowedValues` + `'select'` / `'multiSelect'` 연결
- [ ] 마이그레이션: 기존 프로젝트 `type` 없으면 `'general'` fallback (이미 됨)
- [ ] Attachment: IndexedDB `attachments` store 추가 (blob + metadata)
- [ ] 각 타입 최소 1 테스트

### Airtable 참고
Airtable 은 20종. Balruno 는 게임 맥락에 불필요한 `phone`/`email`/`barcode`/`QR`/`createdBy`/`lastModifiedBy` 등은 **스킵**. 필요 시 추후 추가.

---

## Track 2. Linked Records (양방향 자동 미러링)

"애매함" 근본 해결. Airtable 표준 방식 복제.

### 현재 문제
`processSheetReferences` (`formulaEngine.ts:743`) 가 하드코딩 휴리스틱:
```ts
const idCol = sheet.columns.find(c =>
  c.name === 'ID' || c.name === '캐릭터ID' || ...
);
```
→ 이름 기반 추측 → 컬럼 이름만 바꿔도 참조 깨짐.

### 목표 (Airtable 표준)
```ts
Column {
  type: 'link';
  linkedSheetId: string;      // 대상 시트
  linkedColumnId: string;     // 대상 PK 컬럼
  relationship: '1-1' | '1-N' | 'N-N';
  reverseColumnId?: string;   // 반대쪽 자동 생성된 컬럼 ID
}
```

### 핵심 원칙: 양방향 자동 미러링
- 캐릭터 시트에서 `무기` 링크 컬럼 추가 → 무기 시트에 `캐릭터` 컬럼 **자동 생성**
- 한쪽 편집 → 반대쪽 즉시 반영
- 삭제 시 양쪽 관계 자동 정리

### 수식 관계 traversal
```
=AVG({캐릭터}.DPS)        // 현재 행의 '캐릭터' 관계 → DPS 컬럼 평균
=IF({장비}.Tier > 3, ...) // 관계 체이닝
={몬스터}.Boss           // 연결된 레코드 접근
```

### 체크리스트
- [ ] `types/index.ts`: `Column.type: 'link'` + 관련 필드
- [ ] `components/sheet/ColumnModal.tsx`: "Link to another table" 드롭다운
  - [ ] 대상 시트 선택
  - [ ] PK 컬럼 자동 감지 or 수동 선택
  - [ ] 관계 유형 선택 (1-1 / 1-N / N-N)
- [ ] 셀 피커 UI: `+` 아이콘 → 레코드 검색 드롭다운 → 선택
- [ ] Reverse column 자동 생성 로직
- [ ] 양방향 변경 동기화 (양쪽 셀 동시 업데이트)
- [ ] 삭제 시 관계 정리 (cascade option)
- [ ] 수식 엔진에 관계 traversal 문법 추가
- [ ] 기존 문자열 참조 (`캐릭터.CHAR_001.DPS`) = deprecated 경고 + 자동 마이그레이션 제안
- [ ] 테스트: 1-1, 1-N, N-N 시나리오 각각

---

## Track 3. Computed Link Fields (lookup / rollup)

Track 2 완료 후 자연 확장.

### lookup
연결된 레코드의 특정 필드를 **읽기 전용**으로 끌어옴.
```
캐릭터 시트
├─ 이름, HP, ATK
└─ 장비(link to 장비)
    ↓ lookup
    └─ 장비_이름 (장비.이름 자동 표시)
```

### rollup
연결된 레코드들을 **집계**.
```
캐릭터 시트
├─ 이름, HP
└─ 스킬들(link to 스킬, 1-N)
    ↓ rollup
    └─ 총_데미지 (SUM(스킬.데미지))
    └─ 스킬_수 (COUNT(스킬))
```

### 체크리스트
- [ ] `Column.type: 'lookup'` + `sourceColumnId`
- [ ] `Column.type: 'rollup'` + `sourceColumnId` + `aggregateFn` (SUM/AVG/MIN/MAX/COUNT/CONCAT)
- [ ] 수식 엔진에 lookup/rollup 평가 추가
- [ ] UI: 컬럼 생성 시 "Lookup" / "Rollup" 선택 → 대상 link 컬럼 + 원천 필드 + 집계 함수
- [ ] 순환 참조 방지 (link 체인)
- [ ] 테스트

---

## Track 4. View 다양화

### 기술 결정 포인트
**`shadcn-data-views` 평가 먼저** (2026-01 출시, 단일 JSON 스키마 → Grid/Kanban/Gallery/Calendar/Form 자동 생성).
- [ ] 설치 + 샘플 실행
- [ ] Balruno 의 `Sheet` / `Column` / `Row` 스키마와 호환성 확인
- [ ] shadcn UI 다른 컴포넌트 필요 여부 확인
- [ ] 호환되면 → 베이스로 채택, 커스텀만 추가
- [ ] 호환 안 되면 → 직접 구현

### 4.1 Kanban (select 필드 필요 = Track 1)
- 칼럼 = select 필드의 옵션들 (기획중/구현중/테스트/런칭)
- 카드 = 레코드
- 드래그로 상태 전환 → select 필드 업데이트
- 체크: 칼럼 WIP 제한, 스웜레인 (2차 그룹핑)

### 4.2 Calendar (date 필드 필요)
- date 필드 기준 월/주/일 뷰
- 드래그로 날짜 변경
- 색상 = select 필드 값
- 체크: 반복 이벤트, 시간대 처리

### 4.3 Gallery (attachment 필드 필요)
- 첫 attachment 가 카드 이미지
- 카드 크기 조절
- 필드 선택적 표시
- 체크: 이미지 로딩 최적화, 가상 스크롤

### 4.4 Gantt / Timeline (date + duration 필요)
- start_date + end_date (또는 start + duration)
- 의존성 선 그리기
- 드래그로 기간 변경
- 체크: 마일스톤, critical path

### 4.5 Form (독립, 언제든 가능)
- 레코드 생성 폼 자동 생성
- 컬럼 순서/표시 커스텀
- 외부 공유 링크 (Track 8 권한과 연계)

### 4.6 뷰 공통 기능
- [ ] View 스위처 UI (상단 탭)
- [ ] 뷰 저장 (시트당 여러 뷰)
- [ ] 필터 / 정렬 / 그룹핑 (각 뷰 공통)
- [ ] 공유 링크 (뷰 단위)

---

## Track 5. ⌘K Command Palette

### 라이브러리: `cmdk` (Linear/Raycast 사용)

### 인덱스 대상
- 모든 시트 (프로젝트 + 시트명 + 최근 편집)
- 모든 컬럼 (시트.컬럼명 + 타입)
- 모든 수식 함수 (`availableFunctions` — 이름 + 설명 + 예제)
- 모든 도구/패널
- 설정 항목 (테마, 언어, 단축키 등)
- 최근 액션 (열었던 시트, 실행한 시뮬 등)

### 진입
- `Cmd/Ctrl + K`
- 상단 네비에 힌트 ("⌘K로 검색")

### 명령 카테고리
```
Navigate:     시트 열기, 프로젝트 전환, 패널 열기
Create:       새 시트, 새 컬럼, 새 행
Calculate:    수식 검색, 계산 실행
Tools:        각 도구 패널 열기
Settings:     테마 전환, 언어 전환
Recent:       최근 열었던 항목
```

### 체크리스트
- [ ] `npm install cmdk`
- [ ] `components/CommandPalette.tsx` — 전역 ⌘K 리스너
- [ ] 각 카테고리별 아이템 provider (함수 → Command.Item[])
- [ ] 퍼지 매칭 (cmdk 내장)
- [ ] 키보드 네비 (↑/↓/Enter/Esc)
- [ ] 아이템 > 2000개 대비 가상화 (react-window)
- [ ] 검색 디바운스 (API 호출 있으면)
- [ ] ⌘K 힌트 UI (상단)
- [ ] 단축키 힌트 (각 아이템 오른쪽)
- [ ] 테스트

---

## Track 6. 패널 통합 + 도킹 레이아웃

### 현재: 17 플로팅 패널
리서치 결론 (Figma 2026 UI3 사례): **플로팅 < 도킹**.

### 목표: 3-zone 도킹 레이아웃
```
┌─ Topbar: 프로젝트명 · ⌘K · 뷰 스위처 · 공유 ─────────────┐
├── Left ───── Center: Grid/Kanban/Calendar/... ─────── Right ───┤
│ 프로젝트   │                                               │ 컨텍스트 │
│ 시트       │   현재 선택된 뷰 (탭 전환)                    │ · 수식   │
│ 폴더       │                                               │ · 분석   │
│ ⌘K 힌트    │                                               │ · 검증   │
└────────────┴───────────────────────────────────────────────┴─────────┘
```

### 17 → 9 통합 (역할 기반)
| 통합 후 | 포함된 기존 패널 | 역할 |
|---------|-----------------|------|
| **Formula Workbench** | Calculator + FormulaHelper + FormulaPresetPicker | 수식 작업 (우측 탭 3개) |
| **Balance Insights** | BalanceValidator + ImbalanceDetectorPanel + BalanceAnalysisPanel | 밸런스 분석 (우측 탭 3개) |
| **Simulation** | SimulationPanel + DPSVariancePanel | 시뮬 (우측 탭 2개) |
| **Economy** | EconomyPanel | 이코노미 |
| **Charts** | ComparisonChart + GrowthCurveChart | 시각화 (우측 탭 2개) |
| **Curve Fitting** | CurveFittingPanel | 회귀 피팅 |
| **Entity Generator** | EntityDefinition | 엔티티 생성 |
| **Difficulty Curve** | DifficultyCurve | 난이도 곡선 |
| **Goal Solver** | GoalSolverPanel | 역산 |
| (사이드바 흡수) | SheetSelector | 좌측 네비로 |
| (모달) | TemplateSelector | 전역 "새 시트" 버튼 |

### 체크리스트
- [ ] 새 `app/layout.tsx` 레이아웃 구조 (좌/중/우 grid)
- [ ] 좌측 사이드바 — 기존 프로젝트 네비 유지
- [ ] 우측 사이드바 — 탭 시스템, 활성 시 접힘/펼침
- [ ] 각 도구 패널을 탭 컨텐츠로 마이그레이션
- [ ] 기존 `DraggablePanel` 제거
- [ ] 통합 도구 탭 구조 (Formula Workbench 3개 내부 탭 등)
- [ ] 모바일 반응형 재작업
- [ ] 기존 플로팅 좌표 state 제거 (toolLayoutStore)

---

## Track 7. Import 자동 진단 UI

기존 자산 재활용: `lib/imbalanceDetector.ts`

### 체크리스트
- [ ] `components/modals/ImportModal.tsx`: Excel/CSV 붙여넣기 후 자동 `imbalanceDetector` 실행
- [ ] 결과 카드 UI: "밸런스 23% 과대 감지", "데드존 3곳 발견" 요약
- [ ] "상세 보기" → `Balance Insights` (Track 6) 열기
- [ ] i18n 메시지 EN/KO
- [ ] 빈 상태 3-카드 (WelcomeScreen):
  - [ ] "샘플 프로젝트" (기존)
  - [ ] "장르 템플릿" (기존 TemplateSelector)
  - [ ] "Excel에서 가져오기" (신규 진입점)

---

## Track 8. 협업 (Yjs CRDT)

### Stage A — Local Yjs + IndexedDB
**→ Track 0 과 동일**. 위 Track 0 참조. 이게 완료되면 Stage B 로 즉시 이어짐.

### Stage B — WebRTC P2P (백엔드 없이)
브라우저끼리 직접 연결. 시그널링 서버만 필요.
- [ ] `npm install y-webrtc`
- [ ] 공용 y-webrtc 신호서버 먼저 (수요 확인 전)
- [ ] 자체 호스트 필요 시: `PORT=4444 node ./bin/server.js` (1파일)
- [ ] 룸 ID = 프로젝트 ID + 공유 해시
- [ ] Presence (Yjs awareness API — 내장):
  - 커서 위치 (셀 좌표)
  - 선택 범위
  - 유저 이름 + 아바타 + 해시 컬러
  - `lastActive` 타임스탬프
- [ ] **4명 이상 UI**: 활성 커서 최대 4명, 나머지 "+N more" 뱃지
- [ ] **30초 유휴 커서 자동 숨김**
- [ ] Comments + @mentions (Y.Map `commentsByCell`)
- [ ] Row locks (옵션, 편집 충돌 방지)
- [ ] Follow mode (특정 유저 클릭 → 그 사람 화면 영역 따라감)

### Stage C — WebSocket + 서버
→ [TODO_BACKEND.md Track 6](./TODO_BACKEND.md#track-6-실시간-yjs-websocket)
- [ ] `npm install y-websocket`
- [ ] provider 추가 (1줄): `new WebsocketProvider(serverUrl, projectId, ydoc)`
- [ ] JWT 인증 (쿼리 파라미터)
- [ ] 서버 권한 (view/edit/admin) 적용

### 권한 모델
- Stage B: "링크 있는 사람 편집" (URL 해시 기반, 서버 없음)
- Stage C: 서버 권한 (viewer / commenter / editor / admin)

---

## Track 9. Interface Designer / Dashboard Builder

Airtable Interface Designer 스타일. 사용자가 **커스텀 대시보드** 를 드래그앤드롭으로 빌드.

### 전제
- Track 1 (Field 타입) 완료 — 위젯이 필드를 읽음
- Track 2 (Linked Records) 완료 — 여러 시트 데이터 집계
- Track 4 (View) 완료 — 뷰를 위젯으로 임베드

### 구성 요소

#### 위젯 종류
- **Chart** — bar / line / pie / scatter / area (Recharts 활용)
- **Metric Tile** — 큰 숫자 + 레이블 + trend arrow
- **Table 임베드** — 필터 적용된 Grid 뷰 축소본
- **Kanban 임베드** — 다른 뷰 축소본
- **Text 블록** — 마크다운 설명
- **Image / Gallery** — attachment 컬럼 기반
- **Button** — Automation (Track 10) 트리거
- **Filter Controls** — 드롭다운/슬라이더 → 모든 위젯에 필터 전파

#### 레이아웃
- 그리드 기반 (12 칼럼 등)
- 드래그로 크기 조절
- 반응형 (데스크톱/태블릿/모바일)
- 조건부 표시 (사용자 필터에 따라 위젯 숨김)

#### 저장/공유
- 한 Base(프로젝트)에 여러 Interface 저장
- Interface 공유 링크 (view-only)
- Interface 템플릿 (장르별: RPG 캐릭터 대시보드, FPS 무기 비교 등)

### 체크리스트
- [ ] `types/interface.ts` — `Interface` / `Widget` / `Layout` 타입 정의
- [ ] 저장소: `projects.interfaces: Interface[]` 필드
- [ ] 드래그앤드롭 라이브러리 선택 (`react-grid-layout` or custom)
- [ ] 각 위젯 컴포넌트 개별 구현
- [ ] 위젯 설정 패널 (우측 사이드바에서)
- [ ] 필터 컨트롤 → 전역 필터 상태 → 위젯에 전파
- [ ] 반응형 레이아웃
- [ ] Interface 공유 링크 (Track 8 권한 연계)
- [ ] 템플릿 5-10개 (장르별)
- [ ] 테스트: 10개 위젯 동시 렌더링 성능

### 선택 확장
- **AI 자동 생성** — "캐릭터 밸런스 대시보드 만들어줘" → AI 가 위젯 배치 (Track 11)

---

## Track 10. Automations

레코드 변경 또는 일정 기반으로 액션 자동 실행.

### Trigger
- **Field updated** — 특정 필드가 특정 값으로 바뀔 때
- **Record created** — 새 레코드 추가 시
- **Record matches condition** — 필터 만족 시
- **Scheduled** — 매일/매주/특정 시각
- **Button** — 수동 트리거 (Interface 의 Button 위젯)
- **Webhook** — 외부에서 호출 (옵션, 서버 필요)

### Condition
- 필터 로직 (AND/OR 트리)

### Action
- **Update field** — 다른 필드 값 변경
- **Create record** — 새 레코드 (다른 시트 가능)
- **Delete record**
- **Send notification** — 브라우저 알림 or 이메일 (서버 필요)
- **Run formula** — 수식 실행 → 필드에 결과
- **Trigger another automation** — 체이닝
- **External API call** — 웹훅 POST (옵션)

### UI
**시각 에디터** (n8n / Zapier 스타일):
```
[Trigger: Field "상태" = "완료"]
  ↓
[Condition: Tier >= 3]
  ↓
[Action 1: 다른 시트에 알림 레코드 생성]
  ↓
[Action 2: @PD 멘션 댓글 추가]
```

### 체크리스트
- [ ] `types/automation.ts` — 타입 정의
- [ ] 저장소: `projects.automations: Automation[]`
- [ ] 런타임 엔진: 상태 변화 구독 → 조건 평가 → 액션 실행
- [ ] 시각 에디터 UI (노드 그래프)
- [ ] 트리거별 구현 (field / record / scheduled / button / webhook)
- [ ] 액션별 구현
- [ ] 실행 로그 UI ("Automation 실행 이력")
- [ ] 무한 루프 방지 (체이닝 깊이 제한)
- [ ] 에러 핸들링 + 재시도
- [ ] 테스트

---

## 🎯 Track 11. AI 기능 — **맨 마지막 얹음**

> Track 0~10 전부 완료 후에만 착수. 먼저 하면 AI 가 조작할 표면이 부족해서 가치 낮음.

최상위 레이어. 다른 트랙 완료 후 가치 발휘.

### 자연어 수식 (NL → formula)
"공격력에 크리율 반영" → `=DPS(ATK, 1, CRIT_RATE, CRIT_DMG)` 제안
- Claude API 호출 → 사용 가능한 함수 + 현재 컬럼 context 전달 → 수식 생성

### 자연어 쿼리
"DPS 상위 10 캐릭터" → 필터 + 정렬 자동 구성
- HogQL / SQL 같은 DSL 로 변환

### AI 대시보드 자동 생성
"캐릭터 밸런스 대시보드 만들어줘" → Track 9 위젯 자동 배치
- Airtable Omni 참고

### AI 필드 제안
"기존 데이터 보고 필요한 컬럼 제안해줘" → AI 가 스키마 분석 → "시장 가치 컬럼 있으면 좋을 것 같아요"

### AI 밸런스 리뷰
`imbalanceDetector` 결과를 AI 가 자연어로 해설:
```
Z-score 4.2: 캐릭터 "드래곤"의 HP가 과도합니다.
비슷한 티어 캐릭터 평균 HP: 3,500
드래곤 HP: 7,200 (약 2배)
권장: 5,000~5,500 범위로 조정
```

### 기술 선택
- **Vercel AI SDK v6** (2025-12) — 25+ 프로바이더 2줄로 교체 가능
- **Next.js 16.2 Agent DevTools** — AI 통합 디버깅 기본 탑재
- **모델**: Claude (품질) + Gemini 2.5 Flash (최속 180ms) + GPT fallback
- **React Server Actions 지향**: `/api/chat` 엔드포인트 대신 서버 액션

### NL → 수식 5단계 validator 파이프라인 (환각 방지)
```
User: "공격력 + 방어력의 50%"
  ↓
1. 서버 LLM 호출 (API 키 보안 — 서버에서만)
   프롬프트에 스키마 주입: 현재 시트 컬럼 + availableFunctions
  ↓
2. LLM 응답: "=ATK + DEF * 0.5"
  ↓
3. validateFormula(response) — 문법 체크
   ├─ 실패 → 에러 LLM 에 피드백 → 재시도 (최대 3회)
   └─ 통과
  ↓
4. extractColumnReferences(formula) — 참조 컬럼 존재 검증
  ↓
5. Sandbox dry-run (샘플 데이터 1행으로 평가)
   ├─ 런타임 에러 → 재시도
   └─ 통과
  ↓
6. 유저 확인 UI: "이 수식 적용?" (자동 저장 금지)
```

### 체크리스트
- [ ] Vercel AI SDK v6 설치
- [ ] **서버 측 LLM 호출** (API 키 보안, 프론트 직접 호출 금지)
- [ ] Rate limit — 유저당 토큰 한도 (무료 100k / Pro 1M / Team 10M)
- [ ] Audit log — 모든 프롬프트+응답+선택 기록
- [ ] `lib/ai/formula.ts` — NL → formula (5단계 validator)
- [ ] `lib/ai/query.ts` — NL → 필터/정렬
- [ ] `lib/ai/dashboard.ts` — NL → 위젯 배치 (Track 9 스키마 출력)
- [ ] `lib/ai/review.ts` — 밸런스 해설 (imbalanceDetector 결과 자연어화)
- [ ] 프롬프트 엔지니어링 (게임 도메인 컨텍스트 주입)
- [ ] 스트리밍 UI (수식 생성 실시간 표시)
- [ ] 모델 fallback (Claude 503 → Gemini → GPT)
- [ ] Goldset 회귀 테스트 (50개 NL→formula 쌍, 모델 버전업 시 정확도 회귀 감지)

---

## 3. 공통 품질 게이트

매 커밋마다:
```bash
npm run lint       # ESLint
npm test -- --run  # Vitest
npm run build      # Next 16 build + TypeScript check
```

모두 통과해야 merge.

---

## 4. 트랙 종속성 요약 (백엔드 확정 + Yjs 선행 반영)

```
기존 자산
    │
    ├─── 🔥 Track 0 (Yjs 마이그레이션) ━━━━━━━━━━━━━━━
    │     │  모든 데이터 트랙의 전제                     │
    │     │                                               │
    │     ├── Track 1 (Field 타입)                       │
    │     │     ├── attachment → 서버 업로드 + 썸네일      │
    │     │     │                   (BE-1 필요)          │
    │     │     └── 나머지 6종 독립                       │
    │     │                                               │
    │     ├── Track 2 (Linked Records) ← Track 1 필요    │
    │     │     └── Track 3 (Lookup/Rollup) ← Track 2   │
    │     │                                               │
    │     ├── Track 4 Kanban ← select (Track 1)         │
    │     │     Calendar ← date (Track 1)               │
    │     │     Gallery ← attachment (Track 1 + BE-1)   │
    │     │     Gantt ← date (Track 1)                  │
    │     │     Form ← 독립                              │
    │     │                                               │
    │     ├── Track 8 Stage B (WebRTC) ← Track 0 필요    │
    │     ├── Track 8 Stage C (WebSocket) ← BE-6 필요    │
    │     │                                               │
    │     └── Track 9/10 ← Track 1+2+4 필요              │
    │                                                     │
    ├─── Track 5 (⌘K) 독립, 언제든 ━━━━━━━━━━━━━━━━━━━
    ├─── Track 6 (도킹) 독립, 언제든 ━━━━━━━━━━━━━━━━━
    ├─── Track 7 (Import 진단) 독립, 언제든 ━━━━━━━━━━
    │
    └─── 🎯 Track 11 (AI) — 위 전부 완료 후 맨 마지막
```

### 동시 시작 가능 (Track 0 과 병렬)
Track 5, 6, 7 — 데이터 모델과 독립적이라 Yjs 이관 중에도 진행 OK.

### Track 0 완료 후 즉시
Track 1, 8 Stage B — Y.Doc 위에서 자연스럽게 동작.

### 🎯 맨 마지막
Track 11 AI — 다른 모든 트랙 완료 후 얹음.
