// k6/sheet-get.js — scenario 1: sheet GET by id (~50KB JSON response).
// 50 VU × 5min, ids drawn from the sample list created by run-benchmark.sh.
// Each VU picks a random id from the list so warm/cold cache mixes.
//
// Usage:
//   k6 run -e BASE=http://localhost:8181 -e IDS=/work/ids.txt \
//          --out json=/work/results/mysql-sheet-get.json \
//          /work/k6/sheet-get.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE = __ENV.BASE;
if (!BASE) throw new Error('BASE env var required (http://host:port)');

const sheetIds = new SharedArray('ids', () => {
  const path = __ENV.IDS;
  if (!path) throw new Error('IDS env var required (file path)');
  const text = open(path);
  return text.split('\n').filter((l) => l.length > 0);
});

const getLatency = new Trend('sheet_get_latency_ms', true);
const errors = new Rate('sheet_get_errors');

export const options = {
  // p99 is what people quote in postmortems / SLOs — the default
  // ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'] is missing it.
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    sheet_get: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    sheet_get_errors: ['rate<0.01'],            // <1% errors
    sheet_get_latency_ms: ['p(95)<2000'],       // intentionally loose — measurement, not gate
  },
};

export default function () {
  const id = sheetIds[Math.floor(Math.random() * sheetIds.length)];
  const t0 = Date.now();
  const res = http.get(`${BASE}/sheet/${id}`);
  const elapsed = Date.now() - t0;
  getLatency.add(elapsed);
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has body': (r) => r.body && r.body.length > 100,
  });
  errors.add(!ok);
  // Tiny think time to avoid synthetic tight-loop artifacts
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: false }),
    [__ENV.SUMMARY_OUT || '/work/results/summary.json']: JSON.stringify(data),
  };
}
