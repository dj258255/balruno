// k6/search.js — scenario 2: containment / name lookup.
// On PG this routes to `data @> '{"name":...}'::jsonb` (jsonb_path_ops GIN).
// On MySQL this routes to the generated-column + B-Tree index.
// On Mongo this routes to the path index on `name`.
//
// Same VU profile as scenario 1 so results are comparable.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE = __ENV.BASE;
if (!BASE) throw new Error('BASE env var required');

const names = new SharedArray('names', () => {
  const path = __ENV.NAMES;
  if (!path) throw new Error('NAMES env var required');
  return open(path).split('\n').filter((l) => l.length > 0);
});

const searchLatency = new Trend('search_latency_ms', true);
const errors = new Rate('search_errors');

export const options = {
  scenarios: {
    search: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    search_errors: ['rate<0.01'],
    search_latency_ms: ['p(95)<2000'],
  },
};

export default function () {
  const name = names[Math.floor(Math.random() * names.length)];
  const t0 = Date.now();
  const res = http.get(`${BASE}/search?name=${encodeURIComponent(name)}`);
  const elapsed = Date.now() - t0;
  searchLatency.add(elapsed);
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
