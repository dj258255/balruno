# Security Policy

Balruno is a single-maintainer open-source project. Security reports
are handled directly by the maintainer.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.
Instead use GitHub's private Security Advisory flow:

1. Go to https://github.com/dj258255/balruno/security/advisories/new
2. Provide:
   - the affected component (frontend / backend / collab / desktop)
   - reproduction steps or proof of concept
   - the version or commit SHA you tested against
   - the impact you observed

You will get an acknowledgement within **72 hours**, a triage
assessment within **7 days**, and — for confirmed issues — a fix or
mitigation plan within **30 days**. The advisory stays private until
the fix ships.

## What counts

In scope:

- Authentication / authorisation bypass (workspace, project, share-link)
- Data exfiltration across workspace boundaries
- Sync protocol exploits (op replay, cross-project mutation)
- Stored XSS in cells / comments / doc bodies
- SSRF / RCE in the upload / import paths

Out of scope:

- Issues that require the operator to misconfigure SMTP, OAuth
  credentials, or vault secrets in an obvious way
- Rate limiting on public marketing pages
- Findings against third-party services we proxy (Stripe, Sentry,
  Hocuspocus) — please report those upstream
- Self-host deployments that disable security headers in
  `next.config.ts` / nginx

## Disclosure

Once a fix is released, the advisory is published with credit to the
reporter (unless anonymity is requested). CVE assignment is handled
through GitHub's advisory workflow when applicable.
