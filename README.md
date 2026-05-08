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
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z covers cell.update / row.* / column.* / tree.* — *server-backed*, refresh-survival within 120 min, per-tab scope (Baserow `MINUTES_UNTIL_ACTION_CLEANED_UP`) — ADR 0021 v3.0 |

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
| **Comments** | Sheet cell + doc body (range-anchored highlights) + reply thread (1-level nesting, Slack/Linear pattern) + email + Web Push (VAPID) + daily/weekly digest — ADR 0024 v2.4 |
| **Integrations** | Outbound webhooks (HMAC-SHA256 POSTs) + Inbound webhooks (GitHub PR / issues + generic) + Share links per view + Discord slash commands (Ed25519 verified) — ADR 0027 / 0028 / 0029 / 0030 |
| **@mentions** | Tiptap mention extension + inbox bell + per-mention notification — ADR 0024 |

#### Platform
| Category | Features |
|----------|----------|
| **Auth** | OAuth-only (GitHub + Google) + JWT session cookie — no SMTP dependency |
| **Workspaces** | Multi-tenant with role-based access (Owner / Admin / Editor / Viewer) |
| **Projects** | Per-workspace, with member invites + role management |
| **Mobile** | Sidebar drawer + sticky first column + iOS 16px input + 44px hit targets + bottom-sheet cell editor + long-press contextmenu + sticky Tiptap toolbar + link picker search — ADR 0022 v1.4 |
| **Views** | 10 view types: Grid (default) · Form · Kanban · Calendar · Gallery · Gantt · Heatmap · Curve · Probability · Diff — all on top of the server-canonical sync, so view switches and drag-drop are live multi-player. The last 4 (Heatmap / Curve / Probability / Diff) are game-balance specific and don't exist in Notion / Airtable / Baserow. — ADR 0022 v2.1 |
| **Desktop** | Native Mac / Windows / Linux app (Electron 41 + auto-update via GitHub Releases) |
| **i18n** | UI + 12-group starter pack catalog fully translated (en, ko) |
| **Observability** | Sentry SaaS (env-gated, optional for self-host) |

### Recently shipped

- ✅ **ADR 0021 v3.0 phase 5** — server-backed persistent undo (refresh-survival, 120-min Baserow window, per-tab scope, hydrate-on-mount)
- ✅ **ADR 0008 v2.2** — cell style server-canonical sync (was silent local-only — now broadcasts to peers + cross-device)
- ✅ **ADR 0008 ζ.3** — `lib/ydoc.ts` complete deletion (-3411 net lines). Sheet domain is now 100% server-canonical.
- ✅ **ADR 0008 v2.3** — `sheet.metadata.update` wire op (activeView, view*ColumnId, savedViews, name, icon, kind, filterGroup, tags) — view switches and grouping picks broadcast to peers in real time.
- ✅ **ADR 0022 v2.0** — Kanban + Calendar + Gantt views restored on top of server-canonical sync. Drag-drop / view config flicks are now genuinely multi-player (Linear pattern).
- ✅ **ADR 0022 v2.1** — Remaining 6 views shipped: Form · Gallery · Heatmap · Curve · Probability · Diff. The 4 game-balance specific views (Heatmap / Curve / Probability / Diff) are where this stops being a Notion clone and starts being a Game Studio Workspace.
- ✅ **Diff baseline picker** — op_idempotency.inverse_payload backward replay reconstructs historical baselines inside the 120-min reversible window. No separate snapshot infrastructure needed; Phase 5's idempotency log already has the data.
- ✅ **ADR 0027 share links** — read-only public viewer at `/share/:token`. UUIDv7 PK + UUIDv4 token, optional sheet / view / expiry pin, instant revoke.
- ✅ **ADR 0028 webhook outbound** — HMAC-SHA256 signed POSTs on `comment.added` / `mention.created` / `row.added`. ApplicationEvent decoupling so the webhook module isn't a static dep on the publishers (Spring Modulith arch test green).
- ✅ **ADR 0024 Stage I — email + Web Push notifications** — Spring's JavaMailSender (admin brings SMTP creds, Outline / AFFiNE / Baserow pattern, no built-in service) + VAPID Web Push (RFC 8030 + 8292, free forever, no third party). Per-user prefs (instant / daily / weekly / off) + per-device subscription list at `/settings/notifications`.
- ✅ **ADR 0029 Inbound webhooks (GitHub)** — POST `/api/v1/inbound-public/:id/{github\|generic}` with HMAC-SHA256 (`X-Hub-Signature-256` for GitHub, `X-Balruno-Signature` for generic). PR / issue events auto-create rows on the target sheet (title / url / status mapped to chosen columns).
- ✅ **Daily / weekly digest** — Spring `@Scheduled` aggregates per-user mentions for non-instant cadence picks (00:00 UTC daily / Monday weekly).
- ✅ **ADR 0030 Discord slash commands** — Ed25519 verified `/v1/discord/interactions` endpoint. `/balruno bug <text>` adds a row to the workspace's default sheet. v1 is manual setup (paste 4 strings from Developer Portal); OAuth2 install URL is v2 polish.
- ✅ **ADR 0024 v2.2** — comment reply threads (1-level nesting via `parentId`, Slack/Linear pattern)

### Planned (next 6 months)

| ADR | Feature | Stack | Status |
|---|---|---|---|
| **0024 stage I** | @mention email + browser push delivery (Resend free tier 100/day, Brevo 300/day, Web Push VAPID) | Spring backend + Web Push | Deferred (waiting on real users) |
| **Discord OAuth2 install** | Replace manual Developer-Portal-paste with hosted OAuth invite URL (registers a public Discord App) | Spring backend | Polish |
| **`/balruno query` lookup** | Currently ack-only; v2 reads cell value from a sheet and replies in Discord | Spring backend | Polish |
| **0023 v3.0** | AI integration (BYOK Anthropic / OpenAI / Gemini / Ollama / OpenRouter) | **Python FastAPI sidecar** (`packages/ai-service`) | Deferred by user |
| **0025 v2.0** | ML — outlier detection · cluster visualization · curve fit · TrueSkill · embedding similarity · RAG over comments | **Same Python sidecar** | Deferred by user |

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
AI / ML service      Python FastAPI · langchain · scikit-learn · scipy · trueskill (planned, ADR 0023 + 0025)
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
│   ├── collab/               # Hocuspocus server (AGPL v3) — yjs doc body sync
│   └── ai-service/           # (planned) Python FastAPI (AGPL v3) — AI BYOK + ML statistics
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
- **Undo / redo** — full op coverage (cell / row / column / tree) — ADR 0021 phases 1-4
- **Server-backed persistent undo** — refresh-survival, per-tab scope, 120-min Baserow window, hydrate-on-mount — ADR 0021 v3.0 phase 5
- **Comments + @mentions** — sheet cells + doc body (range-anchored highlights via Tiptap Decoration plugin), inbox bell, **reply threads (1-level nesting via parentId, Slack/Linear pattern)** — ADR 0024 v2.2
- **Mobile UX** — full prod: sidebar drawer + sticky first column + iOS 16px input + 44px hit targets + bottom-sheet portal cell editor + long-press synthetic contextmenu + sticky Tiptap mobile toolbar + link picker search — ADR 0022 v1.4
- **Multi-view sheet** — 10 view types: Grid · Form · Kanban · Calendar · Gallery · Gantt · Heatmap · Curve · Probability · Diff. The last 4 are game-balance specific (character × stat matrix, level scaling curves, drop / gacha probability tree, balance change before/after). Every drag-drop / view switch / grouping pick broadcasts to peers — ADR 0022 v2.1 + ADR 0008 v2.3 (`sheet.metadata.update` wire op)
- **Cell style server-canonical sync** — was silent local-only, now broadcasts to all peers and survives cross-device — ADR 0008 v2.2
- **`lib/ydoc.ts` complete deletion** — sheet domain is now 100% server-canonical, Y.Doc only survives in doc-body Hocuspocus pattern — ADR 0008 ζ.3 (-3411 net lines)
- **v0.6 Y.Doc cleanup** — legacy local-mode + 294 dead files removed (-77K lines) — ADR 0008 §10

**Next (planned, ~6 months)**
- @mention email + browser push delivery — Resend/Brevo free tier + Web Push VAPID (ADR 0024 stage I, deferred until real users land)
- Re-introduce remaining view types — Form · Gallery · Heatmap · Curve · Probability · Diff (ADR 0022 v2.1+, trigger when users ask)
- AI integration (BYOK Anthropic / OpenAI / Gemini / Ollama / OpenRouter) — ADR 0023
- ML capabilities — outlier detection · cluster visualization · curve fit · TrueSkill · embedding similarity — ADR 0025
- Share links per view (read-only)
- Webhook integrations (GitHub / Discord)

**Pricing (tentative — finalized after beta)**
- **Free / self-host** — unlimited (MIT for client + AGPL v3 for backend, run anywhere)
- **Cloud Free** — strict quotas (rows/sheet 2k · history 14d · AI 0/BYOK · 120-min server-backed undo, matching Baserow community)
- **Cloud Pro** — quotas lifted, optional cloud-paid AI pool, undo retention same as Free (Baserow pattern: undo isn't tier-gated) (price TBD after beta validation)
- **Team** — collaboration + members + SSO + 30-day audit log retention (row history viewer) + audit log export (price TBD)

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
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z 가 cell.update / row.* / column.* / tree.* 모두 커버 — *server-backed*, 페이지 새로고침 후에도 120분 내 Cmd+Z 가능, per-tab 격리 (Baserow `MINUTES_UNTIL_ACTION_CLEANED_UP`) — ADR 0021 v3.0 |

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
| **코멘트** | 시트 셀 + 문서 본문 (범위 핀 하이라이트) + 답글 스레드 (1단계 nesting, Slack/Linear 패턴) + 이메일 + Web Push (VAPID) delivery + daily/weekly 다이제스트 — ADR 0024 v2.4 |
| **외부 통합** | Outbound 웹훅 (HMAC-SHA256 POST) + Inbound 웹훅 (GitHub PR/issues + generic) + 공유 링크 (per view) + Discord slash commands (Ed25519 검증) — ADR 0027 / 0028 / 0029 / 0030 |
| **@멘션** | Tiptap mention 확장 + 인박스 종 + per-mention 알림 — ADR 0024 |

#### 플랫폼
| 카테고리 | 기능 |
|----------|------|
| **인증** | OAuth 만 (GitHub + Google) + JWT 세션 쿠키 — SMTP 의존성 0 |
| **워크스페이스** | 멀티 테넌트 + 역할 (Owner / Admin / Editor / Viewer) |
| **프로젝트** | 워크스페이스 별, 멤버 초대 + 역할 관리 |
| **모바일** | 사이드바 드로어 + 첫 컬럼 sticky + iOS 16px input + 44px hit target + bottom-sheet 셀 에디터 + 길게 누르기 컨텍스트 메뉴 + 문서 sticky Tiptap 툴바 + link picker 검색 — ADR 0022 v1.4 |
| **뷰** | 10 뷰: Grid (기본) / Form / Kanban / Calendar / Gallery / Gantt / Heatmap / Curve / Probability / Diff. 마지막 4 개 (Heatmap / Curve / Probability / Diff) 는 게임 밸런싱 도메인 특화 — Notion / Airtable / Baserow 에 없음. server-canonical sync 위에서 모든 view 전환 / drag-drop 이 실시간 멀티플레이어 — ADR 0022 v2.1 |
| **데스크톱** | Mac / Windows / Linux 네이티브 (Electron 41 + GitHub Releases 자동 업데이트) |
| **i18n** | UI + 12-그룹 스타터 팩 카탈로그 영/한 번역 |
| **관측** | Sentry SaaS (env-gated, 셀프호스트는 선택) |

### 출하 완료 + 계획 중

**Shipped (이번 sprint)**
- ✅ ADR 0021 v3.0 phase 5 — server-backed persistent undo (refresh 후 Cmd+Z, 120 분 Baserow 윈도우)
- ✅ ADR 0008 v2.2 — 셀 스타일 server-canonical 동기화
- ✅ ADR 0008 ζ.3 — `lib/ydoc.ts` 통째 삭제 (-3411 net lines). 시트 도메인 100% server-canonical.
- ✅ ADR 0008 v2.3 — `sheet.metadata.update` wire op. activeView / view metadata 14 필드 patch. peer 가 view 전환을 실시간으로 봄.
- ✅ ADR 0022 v2.0 — Kanban / Calendar / Gantt 3 뷰 server-canonical 위로 재도입. drag-drop 이 *진짜* 실시간 멀티플레이어 (Linear 패턴).
- ✅ ADR 0022 v2.1 — 나머지 6 뷰 풀 (Form · Gallery · Heatmap · Curve · Probability · Diff). 뒤 4 개 (Heatmap / Curve / Probability / Diff) 가 *Notion 클론* 과 *진짜 게임 밸런싱 도구* 의 분리.
- ✅ Diff baseline picker — op_idempotency.inverse_payload 의 backward replay 로 120 분 윈도우 안 historical baseline 재구성. 별도 snapshot 인프라 불필요.
- ✅ ADR 0027 share links — `/share/:token` 의 인증 없는 읽기 전용 viewer. 즉시 revoke.
- ✅ ADR 0028 webhook outbound — `comment.added` / `mention.created` / `row.added` 이벤트의 HMAC-SHA256 POST. ApplicationEvent 디커플링.
- ✅ ADR 0024 Stage I — email + Web Push (VAPID) 알림. SMTP 는 admin 이 spring.mail.* 로 가져옴 (Outline/AFFiNE/Baserow 패턴). Web Push 는 RFC 표준이라 영구 무료. `/settings/notifications` 에서 toggles + per-device 관리.
- ✅ ADR 0029 Inbound webhooks (GitHub) — POST + HMAC-SHA256 검증. PR / issue 이벤트가 자동으로 row 추가. ViewSwitcher 의 "받기" 버튼으로 URL + secret 발급.
- ✅ Daily / weekly digest — Spring `@Scheduled` 가 instant 가 아닌 사용자에게 mention 모음 1통 (00:00 UTC).
- ✅ ADR 0030 Discord slash commands — Ed25519 검증 interaction endpoint. `/balruno bug <text>` 가 workspace 기본 시트에 row 추가. v1 = 5단계 manual setup (Developer Portal 4 string 복사), v2 = OAuth2 install.
- ✅ ADR 0024 v2.2 — 코멘트 답글 스레드 (1단계 nesting, Slack/Linear 패턴)

**계획 중 (다음 6 개월)**

| ADR | 기능 | 스택 | 상태 |
|---|---|---|---|
| **0024 stage I** | @mention 이메일 + 브라우저 푸시 delivery (Resend free 100/day, Brevo 300/day, Web Push VAPID $0) | Spring backend + Web Push | 사용자 등장 시 |
| **Discord OAuth2 install** | manual paste 대신 hosted OAuth invite (Public Discord App 등록) | Spring backend | Polish |
| **`/balruno query` lookup** | 현재 ack only — v2 에서 셀 값 lookup + Discord 답장 | Spring backend | Polish |
| **0023 v3.0** | AI 통합 (BYOK Anthropic / OpenAI / Gemini / Ollama / OpenRouter) | **Python FastAPI sidecar** (`packages/ai-service`) | 사용자 보류 |
| **0025 v2.0** | ML — outlier 탐지 · 클러스터 시각화 · curve fit · TrueSkill · 임베딩 유사도 · RAG | **같은 Python sidecar** | 사용자 보류 |

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
