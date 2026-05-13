# Self-hosting Balruno

This guide walks a self-host operator through running Balruno on
their own infrastructure. AGPL v3 (backend) + MIT (frontend) makes
this a fully supported path — the project's own balruno.com is one
deployment of the same codebase, not a privileged variant.

---

## What you get

- Game-balancing spreadsheet workspace (Grid view + 12 field types + formula engine + linked records)
- Document body editor (Tiptap + Hocuspocus + offline cache via y-indexeddb)
- Real-time multi-user collaboration (sheet cells + sheet tree + doc tree + doc body)
- Comments + @mentions on both scopes (range-anchored highlights for doc bodies)
- Inbox bell for received mentions
- Full undo/redo — every op (cell.update / row.* / column.* / tree.*) with multi-user isolation
- Mobile UX — sidebar drawer + sticky first column + iOS-friendly inputs
- Workspace + project + member CRUD with role-based access (Owner / Admin / Editor / Viewer)
- 12-group starter pack catalog (RPG / FPS / MOBA / RTS / Idle / Roguelike / Sprint / Bug Tracker / Roadmap / Playtest / Tutorial / Blank) with template import
- OAuth login (GitHub + Google) — no SMTP required
- 100% local data (your PostgreSQL, your Hocuspocus, your Spring Boot)

What you don't need to run:

- Sentry — env-gated, leave `NEXT_PUBLIC_SENTRY_DSN` blank
- **AI + ML sidecar** (`packages/ai-service`) — Python FastAPI service is optional. Skip the container if you don't want AI / ML features. Spring backend + Hocuspocus work standalone for spreadsheet + doc + comments
- AI provider keys — BYOK at the workspace level (operator pays nothing)
- Email (SMTP) — OAuth-only auth means no password reset emails

---

## Architecture summary

```
┌──────────────────┐    HTTPS / WSS    ┌────────────────────────────┐
│ user browser     │ ◄────────────────► │ nginx (reverse proxy)      │
│ (Vercel-hosted   │                    │   ↓                        │
│  static / SSR)   │                    │   ├─ Spring Boot 4         │
└──────────────────┘                    │   │   /api/v1/* + /ws/*    │
                                        │   ├─ Hocuspocus            │
                                        │   │   /collab/*            │
                                        │   └─ Python ai-service     │
                                        │       /api/v1/ai/*         │
                                        │       /api/v1/ml/*         │
                                        └────────────────────────────┘
                                                   │
                                                   ▼
                                        ┌────────────────────────────┐
                                        │ PostgreSQL 18              │
                                        │  + JSONB sync columns      │
                                        │  + pgvector (planned)      │
                                        └────────────────────────────┘
```

Components:

| Component | Language | License | Required for self-host |
|---|---|---|---|
| **packages/web** | Next.js 16 / TypeScript | MIT | Yes (frontend) |
| **packages/backend** | Java 25 / Spring Boot 4.0.6 | AGPL v3 | Yes (auth + sync API) |
| **packages/collab** | Node.js / Hocuspocus | AGPL v3 | Yes (doc bodies) |
| **packages/ai-service** | Python 3.13 / FastAPI | AGPL v3 | Optional (AI + ML features, planned) |
| **PostgreSQL 18** | (external) | PostgreSQL License | Yes |
| **packages/desktop** | Electron | MIT | Optional (Mac/Windows/Linux app) |

---

## Hardware sizing

Tested footprint (balruno.com — OCI Always Free, $0/month):

| Role | RAM | Notes |
|---|---|---|
| `prod-app` (backend + Hocuspocus + nginx) | ARM 12GB | Spring Boot ~ 1GB heap, Hocuspocus < 100MB |
| `db` (PostgreSQL 18) | ARM 12GB or shared | Single-node OK for early stage |
| `backup` | x86 1GB | pg_dump receiver |
| `monitor` | x86 1GB | Prometheus + Grafana + Loki (optional) |

Single-host is fine for solo / small team — `prod-app` + `db` on one
machine works. ARM 12GB has ample headroom for thousands of users.

---

## Quick start (single host)

### 1. Provision PostgreSQL 18

Any PostgreSQL 18 instance works. Schema is owned by Flyway —
backend creates it on first start.

```sql
-- Create the database + user
CREATE DATABASE balruno;
CREATE USER balruno WITH PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE balruno TO balruno;
```

### 2. Run the backend

```bash
git clone https://github.com/dj258255/balruno.git
cd balruno/packages/backend

# .env.local (or use docker-compose.yml below)
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=balruno
export POSTGRES_USER=balruno
export POSTGRES_PASSWORD=CHANGE_ME
export GITHUB_OAUTH_CLIENT_ID=...      # https://github.com/settings/developers
export GITHUB_OAUTH_CLIENT_SECRET=...
export GOOGLE_OAUTH_CLIENT_ID=...      # https://console.cloud.google.com/
export GOOGLE_OAUTH_CLIENT_SECRET=...
export FRONTEND_REDIRECT_BASE=https://your-domain.com
export CORS_ALLOWED_ORIGIN_PATTERNS=https://your-domain.com

./gradlew bootRun
# Backend listens on :8080. Spring will run Flyway migrations on first start.
```

For production, prefer the Docker compose at `packages/backend/docker-compose.yml`.

### 3. Run Hocuspocus (doc body collab)

```bash
cd packages/collab
npm install
COLLAB_JWT_SECRET="match the one Spring uses" npm run start
# Hocuspocus listens on :1234
```

### 4. Run the web frontend

```bash
cd packages/web
npm install

# .env.local
echo 'NEXT_PUBLIC_BALRUNO_API_URL=https://your-backend-domain.com' > .env.local
echo 'NEXT_PUBLIC_BALRUNO_COLLAB_URL=wss://your-collab-domain.com' >> .env.local

npm run dev   # for local
# or
npm run build && npm start   # for production
```

For Vercel or self-hosted, deploy the `.next/standalone` bundle.

### 5. Reverse proxy

nginx (or Caddy / Traefik) terminates TLS and proxies:

| Path | Backend |
|---|---|
| `/` | Vercel / Next.js standalone |
| `/api/*` | Spring Boot :8080 |
| `/ws/*` | Spring Boot :8080 (WebSocket) |
| `/collab/*` | Hocuspocus :1234 (WebSocket) |

Enable WebSocket upgrades on the proxy (`Upgrade` + `Connection`
headers).

---

## Production hardening

### OAuth callback URLs

Both GitHub and Google accept multiple callback URLs. Add:

- `https://your-domain.com/auth/callback`
- `https://your-domain.com/api/v1/oauth/{provider}/callback`

### TLS

- Cloudflare proxy (orange cloud) + Origin Certificate (15-year
  free) is what balruno.com uses — see `ansible/` for the
  reference deployment.
- Or Let's Encrypt via Caddy / nginx-ingress.

### Database backups

`pg_dump` to a separate host; the balruno.com deployment uses 3-2-1
(local → another OCI host → Cloudflare R2 object storage). See
`ansible/roles/postgres-backup/` for the reference cron.

### Zero-downtime deploys (optional)

The reference `ansible/` setup ships a blue/green deploy pattern for
the Spring backend and the Hocuspocus collab server. Each role
declares two compose services (`backend-blue` / `backend-green`,
`collab-blue` / `collab-green`) gated behind Compose profiles, and an
nginx upstream `backup` directive routes traffic to whichever color is
"active" via a snippet symlink. The deploy workflows
(`backend-deploy.yml`, `collab-deploy.yml`) bring up the inactive
color, poll `/actuator/health/readiness` (Spring) or a TCP probe
(Hocuspocus), then flip the symlink + `nginx -s reload` for a
graceful cutover. First migration ~21s downtime (legacy single
container → dual slot); subsequent cutovers measured at 0s on the
reference deployment. See `ansible/` for the blue/green deploy pattern.

If you'd rather keep the simpler single-container pattern (Baserow /
Plane / NocoDB style), drop the blue/green services from
`docker-compose.yml.j2` and switch the workflow back to
`docker compose pull && up -d`. The 30-60s in-place restart downtime
is the OSS self-hosted norm.

### Actuator endpoint gate (optional)

`/actuator/*` is accessible to anyone who can reach the public domain.
Spring's default exposure is limited to `health` + `info`, but if you
want defense in depth you can enable the optional internal-token
gate (optional internal-token):

1. Generate a token: `openssl rand -hex 32`.
2. Add it to `vault.yml` as `vault_actuator_internal_token: "<token>"`.
3. Register the same value as the `ACTUATOR_INTERNAL_TOKEN` repo
   secret so the deploy smoke test continues to pass.
4. Re-apply ansible.

Until the vault key is set, the gate stays inactive (graceful
default), so this is safe to set up after the fact.

### Observability

- **Sentry** — sign up free at sentry.io, set
  `NEXT_PUBLIC_SENTRY_DSN`. Inert until set.
- **Or self-host** — point the same DSN at GlitchTip running on
  your infrastructure (Sentry-compatible, MIT licensed).
- **Or no observability** — leave the env blank; logs only.

### AI + ML service (optional, planned)

AI (LLM) and ML (statistical analytics — outlier / cluster /
curve fit / TrueSkill / similarity / RAG) live in a **separate
Python FastAPI sidecar** (`packages/ai-service`), not the Spring
backend. Same Docker compose, separate container.

```
nginx routing
  ├── /api/v1/* + /ws/*                 → Spring Boot (auth/sync/sheets/comments)
  ├── /collab/*                         → Hocuspocus (doc body yjs)
  └── /api/v1/ai/* + /api/v1/ml/*       → Python ai-service
```

The Python sidecar is **optional**. Skip it if you don't want AI
or ML — Spring backend works standalone for the spreadsheet +
document + comment features. Just don't add the `ai-service`
container to your compose file.

#### BYOK key configuration (when ai-service is running)

Configuration is per-workspace BYOK. The operator does **not**
pay for end-user AI usage. Each workspace admin pastes their
own provider key in workspace settings; the Spring backend
stores it AES-GCM encrypted, and the Python sidecar reads +
decrypts at request time.

Required env (Spring **and** ai-service share both secrets so
the sidecar can verify the JWT and decrypt credentials):

```bash
# 32-byte hex master key — encrypts workspace_ai_credentials.api_key_enc
BALRUNO_AI_SECRET_KEY=$(openssl rand -hex 32)

# JWT signing secret — same value as Spring's so the sidecar
# can verify session tokens
BALRUNO_JWT_SECRET=...
```

Lose `BALRUNO_AI_SECRET_KEY` and every encrypted key in the
database becomes unreadable — keys are re-entered, not
recoverable. Treat the secret like a database master password.

Supported providers (planned):

- Anthropic (Claude) — recommended for game balance analysis
- OpenAI (GPT-4o family)
- Google Gemini (per-user free tier)
- Ollama (self-hosted local LLM, no API key)
- OpenRouter (multi-provider gateway)

#### ML library stack (planned, in the same sidecar)

- `scikit-learn` — outlier detection, clustering, regression
- `scipy` — curve fitting, statistical tests
- `statsmodels` — regression with p-values
- `trueskill` — Microsoft Bayesian skill rating (matchup → power score)
- `sentence-transformers` — local embeddings (no external API needed)
- `langchain` + `pgvector` — RAG over comments / ADRs / git history

---

## License obligations (AGPL v3)

If you run a *modified* backend / collab as a network service for
others, AGPL v3 requires you to offer the modified source to your
users. The most common compliance pattern:

1. Fork on GitHub (modifications visible)
2. Deploy from the fork
3. Link to the fork from your app's footer / about page

If you run the *unmodified* upstream, no extra obligation — the
upstream source is already public at github.com/dj258255/balruno.

The frontend (MIT) and shared package (MIT) have no such obligation
even when modified.

---

## Reference deployment

balruno.com runs on:

| Layer | Host |
|---|---|
| Frontend | Vercel (free tier, Next.js standalone) |
| Backend + Hocuspocus | OCI Always Free ARM 12GB |
| Database | OCI Always Free ARM 12GB (separate host) |
| Backups | OCI Always Free x86 1GB + Cloudflare R2 (offsite) |
| Monitoring | OCI Always Free x86 1GB (Prometheus + Grafana) |
| TLS / DDoS | Cloudflare proxy + Origin Cert |

Total cost: $0 / month (OCI Always Free + Cloudflare free tier +
Vercel hobby).

The `ansible/` directory has the playbooks that provision this; see
`ansible/README.md` for the role-by-role walkthrough.

---

## Common pitfalls

| Symptom | Likely cause |
|---|---|
| OAuth login redirects to `/login?error=oauth_failed` | callback URL mismatch — register both Spring + frontend callbacks |
| Sheets load but cell edits don't sync to peers | nginx not upgrading WebSocket — set `proxy_set_header Upgrade $http_upgrade` |
| Doc bodies collaborate but sheets don't | Hocuspocus running but Spring `/ws/projects/*` proxy missing |
| Login works but then 401s within minutes | JWT secret mismatch between Spring and Hocuspocus — share the same `COLLAB_JWT_SECRET` |
| Catalog import returns 404 | Missing `catalog-{locale}.json` resources — rebuild backend from source, don't hot-swap the JSON |

---

## Getting help

- GitHub Discussions: https://github.com/dj258255/balruno/discussions
- Issues: https://github.com/dj258255/balruno/issues
- For the reference Ansible playbooks: `ansible/README.md`

For commercial support / managed deployment: dj258255@naver.com
