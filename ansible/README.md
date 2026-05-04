# Balruno Ansible

> OCI Always Free 4대 (ARM 12GB ×2 + x86 1GB ×2) 자동 프로비저닝.
> 결정 진실원: `docs/backend/decisions/0007-infrastructure.md` v1.1 + `decisions/0010-infra-evolution.md`
> wikiEngine 패턴 차용 (vault_password_file, ssh ControlMaster, role 구조).

---

## 머신 4대 (ADR 0007 v1.1 §3.1)

| Hostname | Public IP | 사양 | 역할 |
|---|---|---|---|
| **prod-app** | 168.107.47.33 | ARM 12GB | Spring Boot 4.1 + Java 25 + Hocuspocus + Nginx |
| **monitor** | 168.107.10.100 | ARM 12GB | PostgreSQL 17 + Grafana + Loki + Alloy + Prometheus + alertmanager + InfluxDB |
| **backup** | 134.185.108.159 | x86 1GB | pg_dump rsync 수신 + cloudflared (monitor.balruno.com Tunnel) + node_exporter |
| **status** | 158.179.162.44 | x86 1GB | Uptime Kuma (status.balruno.com) + Object Storage upload daemon + node_exporter |

**OS**: Rocky Linux 9, **SSH user**: rocky, **SSH key**: `~/.ssh/oci_key`
**같은 VCN** (10.0.0.0/24) — internal 통신 1ms

---

## 디렉토리 구조

```
ansible/
├── ansible.cfg                    Ansible 설정 (vault_password_file, ssh)
├── inventory.yml                  4대 host 정의 + 그룹
├── group_vars/
│   ├── all.yml                    공통 변수 (도메인, 버전, JVM/PG 기본값)
│   ├── vault.yml                  시크릿 (ansible-vault 암호화) — git ignore
│   └── vault.yml.example          시크릿 템플릿
├── playbooks/                     (선택) 개별 playbook
├── roles/
│   ├── common                     swap / fail2ban / Docker / SSH hardening
│   ├── nginx                      Nginx + Cloudflare Origin Cert + reverse proxy
│   ├── postgres                   PostgreSQL 17 + tuning + pg_hba
│   ├── spring-boot                Spring Boot 4.1 + Java 25 systemd unit
│   ├── hocuspocus                 Hocuspocus Node 22 systemd unit
│   ├── monitoring                 Docker Compose: Grafana + Loki + Alloy + Prometheus + alertmanager + InfluxDB
│   ├── uptime-kuma                Docker Uptime Kuma (status.balruno.com)
│   ├── cloudflared                Cloudflare Tunnel daemon (backup 머신)
│   ├── backup                     pg_dump cron + rsync 수신
│   └── object-storage-upload      OCI CLI + cron (status 머신)
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
| `ANSIBLE_VAULT_PASSWORD` | `/Users/beomsu/Desktop/wikiEngine/ansible/.vault_pass` 파일 내용 (텍스트 그대로) |
| `OCI_SSH_PRIVATE_KEY` | `~/.ssh/oci_key` 파일 내용 (PEM 헤더 포함 통째로) |

`production` Environment 도 만들어서 main 으로 merge 시 수동 approve 게이트 걸 수 있음 (선택, Stage 1+ 권장).

---

## 로컬 사용법

### 1. 사전 준비 (1회)

```bash
# vault.yml 생성 (예시 복사 후 실제 시크릿 채우기)
cp group_vars/vault.yml.example group_vars/vault.yml
# 시크릿 채운 후 암호화
ansible-vault encrypt group_vars/vault.yml --vault-password-file /Users/beomsu/Desktop/wikiEngine/ansible/.vault_pass
```

### 2. 4대 SSH 접속 검증 (Step 1 — 첫 작업)

```bash
cd /Users/beomsu/Desktop/balruno/ansible
ansible -i inventory.yml all -m ping
# 모든 머신에서 "pong" 반환되어야 함
```

### 3. 전체 셋업 (Phase B-6 ~ B-7)

```bash
# 전체 통합
ansible-playbook -i inventory.yml site.yml

# 특정 머신만
ansible-playbook site.yml --limit prod_app
ansible-playbook site.yml --limit monitor

# 특정 role 만 (idempotent)
ansible-playbook site.yml --tags nginx
ansible-playbook site.yml --tags monitoring

# Dry run (변경 없이 무엇이 바뀔지만 확인)
ansible-playbook site.yml --check --diff
```

### 4. 시크릿 편집

```bash
ansible-vault edit group_vars/vault.yml --vault-password-file /Users/beomsu/Desktop/wikiEngine/ansible/.vault_pass
```

---

## 작업 순서 (Phase B-6)

```
Step 1: ansible -i inventory.yml all -m ping             ← 4대 SSH 검증
Step 2: ansible-playbook site.yml --tags common --limit all   ← swap/fail2ban/Docker
Step 3: ansible-playbook site.yml --limit monitor        ← PG + Grafana stack 먼저
Step 4: ansible-playbook site.yml --limit prod_app       ← Spring + Hocuspocus + Nginx
Step 5: ansible-playbook site.yml --limit backup         ← pg_dump + cloudflared
Step 6: ansible-playbook site.yml --limit status         ← Uptime Kuma + Object Storage
Step 7: 검증 + 스크린샷 (블로그 2편/5편 자료)
```

---

## 보안

- SSH: `PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers rocky`, fail2ban 3회 실패 → 1시간 차단
- Security List: 22 (본인 IP only), 80/443 (Cloudflare IP only), 5432/3000/9090 (VCN only)
- vault: ansible-vault AES256 — 모든 시크릿 (DB password / JWT secret / OAuth client / Grafana admin / Cloudflare Tunnel token / OCI API key)
- 암호 파일: `~/.ssh/.vault_pass` (chmod 600) — wikiEngine 재사용

---

## 참조

- ADR 0007 v1.1: 인프라 결정
- ADR 0010: 인프라 점진 진화 9 영역
- ADR 0008 v2.0: Tree + Cell Event Sync
- HANDOFF.md v1.2: 결정 7대 원칙
- 메모리 `project_infra_stack.md`
- wikiEngine `/Users/beomsu/Desktop/wikiEngine/ansible/` (패턴 차용 원본)
