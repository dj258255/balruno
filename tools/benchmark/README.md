# balruno-bench

**일회성 DB 벤치마크 번들.** OCI prod_app 에서 docker compose 로 MySQL 8 / PostgreSQL 18 / MongoDB 7 를 임시로 띄워서 같은 CRUD API 와 같은 부하 패턴으로 비교 측정한 뒤, 결과를 회수하고 흔적을 0으로 정리한다.

이력서/블로그의 *"같은 CRUD API 를 3개 DB 에 각각 연결해 직접 측정"* 명세에 맞는 실측 자료를 만드는 게 목적이다.

---

## 측정 환경

| 항목 | 값 |
|---|---|
| 호스트 | OCI prod_app (ARM Ampere A1, 2 OCPU, 12 GB) |
| 네트워크 | OCI VCN 내부 (DB 와 API 모두 같은 docker compose bridge 네트워크) |
| 데이터 | 시트 10,000 개 × 약 16 컬럼 × 평균 약 50 KB/시트 (총 약 500 MB) |
| 부하 | k6 50 VU × 5 분 (시나리오마다) |
| 시나리오 | (1) `GET /sheet/:id` — 시트 통째 50 KB 응답  /  (2) `GET /search?name=` — name 키 lookup |
| API 레이어 | Node.js 22 + Express 미니멀 래퍼 3개 (같은 골격, DB 드라이버만 다름) |
| 인덱스 | MySQL: 생성된 컬럼 + B-Tree  /  PG: `jsonb_path_ops` GIN  /  Mongo: `name` path 인덱스 |

같은 프레임워크 오버헤드 (Express + Node 22) 위에서 측정하므로 결과 차이는 *DB + 쿼리 플랜 차이* 만 반영한다.

---

## 디렉토리 구조

```
balruno-bench/
├── docker-compose.yml        # 3 DB + 3 API wrapper, all on bench network
├── seed/
│   ├── package.json
│   ├── generate-sheets.mjs   # NDJSON 으로 시트 10,000개 생성
│   ├── seed-mysql.mjs        # MySQL 8 JSON 컬럼 + generated col 인덱스
│   ├── seed-pg.mjs           # PG 18 JSONB + jsonb_path_ops GIN
│   └── seed-mongo.mjs        # Mongo 7 + name path 인덱스
├── api/
│   ├── mysql-api/   # :8181 — GET /sheet/:id, GET /search?name=...
│   ├── pg-api/      # :8182
│   └── mongo-api/   # :8183
├── k6/
│   ├── sheet-get.js          # 시나리오 1
│   └── search.js             # 시나리오 2
├── results/                  # 측정 결과 (run-benchmark.sh 가 채움)
├── run-benchmark.sh          # 전 과정 실행
├── cleanup.sh                # 흔적 0 정리
└── README.md                 # 이 문서
```

---

## 실행 절차 (prod_app 에서)

### 0. (선행) 모니터링 보강 (선택)

cAdvisor + Spring Actuator + 3 Grafana 대시보드 보강이 필요하면 `docs/backend/MONITORING_UPGRADE.md` 가이드 먼저 적용. 측정 자체는 모니터링 보강 없이도 돌아간다.

### 1. 번들 전송 (Mac → prod_app)

```bash
scp -r ~/Desktop/balruno/tools/benchmark/ rocky@<prod_app_public_ip>:/tmp/
```

### 2. 벤치마크 실행 (prod_app SSH 후)

```bash
ssh rocky@<prod_app_public_ip>
cd /tmp/benchmark
./run-benchmark.sh
```

시간: 약 30~40 분.

진행 단계:
1. `docker compose up -d` — 3 DB + 3 API 컨테이너 (이미지 빌드 포함 약 2~3 분)
2. `generate-sheets.mjs` — NDJSON 시드 파일 생성 (약 3 분)
3. MySQL / PG / Mongo 병렬 시드 (약 5 분)
4. EXPLAIN / executionStats 캡처
5. k6 시트 GET × 3 DB (각 5 분, 총 15 분)
6. k6 search × 3 DB (각 5 분, 총 15 분)
7. `results/SUMMARY.md` 자동 작성

### 3. 결과 회수 (Mac 로 복사)

```bash
scp -r rocky@<prod_app_public_ip>:/tmp/benchmark/results ./benchmark-results-$(date +%Y%m%d)
```

`results/` 안에 들어가는 것:
- `SUMMARY.md` — 6개 시나리오 p50/p95/p99 표
- `*-sheet-get.summary.json` / `*-search.summary.json` — k6 요약 JSON
- `*-sheet-get.json` / `*-search.json` — k6 전체 출력 (시점별 timeseries)
- `*-sheet-get.log` / `*-search.log` — k6 stdout
- `explain-pg-*.txt`, `explain-mysql-*.txt`, `explain-mongo-*.txt` — EXPLAIN / executionStats 캡처
- `seed-*.log` — 시드 로그
- `ids.txt`, `names.txt` — 부하 시 사용한 샘플

### 4. 정리 (prod_app SSH 후)

```bash
cd /tmp/benchmark
./cleanup.sh

# 작업 디렉토리 자체도 지우려면
cd /tmp && rm -rf benchmark
```

이러면 prod_app 에는 `docker volume ls | grep balruno-bench` 가 빈 결과를 돌려주는 상태가 된다.

---

## 면접 시 참조 자료

이 측정의 *진실원* 은:

| 자료 | 위치 | 면접관 질문에 답할 때 |
|---|---|---|
| `results/SUMMARY.md` | 회수한 결과 디렉토리 | "측정 결과는요?" |
| `results/*.summary.json` | 동일 | "k6 산출물 있나요?" |
| `results/explain-*.txt` | 동일 | "GIN 인덱스가 실제로 탔는지 어떻게 확인했어요?" |
| `seed/generate-sheets.mjs` | 본 디렉토리 (commit 권장) | "데이터 형상은 어떻게 만들었어요?" |
| `k6/*.js` | 동일 | "k6 스크립트 보여주세요" |
| `docker-compose.yml` | 동일 | "측정 환경 재현 가능해요?" |

번들 전체를 *balruno repo 의 `tools/benchmark/` 또는 별도 `balruno-bench` 레포에 commit* 해두면 추적성이 살아남는다. 측정 시점/커밋 해시/k6 버전 모두 git 으로 봉인됨.

---

## 알려진 한계 (정직성)

- **5 분 부하 / 50 VU** — 24 시간 sustained 부하가 아니라 *비교 측정용 짧은 부하* 임. 절댓값보다 *3 DB 간 상대 비율* 에 의미.
- **단일 호스트** — DB 와 API 가 같은 ARM 12GB 머신에 공존. 실제 prod 분리 구성과 다름. 같은 호스트이므로 *네트워크 latency 가 거의 0* 인데 이게 PG/MySQL/Mongo 모두에게 똑같이 적용되므로 비교는 공정.
- **10,000 개 시트** — Balruno 의 실제 MVP 규모에 맞춘 측정. 1M 시트 규모에서는 결과가 달라질 수 있음.
- **prod 데이터 아님** — 합성 데이터 (PRNG seed = 20260511 로 재현 가능). 실제 사용자 시트와 모양은 비슷하지만 분포는 다름.

이 한계들은 *측정 결과 표 옆에 같이 적어두면* 면접관 신뢰가 오히려 올라간다. 한계를 가린 측정보다 *명시한 측정* 이 시그널이 강함.
