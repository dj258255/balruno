/**
 * Tagged logger for sync / presence / collab hooks. Tiny on
 * purpose — the goal is "filter by tag in DevTools" not "ship to a
 * structured logging backend". When real observability lands
 * (Sentry / PostHog), this module gets the integration without
 * touching call sites.
 *
 * Tag conventions used in the codebase:
 *   - sync.ws      — useProjectSync WebSocket lifecycle
 *   - sync.doc     — useDocYjsCloudSync / Hocuspocus
 *   - sync.bridge  — useProjectSyncBridge dispatch
 *   - sync.queue   — writeQueue emit / region routing
 *   - presence     — usePresence merge / publish
 *   - tree         — sheet_tree / doc_tree mutation surface
 *   - import       — Stage F template import
 *
 * Usage:
 *   const log = makeLog('sync.ws');
 *   log.warn('connect failed', { reason: e.name });
 *
 * Each level prefixes the tag so a DevTools filter on "sync.ws"
 * shows only those frames. Levels match console.* for muscle
 * memory: debug / info / warn / error.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

interface TaggedLog {
  debug: (msg: string, ...rest: unknown[]) => void;
  info: (msg: string, ...rest: unknown[]) => void;
  warn: (msg: string, ...rest: unknown[]) => void;
  error: (msg: string, ...rest: unknown[]) => void;
}

const isProd =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

function emit(level: Level, tag: string, msg: string, rest: unknown[]): void {
  // Drop debug / info noise in production. Warn / error always surface
  // — those are operational signals worth keeping in the user's
  // DevTools even on a deployed site.
  if (isProd && (level === 'debug' || level === 'info')) return;
  const prefix = `[${tag}]`;
  const fn = console[level] ?? console.log;
  fn(prefix, msg, ...rest);
}

export function makeLog(tag: string): TaggedLog {
  return {
    debug: (msg, ...rest) => emit('debug', tag, msg, rest),
    info: (msg, ...rest) => emit('info', tag, msg, rest),
    warn: (msg, ...rest) => emit('warn', tag, msg, rest),
    error: (msg, ...rest) => emit('error', tag, msg, rest),
  };
}
