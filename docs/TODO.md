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

### 완료된 것 (2026-04-18)
1. ✅ `formulaEngine` O(N²) 버그 수정 (WeakMap 캐시, 29 테스트)
2. ✅ `sync/`, `sdk/` 죽은 코드 제거
3. ✅ 브랜드 통일 (balruno.com 도메인 + GitHub 레포 + Vercel + LICENSE)
4. ✅ 정체성 프레이밍: "Airtable for Game Designers"
5. ✅ `formulaEngine` 카테고리 분리 (1,970 → 1,418줄, 신규 `lib/formulas/` 6파일)
6. ✅ `projectStore` 슬라이스 분해 (1,259 → 208줄, 신규 `stores/slices/` 4파일)
7. ✅ ErrorBoundary 추가 (app/error.tsx + global-error.tsx)
8. ✅ 접근성 `aria-*` 31개
9. ✅ 중복 파일 10개 정리
10. 🔥 **Track 0 완료** — Yjs 마이그레이션 전체 (Phase 1+2+3+4)
    - ydoc.ts 27 helper (Sheet/Column/Row/Cell/Sticker/Folder)
    - 모든 slice write 액션 Y.Doc 경유
    - Y.UndoManager 로 historyStore 교체 (500ms merge)
    - y-indexeddb persist + 자동 마이그레이션 (storage.ts → Y.Doc)
    - 42 테스트 통과 (13 ydoc tests + 29 formulaEngine tests)

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

## 4. 트랙별 우선순위 (의존성 충족 순)

### 🔥 최우선 선행 (다른 모든 트랙의 전제)
- **Track 0 (= Track 8 Stage A)** — Yjs Y.Doc 마이그레이션
  - 백엔드 확정이라 이걸 먼저 해야 나중에 모든 트랙을 두 번 짤 필요 없음
  - Zustand 데이터 슬라이스 → Y.Doc, Zustand는 UI 상태만
  - y-indexeddb provider 로 오프라인 캐시

### 동시 시작 가능 (Track 0 과 독립)
이 트랙들은 Y.Doc 채택 여부와 무관하게 착수 가능, 백엔드와도 독립:
- Track 5 (⌘K Command Palette)
- Track 6 (패널 통합 + 도킹 레이아웃)
- Track 7 (Import 자동 진단)
- 기술 부채 정리 (god component 분해 등)

### Track 0 완료 후 시작
- Track 1 (Field 타입 확장) — 기본 7종, Attachment 는 백엔드 S3 업로드
- Track 4 Form (독립, Field 있으면 OK)

### Track 1 일부 완료 후
- Track 2 (Linked Records)
- Track 4 Kanban (select 필요)
- Track 4 Calendar (date 필요)
- Track 4 Gallery (attachment 필요)
- Track 4 Gantt (date 필요)

### Track 2 완료 후
- Track 3 (Lookup/Rollup)

### 백엔드 (전부 active, 동시 진행 가능)
- BE-1 (Auth/CRUD) 부터 순서대로, BE-6 (y-websocket) 는 Track 0 후
- BE-7 (온프렘) 는 BE-1~6 전부 후

### Track 8 Stage B (WebRTC)
- Track 0 완료 후 언제든. 백엔드 없이도 P2P 협업 가능.

### Track 8 Stage C (WebSocket)
- Track 0 + BE-6 완료 후. provider 한 줄 추가로 연결.

### Track 1 + 2 + 4 완료 후
- Track 9 (Interface Designer)
- Track 10 (Automations) — Track 2 유용

### 🎯 맨 마지막
- **Track 11 (AI)** — 위 모든 트랙 완료 후 얹음

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

## 8. 오늘 할 일

```
우선순위 정렬 (백엔드 확정 반영):

【A】🔥 Track 0 — Yjs 마이그레이션 착수
    TODO_FRONTEND.md Track 8 Stage A 체크리스트
    모든 후속 트랙의 전제. 먼저 하는 게 최종적으로 가장 빠름.

【B】Track 5/6/7 중 하나 (Track 0 과 독립, 병행 가능)
    - Track 5: ⌘K — shadcn-data-views 호환성 확인 먼저
    - Track 6: 패널 도킹 — 체감 효과 큼
    - Track 7: Import 진단 — 기존 자산 재활용이라 빠름

【C】백엔드 BE-1 (Auth + CRUD) 착수
    TODO_BACKEND.md Track 1 체크리스트
    Track 0 와 독립적으로 진행 가능. 데이터 형식은 Y.Doc 직렬화 기반.

품질 게이트: 매 커밋 lint + test + build 통과.
```

---

## 9. 웹 리서치 출처 요약

- **Airtable** — 필드 20종, Linked Records 양방향 자동 미러링 (1:1/1:N/N:N), Interface Designer 드래그앤드롭 + AI 생성 (Omni, 2026)
- **Linear** — ⌘K 중심 UX, AI-native, 2026-03 UI 리디자인
- **Notion** — Dashboard view 2026-03 추가, 카드/차트/메트릭 타일
- **Figma** — 2026-01 UI3 사용자 반란 → Fixed panels 복귀 → **도킹 > 플로팅 공식 확인**
- **shadcn-data-views** — 2026-01 신규, JSON 스키마 → 5개 뷰 자동 생성
- **Yjs** — IndexedDB + WebRTC/WebSocket. Tiptap, Excalidraw 검증
- **cmdk** — Linear/Raycast 백본. React 18, 2000-3000 아이템까지 성능 OK
- **Machinations** — 50K+ 게임 개발자, 300+ 스튜디오, 노드 그래프 패러다임
- **Balancy** — Unity 전용 데이터 관리 + 런타임 배포
- **BalanceGraph** — Unity Editor 노드 기반 Monte Carlo 시뮬

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
