# Architecture

A high-level map of the Balruno codebase. Aimed at new contributors —
30 minutes from this page to "I know where to put my change."

---

## Monorepo Layout

Turborepo + npm workspaces. Every package builds independently and
shares typed boundaries through `@balruno/shared`.

```
balruno/
├── packages/
│   ├── web/        Next.js 16 client (App Router + React 19)
│   ├── shared/     pure TS — formula engine, types, lib helpers
│   ├── desktop/    Electron wrapper around packages/web
│   ├── collab/     Hocuspocus side-car (Node.js, yjs persistence)
│   └── backend/    Spring Boot 4 + PostgreSQL 18 + Hibernate 7.2
├── docs/           public docs (this folder)
│   ├── ARCHITECTURE.md   you are here
│   ├── SELF_HOSTING.md   operator-facing setup
│   └── images/
├── ansible/        infra-as-code for the reference OCI deployment
└── tools/          benchmark + ops helpers
```

The split mirrors deploy boundaries: `web` ships to Vercel,
`backend` + `collab` run on the operator's own hosts (OCI in the
reference deployment).

## Stack at a Glance

| Layer | Choice | Notes |
|---|---|---|
| Web client | Next.js 16 + React 19 + Zustand + TanStack Virtual | Server-first, client-canonical store hydrates from API + IndexedDB cache |
| Real-time sync | Spring WebSocket (sheet cells + trees) + Hocuspocus (doc bodies) | Two patterns, one project room — see "Sync model" |
| Backend | Spring Boot 4.0.6 + Java 25 + Hibernate 7.2 + Spring Modulith 1.4 | Module-bounded (`user`, `workspace`, `project`, `sync`, …) with ArchUnit tests |
| Storage | PostgreSQL 18.3 (uuidv7, JSONB, GIN, native ARRAY/ENUM) | Flyway migrations under `packages/backend/src/main/resources/db/migration` |
| Auth | OAuth2 (GitHub + Google) + HMAC-signed JWT cookies | No password DB, no SMTP dependency — see ADR 0002 |
| Observability | Prometheus + Grafana + Alertmanager + blackbox_exporter | Sentry SaaS is env-gated for the client |
| Deploy | Vercel (web) + Docker on OCI (backend + collab) | Zero-downtime blue/green via nginx symlink swap — see ADR 0044 |

## Sync Model — 4 regions, 2 patterns

The product surfaces **four real-time regions** but the backend
implements them with **two patterns**:

| Region | Pattern | Transport | Conflict strategy |
|---|---|---|---|
| Sheet cells | A — server op log | Spring WS `/ws/projects/{id}` | Server-canonical, LWW per cell, op_idempotency table |
| Sheet tree | A — same op log | same socket | Server-canonical, cycle guard, cascade soft-delete |
| Doc tree | A — same op log | same socket | Same |
| Doc body | B — CRDT | Hocuspocus WS | yjs auto-merge, persisted to `documents.binary` |

**Pattern A** (Linear-style): every mutation is an op, the server
writes the JSONB column with `jsonb_set`, bumps a per-region version,
and rebroadcasts to peers. Clients reconcile against the version
vector. The canonical implementation lives in
`packages/backend/src/main/java/com/balruno/sync/`.

**Pattern B** (Hocuspocus): doc bodies are full yjs CRDTs. The
side-car owns the merge and persistence path; the Spring side only
authorises the connection. Implementation in `packages/collab/` plus
the auth bridge in `com.balruno.sync.internal.CollabTokenController`.

The two patterns share one ID space (`projectId`) so a single open
project keeps both sockets live.

## A request, end to end

Editing a cell from the web client:

1. User types → `useProjectStore.applyLocalCellUpdate` writes an
   optimistic op to memory + IndexedDB.
2. The write queue (`lib/sync/writeQueue.ts`) drains and sends
   `cell.update` over the Spring WS, tagged with a client-generated
   `opId` (UUIDv4).
3. `SheetSyncService` validates membership, applies the op via
   `jsonb_set` inside a transaction, inserts into `op_idempotency`
   keyed on `(scope_kind, scope_id, op_id)`, bumps `data_version`.
4. The op is published to every peer subscribed to the project room.
   Each peer either applies (new) or skips (duplicate `opId`).
5. Undo / redo is server-backed: the inverse payload sits in
   `op_idempotency.inverse_payload` for 120 minutes (Baserow window).
   `UndoController` replays it on demand.

The same five steps cover row/column ops and tree mutations — only
the JSON path differs.

## Where to look for…

| Need | File / folder |
|---|---|
| Add a new sheet view | `packages/web/src/components/views/` + `packages/shared/src/types.ts` |
| Add a backend module | `packages/backend/src/main/java/com/balruno/<module>/` (see Modulith conventions) |
| Wire a new op type | `SheetSyncService` + `useProjectStore` slice + `lib/sync/writeQueue.ts` |
| Add a migration | `packages/backend/src/main/resources/db/migration/V{n}__*.sql` (immutable once shipped) |
| Add a translation | `packages/web/src/i18n/messages/{ko,en}.json` + `packages/backend/src/main/resources/messages_{ko,en}.properties` |
| Understand a past decision | the ADR header inside the relevant module file (see SOURCES OF TRUTH section in each Spring Modulith module) |

## Self-hosting

See [`docs/SELF_HOSTING.md`](SELF_HOSTING.md). The reference setup is
four OCI Always-Free hosts (two ARM 12 GB, two x86 1 GB) fronted by
Cloudflare; the same compose files run on a single Docker host.

## Further reading

- [`docs/SELF_HOSTING.md`](SELF_HOSTING.md) — operator-facing setup.
- [`SECURITY.md`](../SECURITY.md) — vulnerability reporting flow.
