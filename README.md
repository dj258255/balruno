<p align="center">
  <img src="packages/web/public/icon.svg" alt="Balruno Logo" width="120" height="120">
</p>

<h1 align="center">Balruno</h1>

<p align="center">
  <strong>Game Studio Workspace — Balance Data + Agile Tickets + Epic Roadmaps in One</strong>
</p>

<p align="center">
  <em>Codecks meets Airtable — for game studios from solo creators to 30+ teams</em>
</p>

<p align="center">
  <a href="https://balruno.com">
    <img src="https://img.shields.io/badge/Live%20Demo-Visit%20Site-blue?style=for-the-badge" alt="Live Demo">
  </a>
</p>

<p align="center">
  <a href="https://balruno.com">
    <img src="https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel" alt="Vercel">
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white" alt="Electron 41">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white" alt="Turborepo 2">
  <img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Frontend-MIT-green.svg" alt="Frontend: MIT">
  <img src="https://img.shields.io/badge/Backend-AGPL%20v3-orange.svg" alt="Backend: AGPL v3">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#한국어">한국어</a>
</p>

---

![Screenshot](docs/images/intro.png)

## English

### What is Balruno?

An open-source collaborative spreadsheet + doc workspace, focused on **game balancing**. Real-time sync, doc threads with @mentions, full undo/redo, mobile-aware. Solo creators today, planned ML/AI differentiation for game-balance specific use cases.

- **Real-time spreadsheet** — server-canonical wss op log with version-vector reconciliation
- **Tiptap doc bodies** — Hocuspocus (yjs CRDT) + y-indexeddb offline cache
- **Comments + @mentions** — sheet cells + doc body range-anchored highlights, inbox bell
- **Full undo/redo** — every op type (cell.update / row.* / column.* / tree.*) with multi-user isolation

**Open source: client MIT, backend AGPL v3. Self-host friendly (single Postgres + JVM + Hocuspocus). Cloud SaaS planned.**

### Shipped Features

#### Spreadsheet
| Category | Features |
|----------|----------|
| **Field Types** | 12 — text · formula · checkbox · select · multi-select · date · url · currency · rating · link · lookup · rollup |
| **Grid View** | Virtualized rows (TanStack Virtual), sticky header + first column on mobile, drag-drop column reorder |
| **Formula Engine** | mathjs + @formulajs — game-specific (DPS, EHP, TTK, SCALE, DIMINISH, etc.) |
| **Linked Records** | Bidirectional links across sheets with reverse column auto-creation |
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z covers cell.update / row.* / column.* / tree.* — ADR 0021 |

#### Document
| Category | Features |
|----------|----------|
| **Editor** | Tiptap + StarterKit + Placeholder + collaboration (yjs) |
| **Real-time** | Hocuspocus server + collaboration-cursor extension |
| **Offline** | y-indexeddb cache (Outline / AFFiNE pattern) |
| **Tree** | Sheet tree + Doc tree (separate hierarchies, drag-drop, cycle guard) |

#### Collaboration
| Category | Features |
|----------|----------|
| **Sync** | Server-canonical wss op log (sheet/tree) + Hocuspocus (doc bodies, yjs CRDT) — ADR 0008 |
| **Presence** | Sheet cell awareness via wss + doc cursor via Hocuspocus awareness |
| **Comments** | Sheet cell + doc body (range-anchored highlights) — ADR 0024 |
| **@mentions** | Tiptap mention extension + inbox bell + per-mention notification — ADR 0024 |

#### Platform
| Category | Features |
|----------|----------|
| **Auth** | OAuth-only (GitHub + Google) + JWT session cookie — no SMTP dependency |
| **Workspaces** | Multi-tenant with role-based access (Owner / Admin / Editor / Viewer) |
| **Projects** | Per-workspace, with member invites + role management |
| **Mobile** | Sidebar drawer + sticky first column + iOS 16px input + 44px hit targets — ADR 0022 |
| **Desktop** | Native Mac / Windows / Linux app (Electron 41 + auto-update via GitHub Releases) |
| **i18n** | UI + 12-group starter pack catalog fully translated (en, ko) |
| **Observability** | Sentry SaaS (env-gated, optional for self-host) |

### Planned (next 6 months)

| ADR | Feature | Status |
|---|---|---|
| **0023** | AI integration (BYOK Anthropic / OpenAI / Gemini / Ollama) | Accepted, Stage 1 = Spring AI 본진 module |
| **0025** | ML capabilities — outlier detection, cluster visualization, curve fit, TrueSkill, embedding similarity | Draft |
| **0008 v2.2** | Cell style sync (currently Y.Doc local-only) | TBD |
| (TBD) | Re-introduce additional views (Kanban / Calendar / Gantt) on top of server-canonical sync | TBD |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/dj258255/balruno.git
cd balruno

# Install all workspace dependencies (monorepo via Turborepo)
npm install

# Run the web app
cd packages/web && npm run dev
# → http://localhost:3000

# Or run the desktop app (Electron)
cd packages/desktop && npm run dev
```

### Formula Examples

```javascript
// Combat formulas
=DPS(atk, speed, crit, critDmg)    // Damage per second with crit
=EHP(hp, def)                       // Effective HP
=TTK(hp, dps)                       // Time to kill
=DAMAGE(atk, def)                   // Damage calculation

// Scaling formulas
=SCALE(base, level, rate, "exp")    // Exponential level scaling
=DIMINISH(value, soft, hard)        // Diminishing returns

// Reference formulas
=REF("Monsters", "Goblin", "HP")    // Cross-sheet reference
```

### Tech Stack

```
Monorepo             Turborepo + npm workspaces
Web frontend         Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict
State                Zustand 5
Doc body cache       y-indexeddb (Outline / AFFiNE pattern, offline-friendly)
Styling              Tailwind CSS 3.4
Charts               Recharts
Math engine          mathjs + @formulajs/formulajs
i18n                 next-intl (en, ko — UI strings + 12-group starter pack catalog)
Desktop              Electron 41 (ESM) + electron-builder + electron-updater
Backend              Java 25 + Spring Boot 4 + PostgreSQL 18 (JSONB) · Hibernate 7
Sync                 Wss op log (sheet/tree) + Hocuspocus (doc bodies, yjs CRDT)
Auth                 OAuth2 (GitHub + Google) · JWT session cookie
Observability        Sentry SaaS (env-gated, optional for self-host)
Hosting              Vercel (web) + OCI (backend, $0 free tier) + Cloudflare (proxy + R2)
```

### Project Structure

```
balruno/
├── packages/
│   ├── web/                  # Next.js web app (MIT)
│   │   ├── src/{app,components,hooks,stores,lib}
│   │   ├── messages/         # i18n (en.json, ko.json)
│   │   └── public/
│   ├── shared/               # Platform-agnostic shared code (MIT)
│   │   └── src/{types,lib}   # formulaEngine, simulation, templates, formulas, ...
│   ├── desktop/              # Electron app (MIT)
│   │   └── src/{main,preload}
│   ├── backend/              # Spring Boot 4 (AGPL v3) — auth, sync, sheet/tree mutations, template import
│   └── collab/               # Hocuspocus server (AGPL v3) — yjs doc body sync
├── docs/                     # Public docs (MIT)
├── LICENSE                   # Repository license overview
├── LICENSING.md              # User-friendly licensing FAQ
├── TRADEMARK.md              # Name & logo policy
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

### Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

1. Fork the repository
2. Create a feature branch
3. Commit your changes (write commit messages and code comments in English)
4. Push to your branch
5. Open a Pull Request

### Roadmap

**Done**
- Monorepo (Turborepo + web / shared / desktop / backend / collab)
- Electron desktop app (Mac / Windows / Linux + auto-update via GitHub Releases)
- Spring Boot 4 backend (AGPL v3) — OAuth, JWT, workspace + project + sheet/tree CRUD
- Server-canonical wss sync (4 regions: sheet cells, sheet tree, doc tree, doc body via Hocuspocus) — ADR 0008
- Real-time presence (sheet cell awareness via wss + doc cursor via Hocuspocus awareness)
- Workspace + project lifecycle — create, list, delete with role-based access (Owner / Admin / Editor / Viewer)
- Member invites + role management
- Starter pack — 12 game-domain catalog groups (RPG / FPS / MOBA / RTS / Idle / Roguelike / Sprint / Bug Tracker / Roadmap / Playtest / Tutorial / Blank)
- Template import — graft any starter group onto an existing project
- i18n — UI + starter catalog fully translated (en, ko)
- Sentry observability (env-gated, free tier)
- **Undo / redo** — full op coverage (cell / row / column / tree) — ADR 0021
- **Comments + @mentions** — sheet cells + doc body (range-anchored highlights via Tiptap Decoration plugin), inbox bell — ADR 0024
- **Mobile UX** — sidebar drawer + sticky first column + iOS 16px input + 44px hit targets — ADR 0022 (Stage A / B partial / E)
- **v0.6 Y.Doc cleanup** — legacy local-mode + 294 dead files removed (-77K lines), only server-canonical mode remains — ADR 0008 §10

**Next (planned, ~6 months)**
- AI integration (BYOK Anthropic / OpenAI / Gemini / Ollama / OpenRouter) — ADR 0023
- ML capabilities — outlier detection · cluster visualization · curve fit · TrueSkill · embedding similarity — ADR 0025
- Cell style sync (server-canonical migration of remaining Y.Doc-local cell styling)
- Re-introduce additional views (Kanban / Calendar / Gantt) on top of server-canonical sync
- Share links per view (read-only)
- Webhook integrations (GitHub / Discord)

**Pricing (tentative — finalized after beta)**
- **Free / self-host** — unlimited (MIT for client + AGPL v3 for backend, run anywhere)
- **Cloud Free** — strict quotas (rows/sheet 2k · history 14d · AI 0/BYOK · undo session-only)
- **Cloud Pro** — quotas lifted, persistent undo (14-day server-backed), optional cloud-paid AI pool (price TBD after beta validation)
- **Team** — collaboration + members + SSO + 90-day persistent undo + audit log export (price TBD)

### License

This repository uses different licenses per directory. See [LICENSE](LICENSE) for the overview and [LICENSING.md](LICENSING.md) for a user-friendly FAQ.

- `packages/web/`, `packages/shared/`, `packages/desktop/` — **MIT**
- `packages/backend/`, `packages/collab/` — **AGPL v3**
- Trademarks (PowerBalance / balruno / logo) — see [TRADEMARK.md](TRADEMARK.md)

For commercial licensing inquiries: dj258255@naver.com

### Links

- [Live Demo](https://balruno.com)
- [Self-hosting Guide](docs/SELF_HOSTING.md)
- [Backend overview](docs/backend/00-overview.md)
- [Architecture decisions (ADRs)](docs/backend/decisions/)
- [Report Bug](https://github.com/dj258255/balruno/issues/new?template=bug_report.md)
- [Request Feature](https://github.com/dj258255/balruno/issues/new?template=feature_request.md)

---

## 한국어

### Balruno란?

오픈소스 협업 스프레드시트 + 문서 워크스페이스. **게임 밸런싱 도메인 특화**. 실시간 동기화, 코멘트 + @멘션 (범위 핀 하이라이트), 풀 undo/redo, 모바일 친화. 1인 개발자가 진행 중이며 ML / AI 차별화를 게임 밸런싱에 맞춰 계획 중.

- **실시간 스프레드시트** — server-canonical wss op log + version-vector 충돌 해결
- **Tiptap 문서 본문** — Hocuspocus (yjs CRDT) + y-indexeddb 오프라인 캐시
- **코멘트 + @멘션** — 시트 셀 + 문서 본문 *범위 핀 하이라이트*, 인박스 종 아이콘
- **풀 undo/redo** — 모든 op 타입 (cell.update / row.* / column.* / tree.*) + 멀티 유저 isolation

**오픈소스: 클라이언트 MIT, 백엔드 AGPL v3. 셀프호스트 친화 (단일 Postgres + JVM + Hocuspocus). 클라우드 SaaS 계획 중.**

### 출하된 기능

#### 스프레드시트
| 카테고리 | 기능 |
|----------|------|
| **필드 타입** | 12종 — text · formula · checkbox · select · multi-select · date · url · currency · rating · link · lookup · rollup |
| **Grid 뷰** | 가상화 행 (TanStack Virtual), 모바일에선 sticky header + 첫 컬럼, drag-drop 컬럼 재배치 |
| **수식 엔진** | mathjs + @formulajs — 게임 특화 (DPS, EHP, TTK, SCALE, DIMINISH 등) |
| **링크 레코드** | 시트 간 양방향 link + reverse 컬럼 자동 생성 |
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z 가 cell.update / row.* / column.* / tree.* 모두 커버 — ADR 0021 |

#### 문서
| 카테고리 | 기능 |
|----------|------|
| **에디터** | Tiptap + StarterKit + Placeholder + collaboration (yjs) |
| **실시간** | Hocuspocus 서버 + collaboration-cursor 확장 |
| **오프라인** | y-indexeddb 캐시 (Outline / AFFiNE 패턴) |
| **트리** | 시트 트리 + 문서 트리 (별 계층, drag-drop, cycle 가드) |

#### 협업
| 카테고리 | 기능 |
|----------|------|
| **동기화** | Server-canonical wss op log (시트/트리) + Hocuspocus (문서 본문, yjs CRDT) — ADR 0008 |
| **Presence** | 시트 셀 awareness via wss + 문서 커서 via Hocuspocus awareness |
| **코멘트** | 시트 셀 + 문서 본문 (범위 핀 하이라이트) — ADR 0024 |
| **@멘션** | Tiptap mention 확장 + 인박스 종 + per-mention 알림 — ADR 0024 |

#### 플랫폼
| 카테고리 | 기능 |
|----------|------|
| **인증** | OAuth 만 (GitHub + Google) + JWT 세션 쿠키 — SMTP 의존성 0 |
| **워크스페이스** | 멀티 테넌트 + 역할 (Owner / Admin / Editor / Viewer) |
| **프로젝트** | 워크스페이스 별, 멤버 초대 + 역할 관리 |
| **모바일** | 사이드바 드로어 + 첫 컬럼 sticky + iOS 16px input + 44px hit target — ADR 0022 |
| **데스크톱** | Mac / Windows / Linux 네이티브 (Electron 41 + GitHub Releases 자동 업데이트) |
| **i18n** | UI + 12-그룹 스타터 팩 카탈로그 영/한 번역 |
| **관측** | Sentry SaaS (env-gated, 셀프호스트는 선택) |

### 계획 중 (다음 6 개월)

| ADR | 기능 | 상태 |
|---|---|---|
| **0023** | AI 통합 (BYOK Anthropic / OpenAI / Gemini / Ollama) | Accepted, Stage 1 = Spring AI 본진 모듈 |
| **0025** | ML 능력 — 아웃라이어 탐지, 클러스터 시각화, 곡선 피팅, TrueSkill, 임베딩 유사도 | Draft |
| **0008 v2.2** | 셀 스타일 동기화 (현재 Y.Doc 로컬 only) | TBD |
| (TBD) | 추가 뷰 재도입 (Kanban / Calendar / Gantt) — server-canonical sync 위에 | TBD |

### 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/dj258255/balruno.git
cd balruno

# 모든 workspace 의존성 설치 (Turborepo monorepo)
npm install

# 웹 앱 실행
cd packages/web && npm run dev
# → http://localhost:3000

# 또는 데스크톱 앱 (Electron)
cd packages/desktop && npm run dev
```

### 수식 예시

```javascript
// 전투 수식
=DPS(atk, speed, crit, critDmg)    // 크리티컬 포함 초당 데미지
=EHP(hp, def)                       // 유효 체력
=TTK(hp, dps)                       // 처치 소요 시간
=DAMAGE(atk, def)                   // 데미지 계산

// 스케일링 수식
=SCALE(base, level, rate, "exp")    // 지수 레벨 스케일링
=DIMINISH(value, soft, hard)        // 수확체감

// 참조 수식
=REF("몬스터", "고블린", "HP")        // 시트 간 참조
```

### 기여하기

기여를 환영합니다. PR 제출 전에 [CONTRIBUTING.md](CONTRIBUTING.md) 를 읽어주세요.

1. 저장소 Fork
2. Feature 브랜치 생성
3. 변경사항 커밋 (커밋 메시지 + 코드 주석은 영어)
4. 브랜치에 Push
5. Pull Request 생성

### 참고 자료

#### 게임 밸런스 이론
- [Game Balance Concepts](https://gamebalanceconcepts.wordpress.com/) — Ian Schreiber
- [Game Balance Dissected](https://gamebalancing.wordpress.com/) — DPS, TTK, Fire Rate

#### 경제 설계
- [Machinations.io — Game Inflation](https://machinations.io/articles/what-is-game-economy-inflation-how-to-foresee-it-and-how-to-overcome-it-in-your-game-design) — Faucet/Sink 모델
- [Lost Garden — Value Chains](https://lostgarden.com/2021/12/12/value-chains/) — 가치 사슬 설계

#### 성장 곡선 및 난이도
- [Davide Aversa — RPG Progression](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/) — 레벨 성장 수식
- [Game Developer — Difficulty Curves](https://www.gamedeveloper.com/design/difficulty-curves) — 난이도 곡선

### 라이선스

본 저장소는 디렉토리별로 다른 라이센스를 사용합니다. [LICENSE](LICENSE) 와 [LICENSING.md](LICENSING.md) 를 참조하세요.

- `packages/web/`, `packages/shared/`, `packages/desktop/` — **MIT**
- `packages/backend/`, `packages/collab/` — **AGPL v3**
- 트레이드마크 (PowerBalance / balruno / 로고) — [TRADEMARK.md](TRADEMARK.md) 참조

상용 라이센스 문의: dj258255@naver.com

---

<p align="center">
  Made for game studios — from solo designers to 30+ member teams
</p>
