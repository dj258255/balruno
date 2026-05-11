// k6/name-update.js — scenario 3 (write): partial patch on the indexed
// `name` field. PG `jsonb_set` / MySQL `JSON_SET` / Mongo `$set` head-to-head.
// 50 VU × 5min. Each VU picks a random id + writes a freshly-generated name,
// triggering index maintenance (PG GIN / MySQL B-Tree gen col / Mongo path
// index) along with the underlying row write.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE = __ENV.BASE;
if (!BASE) throw new Error('BASE env var required');

const sheetIds = new SharedArray('ids', () => {
  const path = __ENV.IDS;
  if (!path) throw new Error('IDS env var required (file path)');
  return open(path).split('\n').filter((l) => l.length > 0);
});

const writeLatency = new Trend('name_update_latency_ms', true);
const errors = new Rate('name_update_errors');

export const options = {
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    name_update: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    name_update_errors: ['rate<0.01'],
    name_update_latency_ms: ['p(95)<2000'],
  },
};

const ADJ = ['arcane', 'brutal', 'crystal', 'dread', 'echo', 'frost', 'gilded', 'hollow', 'iron', 'jade'];
const NOUN = ['ember', 'fang', 'glyph', 'hammer', 'ire', 'jewel', 'kris', 'lance', 'mantle', 'nexus'];
const rndStr = (len) => {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

export default function () {
  const id = sheetIds[Math.floor(Math.random() * sheetIds.length)];
  const newName = `${ADJ[Math.floor(Math.random() * ADJ.length)]}-${NOUN[Math.floor(Math.random() * NOUN.length)]}-${rndStr(4)}`;
  const t0 = Date.now();
  const res = http.patch(
    `${BASE}/sheet/${id}/name`,
    JSON.stringify({ name: newName }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const elapsed = Date.now() - t0;
  writeLatency.add(elapsed);
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
  });
  errors.add(!ok);
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: false }),
    [__ENV.SUMMARY_OUT || '/work/results/summary.json']: JSON.stringify(data),
  };
}
