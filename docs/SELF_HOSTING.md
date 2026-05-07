# Self-hosting Balruno

This guide walks a self-host operator through running Balruno on
their own infrastructure. AGPL v3 (backend) + MIT (frontend) makes
this a fully supported path — the project's own balruno.com is one
deployment of the same codebase, not a privileged variant.

---

## What you get

- Game-balancing workspace (sheets + 12-group starter pack catalog)
- Real-time multi-user collaboration (cells + tree + doc bodies)
- Workspace + project + member CRUD with role-based access
- OAuth login (GitHub + Google) — no SMTP required
- 100% local data (your PostgreSQL, your Hocuspocus, your Spring Boot)

What you don't need to run:

- Sentry — env-gated, leave `NEXT_PUBLIC_SENTRY_DSN` blank
- AI providers — BYOK at the user level, no operator infra
- Email (SMTP) — OAuth-only auth means no password reset emails

---

## Architecture summary

```
┌──────────────────┐    HTTPS / WSS    ┌────────────────────────┐
│ user browser     │ ◄────────────────► │ nginx (reverse proxy)  │
│ (Vercel-hosted   │                    │   ↓                    │
│  static / SSR)   │                    │   ├─ Spring Boot 4     │
└──────────────────┘                    │   │  /api/v1/* + /ws/  │
                                        │   └─ Hocuspocus        │
                                        │      /collab/*         │
                                        └────────────────────────┘
                                                   │
                                                   ▼
                                        ┌────────────────────────┐
                                        │ PostgreSQL 18          │
                                        │  + JSONB sync columns  │
                                        └────────────────────────┘
```

Components:

| Component | Language | License | Required for self-host |
|---|---|---|---|
| **packages/web** | Next.js 16 / TypeScript | MIT | Yes (frontend) |
| **packages/backend** | Java 25 / Spring Boot 4.0.6 | AGPL v3 | Yes (auth + sync API) |
| **packages/collab** | Node.js / Hocuspocus | AGPL v3 | Yes (doc bodies) |
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

### Observability

- **Sentry** — sign up free at sentry.io, set
  `NEXT_PUBLIC_SENTRY_DSN`. Inert until set.
- **Or self-host** — point the same DSN at GlitchTip running on
  your infrastructure (Sentry-compatible, MIT licensed).
- **Or no observability** — leave the env blank; logs only.

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
