# Balruno Ansible

> OCI Always Free 단일 호스트 (ARM 12GB) 자동 프로비저닝.
> wikiEngine 패턴 차용 (vault_password_file, ssh ControlMaster, role 구조).
> 히스토리: 4대 (2026-05 초) → 2대 (2026-05-21 consolidation) → 1대 (2026-07-06).

---

## 머신 (deploy matrix)

| Hostname | Public IP | 사양 | 역할 |
|---|---|---|---|
| **prod-app** | `{{ prod_app_public_ip }}` | ARM 12GB | Spring Boot + Nginx + PostgreSQL 18 + 모니터링 스택 + pg_dump + R2 offsite upload + cloudflared Tunnel |

백업은 로컬 pg_dump (7일 window) + Cloudflare R2 offsite (30일 lifecycle) 2단 구성.

> 실제 IP 는 `group_vars/all/vault.yml` (ansible-vault 암호화) 에 보관 — 위 표는 변수 참조만 표기.

**OS**: Rocky Linux 9, **SSH user**: rocky, **SSH key**: `~/.ssh/oci_key`
**같은 VCN** (10.0.0.0/24) — internal 통신 1ms

---

## 디렉토리 구조

```
ansible/
├── ansible.cfg                    Ansible 설정 (vault_password_file, ssh)
├── inventory.yml                  host 정의
├── group_vars/
│   └── all/                       모든 호스트에 적용되는 변수 (Ansible 권장 패턴)
│       ├── vars.yml               공통 변수 (도메인, 버전, JVM/PG 기본값)
│       ├── vault.yml              시크릿 (ansible-vault 암호화) — commit OK
│       └── vault.yml.example      시크릿 템플릿
├── playbooks/                     (선택) 개별 playbook
├── roles/
│   ├── common                     swap / fail2ban / Docker / SSH hardening
│   ├── nginx                      Nginx + Cloudflare Origin Cert + reverse proxy
│   ├── postgres                   PostgreSQL 18 + tuning + pg_hba
│   ├── backend                Spring Boot 4.0.6 + Java 25 systemd unit
│   ├── monitoring                 Docker Compose: Grafana + Loki + Alloy + Prometheus + alertmanager + InfluxDB + blackbox_exporter
│   ├── cloudflared                Cloudflare Tunnel daemon (monitor.balruno.com → Grafana)
│   ├── backup                     pg_dump cron (로컬 7일 window)
│   └── object-storage-upload      AWS CLI + cron (R2 offsite upload)
├── site.yml                       전체 통합 playbook
└── .gitignore                     vault.yml + .vault_pass 제외
```

---

## 실행 방식 (GitOps + 로컬 fallback)

| 시나리오 | 도구 | 트리거 |
|---|---|---|
| **PR review** | GH Actions `ansible-check` | PR 생성/갱신 시 자동 dry-run (`--check --diff`) |
| **자동 배포** | GH Actions `ansible-deploy` | main 으로 merge 되면 자동 apply |
| **수동 배포** | GH Actions `ansible-deploy` (workflow_dispatch) | Actions UI 에서 limit/tags 지정해서 실행 |
| **로컬 ad-hoc** | macOS 터미널 | 비상시, 인터랙티브 디버깅, 첫 부트스트랩 검증 |

GH Secrets (Settings → Secrets and variables → Actions):

| 이름 | 값 |
|---|---|
| `ANSIBLE_VAULT_PASSWORD` | vault password 파일 내용 (텍스트 그대로 — `$ANSIBLE_VAULT_PASSWORD_FILE` 경로 안의 값) |
| `OCI_SSH_PRIVATE_KEY` | `~/.ssh/oci_key` 파일 내용 (PEM 헤더 포함 통째로) |
| `ACTUATOR_INTERNAL_TOKEN` | (선택) the optional actuator gate token. vault.yml 의 `vault_actuator_internal_token` 과 같은 값. backend-deploy 의 smoke test 가 `X-Internal-Token` header 로 사용. 미설정 시 gate 비활성. |

`production` Environment 도 만들어서 main 으로 merge 시 수동 approve 게이트 걸 수 있음 (선택, Stage 1+ 권장).

### 무중단 배포 (blue/green pattern)

backend 컨테이너는 blue/green 슬롯 + nginx upstream `backup` directive + snippet symlink swap 으로 무중단 배포. backend-deploy 워크플로가 자동 처리.

- 평소: 한 색깔 (blue 또는 green) 만 running. nginx active symlink (`/etc/nginx/conf.d/balruno-backend-active.conf`) 가 그 색깔의 snippet 가리킴.
- 배포: 반대 색깔 컨테이너 시작 → `/actuator/health/readiness` 200 대기 → symlink swap + `nginx -s reload` (graceful) → 30s rollback window → 옛 색깔 stop.
- 첫 마이그레이션 cutover 만 ~21s 다운타임 (옛 단일 컨테이너 → 새 dual slot). 이후 모든 cutover 는 zero-downtime.
- 수동 rollback: `gh workflow run backend-deploy.yml -f mode=rollback` (~30s 윈도 안에서만 instant flip, 이후엔 이전 SHA 재배포).

### Actuator gate (optional internal-token gate)

`/actuator/*` 엔드포인트는 nginx 단계 internal-token gate 로 보호. graceful gating 패턴이라 vault token 미정의 시 gate 비활성.

활성화:
1. `ansible-vault edit group_vars/all/vault.yml` 에서 `vault_actuator_internal_token: <openssl rand -hex 32>` 추가.
2. 같은 값을 `gh secret set ACTUATOR_INTERNAL_TOKEN` 으로 등록.
3. push 또는 manual ansible-deploy 트리거.

세 곳 (nginx api vhost / monitor blackbox_exporter / backend-deploy smoke test) 이 같은 token 으로 동기화.

---

## 로컬 사용법

### 0. 환경 변수 (1회 — `~/.zshrc` 등에 추가)

`group_vars/all/vault.yml` 은 `ansible-vault` 로 암호화돼 commit 됨. 복호화 password 가 들어 있는 파일 경로를 환경변수로 알려줘야 로컬에서 playbook 실행 가능.

```bash
# 본인이 사용할 password 파일 경로 (operator 가 직접 선택).
# 권장 위치 예: ~/.config/balruno/ansible.vault_pass 또는 1Password CLI fetch script.
export ANSIBLE_VAULT_PASSWORD_FILE="$HOME/.config/balruno/ansible.vault_pass"
```

OSS contributor 는 본인 password 로 vault 를 다시 암호화해야 함 (`ansible-vault rekey group_vars/all/vault.yml`).

CI 는 GitHub Secret `ANSIBLE_VAULT_PASSWORD` 로 자동 주입되므로 별도 설정 불필요.

### 1. 사전 준비 (1회)

```bash
# vault.yml 생성 (예시 복사 후 실제 시크릿 채우기)
cp group_vars/all/vault.yml.example group_vars/all/vault.yml
# 시크릿 채운 후 암호화
ansible-vault encrypt group_vars/all/vault.yml --vault-password-file "$ANSIBLE_VAULT_PASSWORD_FILE"
```

### 2. SSH 접속 검증 (Step 1 — 첫 작업)

```bash
cd ansible
ansible -i inventory.yml all -m ping
# 모든 머신에서 "pong" 반환되어야 함
```

### 3. 전체 셋업 (initial bootstrap)

```bash
# 전체 통합
ansible-playbook -i inventory.yml site.yml

# 특정 머신만
ansible-playbook site.yml --limit prod_app

# 특정 role 만 (idempotent)
ansible-playbook site.yml --tags nginx
ansible-playbook site.yml --tags monitoring

# Dry run (변경 없이 무엇이 바뀔지만 확인)
ansible-playbook site.yml --check --diff
```

### 4. 시크릿 편집

```bash
ansible-vault edit group_vars/all/vault.yml --vault-password-file "$ANSIBLE_VAULT_PASSWORD_FILE"
```

---

## 작업 순서 (initial bootstrap)

```
Step 1: ansible -i inventory.yml all -m ping             ← SSH 검증
Step 2: ansible-playbook site.yml --tags common          ← swap/fail2ban/Docker
Step 3: ansible-playbook site.yml --limit prod_app       ← 전체 스택 (PG + Spring + Nginx + 모니터링 + 백업 + 터널)
Step 4: 검증 (도메인 hit / actuator / Grafana 대시보드 / backup-verify tag 실행)
```

---

## 보안

- SSH: `PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers rocky`, fail2ban 3회 실패 → 1시간 차단
- Security List: 80/443 (Cloudflare IPv4 CIDR ×15 only — 2026-05-20 lockdown), 22 (0.0.0.0/0 — fail2ban + key-only 의존, 추후 Cloudflare Tunnel SSH 이전 고려), 5432/3000/9090 (VCN 10.0.0.0/16 only)
- vault: ansible-vault AES256 — 모든 시크릿 (DB password / JWT secret / OAuth client / Grafana admin / Cloudflare Tunnel token / OCI API key)
- 암호 파일: `ansible/.vault_pass` (chmod 600, gitignored) — operator local + CI 의 `ANSIBLE_VAULT_PASSWORD` GitHub Secret

---

## 참조

- 인프라 결정
- 인프라 점진 진화 9 영역
- Tree + Cell Event Sync
- HANDOFF.md v1.2: 결정 7대 원칙
