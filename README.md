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
  <img src="https://img.shields.io/badge/Backend%20(planned)-AGPL%20v3-orange.svg" alt="Backend (planned): AGPL v3">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#한국어">한국어</a>
</p>

---

![Screenshot](docs/images/intro.png)

## English

### What is Balruno?

An integrated workspace for game studios — from solo creators to 30+ member teams. **Balance data + agile project management in a single tool** — manage your spreadsheets, sprint boards, bug trackers, and epic roadmaps together.

- **Designers**: 70+ game formulas, Monte Carlo simulation, engine export (Unity/Godot/Unreal)
- **PMs**: Kanban sprints, bug tracker, Gantt epic roadmap
- **Team**: Real-time collaboration (Yjs CRDT), AI-powered setup

**Local-first. Browser-native. Open source (MIT for client, AGPL v3 for the planned backend).**

### Features

#### Balancing (Designer)
| Category | Features |
|----------|----------|
| **Formulas** | 70+ game-specific (DPS, EHP, TTK, SCALE, GACHA_PITY, DIMINISH) |
| **Simulation** | Monte Carlo (1K~100K iterations, 95% CI) |
| **Analysis** | Z-score outlier detection, power curve, imbalance detector |
| **Economy** | Faucet/Sink model, inflation calculator |
| **Curve Fitting** | Draw graphs → auto-generate formulas |
| **Export** | Unity / Godot / Unreal code + JSON/CSV |

#### Project Management (Studio)
| Category | Features |
|----------|----------|
| **Sprint Board** | 5-stage Kanban (Backlog→Todo→Doing→Review→Done) with priority/role/assignee |
| **Bug Tracker** | Severity (S1-S4) × Status × Platform (PC/Console/Mobile) |
| **Epic Roadmap** | Gantt with phases (Pre-prod → Production → Beta → Launch) |
| **AI Setup** | Describe requirements → auto-generate initial balance sheets |

#### Platform
| Category | Features |
|----------|----------|
| **Views** | Grid / Form / Kanban / Calendar / Gallery / Gantt |
| **Field Types** | general / formula / checkbox / select / multiSelect / date / url / currency / rating / link / lookup / rollup |
| **Collaboration** | Yjs CRDT, y-indexeddb, y-webrtc (infrastructure) |
| **Storage** | Local-first (IndexedDB), no server required in free tier |
| **Desktop** | Native Mac / Windows / Linux app (Electron) with auto-update |

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
Local storage        IndexedDB (idb)
Styling              Tailwind CSS 3.4
Charts               Recharts
Math engine          mathjs + @formulajs/formulajs
i18n                 next-intl (en, ko — 5170 keys synced)
Desktop              Electron 41 (ESM) + electron-builder + electron-updater
Backend (planned)    Java 21 + Spring Boot 3 + PostgreSQL 15 (JSONB)
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
│   └── backend/              # Spring Boot (planned, AGPL v3)
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
- Spreadsheet engine (Grid + Form + Kanban + Calendar + Gallery + Gantt)
- 70+ game formulas, Monte Carlo simulation
- Game engine export (Unity / Godot / Unreal)
- Yjs CRDT (real-time collab infrastructure)
- 12 field types (general/formula/checkbox/select/multiSelect/date/url/currency/rating/link/lookup/rollup)
- Sprint Board / Bug Tracker / Epic Roadmap templates
- AI Setup (template-based, LLM fallback)
- Command palette
- Docked tool groups (9 categories)
- **Monorepo migration** (Turborepo + packages/web/shared/desktop)
- **Electron desktop app** (Mac/Windows/Linux + auto-update via GitHub Releases)

**Next (B2B Team Features)**
- Comments & @mentions (Yjs)
- Presence / cursors (awareness API)
- Member invites, roles (owner/editor/viewer)
- Share links per view (read-only)
- Full LLM integration (Anthropic / OpenAI)
- Git / Slack / Discord webhooks
- Interface Designer (dashboard builder)
- Automations (n8n-style node editor)
- **Spring Boot backend (AGPL v3) — auth, cloud sync, quota**

**Pricing (tentative — finalized after beta)**
- **Free / self-host** — unlimited (MIT for client + AGPL v3 for backend, run anywhere)
- **Cloud Free** — strict quotas (3 workspaces · 5 projects/ws · 10 sheets/project · 10MB storage)
- **Cloud Pro** — quotas lifted (price TBD after beta validation)
- **Team** (v1) — collaboration + members + SSO (price TBD)

### License

This repository uses different licenses per directory. See [LICENSE](LICENSE) for the overview and [LICENSING.md](LICENSING.md) for a user-friendly FAQ.

- `packages/web/`, `packages/shared/`, `packages/desktop/` — **MIT**
- `packages/backend/` (planned) — **AGPL v3**
- Trademarks (PowerBalance / balruno / logo) — see [TRADEMARK.md](TRADEMARK.md)

For commercial licensing inquiries: dj258255@naver.com

### Links

- [Live Demo](https://balruno.com)
- [Documentation (English)](docs/DESIGN_EN.md)
- [Documentation (한국어)](docs/DESIGN_KO.md)
- [Report Bug](https://github.com/dj258255/balruno/issues/new?template=bug_report.md)
- [Request Feature](https://github.com/dj258255/balruno/issues/new?template=feature_request.md)

---

## 한국어

### Balruno란?

게임 스튜디오를 위한 **통합 워크스페이스** — 1인 개발자부터 30명+ 팀까지. 밸런싱 데이터와 애자일 프로젝트 관리를 **한 툴**에서 — 스프레드시트, 스프린트 보드, 버그 트래커, 에픽 로드맵을 함께 관리합니다.

- **기획자**: 70개+ 게임 수식, 몬테카를로 시뮬, 엔진 export (Unity/Godot/Unreal)
- **PM**: 칸반 스프린트, 버그 트래커, Gantt 에픽 로드맵
- **팀**: 실시간 협업 (Yjs CRDT), AI 자동 세팅

**로컬 우선. 브라우저 네이티브. 오픈소스 (클라이언트 MIT · 백엔드 AGPL v3 예정).**

### 주요 기능

#### 밸런싱 (Designer)
| 카테고리 | 기능 |
|----------|------|
| **수식** | 70개+ 게임 특화 (DPS, EHP, TTK, SCALE, GACHA_PITY, DIMINISH) |
| **시뮬레이션** | 몬테카를로 (1천~10만회, 95% 신뢰구간) |
| **분석** | Z-score 이상치 탐지, 파워 커브, 불균형 탐지기 |
| **경제** | Faucet/Sink, 인플레이션 계산기 |
| **커브 피팅** | 그래프 → 수식 자동 생성 |
| **내보내기** | Unity / Godot / Unreal 코드 + JSON/CSV |

#### 프로젝트 관리 (Studio)
| 카테고리 | 기능 |
|----------|------|
| **스프린트 보드** | 5단 칸반 (Backlog→Todo→Doing→Review→Done) + 우선순위/역할/담당자 |
| **버그 트래커** | 심각도 (S1-S4) × 상태 × 플랫폼 (PC/Console/Mobile) |
| **에픽 로드맵** | Gantt + 페이즈 (Pre-production → Production → Beta → Launch) |
| **AI 자동 세팅** | 요구사항 자연어 → 초기 밸런스 시트 자동 생성 |

#### 플랫폼
| 카테고리 | 기능 |
|----------|------|
| **뷰** | Grid / Form / Kanban / Calendar / Gallery / Gantt |
| **필드 타입** | general / formula / checkbox / select / multiSelect / date / url / currency / rating / link / lookup / rollup (12종) |
| **협업** | Yjs CRDT, y-indexeddb, y-webrtc (인프라) |
| **저장** | 로컬 우선 (IndexedDB), 무료 플랜 서버 불필요 |
| **데스크톱** | Mac / Windows / Linux 네이티브 앱 (Electron) + 자동 업데이트 |

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
- `packages/backend/` (예정) — **AGPL v3**
- 트레이드마크 (PowerBalance / balruno / 로고) — [TRADEMARK.md](TRADEMARK.md) 참조

상용 라이센스 문의: dj258255@naver.com

---

<p align="center">
  Made for game studios — from solo designers to 30+ member teams
</p>
