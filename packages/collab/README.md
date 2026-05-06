# @balruno/collab

Hocuspocus-based collaboration server for Balruno's document body sync
(yjs binary). Runs as a sidecar container next to the Spring backend on
`prod-app` and persists into the same Postgres instance via the
`documents` table.

This package only handles **document body** sync — sheet cell ops,
sheet tree, and document tree mutations live on a separate Spring
WebSocket (`/ws/projects/{id}`). See ADR 0008 v2.0 for the four-region
split and ADR 0017 for the deploy plan.

## License

AGPL-3.0-or-later — same as the rest of the backend stack.

## Stage status

ADR 0017 § Stage A.

- [x] V7 migration: `documents` table.
- [x] Hocuspocus skeleton (server.ts + auth.ts).
- [ ] Dockerfile validated against `prod-app` ARM64 build.
- [ ] GitHub Actions deploy workflow.
- [ ] Ansible role + docker-compose entry on `prod-app`.
- [ ] nginx vhost re-test (`collab.balruno.com.conf` already present).

## Local development

```sh
cp .env.example .env.local
# Fill POSTGRES_* and COLLAB_TOKEN_SECRET; the secret needs to match
# whatever the Spring backend's /api/v1/auth/collab-token will use.
npm install
npm run dev
```

The server listens on `:1234` by default. Hocuspocus speaks plain
WebSocket — a `GET /` returns HTTP 426 Upgrade Required (used by the
docker HEALTHCHECK).

## Production wiring (Stage A.4 follow-up)

1. `roles/collab` Ansible role renders `.env` on `prod-app` from vault.
2. `docker-compose.yml` on `prod-app` adds the `collab` service with
   `ports: ['127.0.0.1:1234:1234']`. nginx reverse-proxies
   `collab.balruno.com` to `127.0.0.1:1234` (vhost already exists).
3. The Postgres user the collab container connects with should have
   read+write only on the `documents` table — schema migrations stay
   the backend's job.
