// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Balruno collab server — Hocuspocus + Postgres for the document-body
 * sync region (yjs binary state). Sheet/tree sync runs on a separate Spring
 * WebSocket; see ADR 0008 v2.0 for the 4-region split, ADR 0017 §2 for
 * how this container fits the deploy.
 *
 * Persistence model: the canonical row in {@code documents} is created
 * by the Spring backend (Stage B work), which also owns soft-delete.
 * This server does not insert orphan rows — first-write to a missing
 * document drops the save and logs a warning, so a dangling client can
 * never spawn a phantom document outside the project tree.
 */

import http from 'node:http';

import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import pg from 'pg';

import { verifyCollabToken } from './auth.js';

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable is required`);
  return v;
};

const pool = new pg.Pool({
  host: requireEnv('POSTGRES_HOST'),
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: requireEnv('POSTGRES_USER'),
  password: requireEnv('POSTGRES_PASSWORD'),
  database: requireEnv('POSTGRES_DB'),
  // Hocuspocus serialises onStoreDocument per document, so a small pool
  // is enough; we cap at 10 to leave headroom for the backend's pool.
  max: 10,
  // Local network — short timeouts are safer than hung handshakes.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

const port = Number(process.env.COLLAB_PORT ?? 1234);

const server = new Server({
  port,
  address: '0.0.0.0',

  /**
   * Verify the short-lived collab token before letting the connection
   * subscribe to a document. The token must encode the same documentId
   * as the WebSocket path — prevents a valid token for doc A from being
   * used to connect to doc B.
   */
  async onAuthenticate(data) {
    const token = (data.token ?? '').trim();
    if (!token) throw new Error('missing collab token');
    const claims = verifyCollabToken(token);
    if (claims.doc !== data.documentName) {
      throw new Error('collab token document mismatch');
    }
    return { userId: claims.sub, documentId: claims.doc };
  },

  /**
   * On first subscribe, hydrate the Y.Doc from {@code documents.ydoc_state}.
   * Missing / soft-deleted rows return an empty Y.Doc — the client can
   * still edit locally; persistence is gated below.
   */
  async onLoadDocument(data) {
    const documentId = data.documentName;
    const result = await pool.query<{ ydoc_state: Buffer }>(
      'SELECT ydoc_state FROM documents WHERE id = $1 AND deleted_at IS NULL',
      [documentId],
    );
    const ydoc = new Y.Doc();
    if (result.rowCount && result.rowCount > 0 && result.rows[0]) {
      Y.applyUpdate(ydoc, result.rows[0].ydoc_state);
    }
    return ydoc;
  },

  /**
   * Persist the latest state vector. UPDATE-only on purpose: orphan
   * INSERTs would let a leaked token spawn rogue documents outside the
   * project tree. Until Stage B exposes a "register document" endpoint
   * the row must already exist — created by whichever backend path
   * mints the document metadata.
   *
   * Also writes a sparse {@code doc_snapshots} row for the page-history
   * surface (ADR 0038 stage C). Throttle = "every 50 store calls OR 5
   * minutes since the last snapshot, whichever first" — every keystroke
   * already debounces into one onStoreDocument, so this is roughly
   * "1 snapshot per 50 edit-bursts or per 5 idle minutes".
   */
  async onStoreDocument(data) {
    const documentId = data.documentName;
    const update = Y.encodeStateAsUpdate(data.document);
    const r = await pool.query(
      `UPDATE documents
         SET ydoc_state = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL`,
      [Buffer.from(update), documentId],
    );
    if (r.rowCount === 0) {
      console.warn(`[collab] no active document row, dropped save: ${documentId}`);
      return;
    }
    await maybeWriteSnapshot(data, update);
  },
});

interface SnapshotState {
  storesSinceSnapshot: number;
  lastSnapshotAt: number;
}

const SNAPSHOT_EVERY_N_STORES = 50;
const SNAPSHOT_EVERY_MS = 5 * 60 * 1000;
const snapshotState = new Map<string, SnapshotState>();

interface StoreData {
  documentName: string;
  context?: { userId?: string };
  document: Y.Doc;
}

async function maybeWriteSnapshot(data: StoreData, update: Uint8Array): Promise<void> {
  const documentId = data.documentName;
  const now = Date.now();
  const state = snapshotState.get(documentId)
    ?? { storesSinceSnapshot: 0, lastSnapshotAt: 0 };
  state.storesSinceSnapshot += 1;
  const dueByCount = state.storesSinceSnapshot >= SNAPSHOT_EVERY_N_STORES;
  const dueByTime = now - state.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (!dueByCount && !dueByTime) {
    snapshotState.set(documentId, state);
    return;
  }

  // Pull projectId from documents row — needed for the snapshot's
  // FK + the retention scheduler's per-workspace plan lookup.
  const meta = await pool.query<{ project_id: string }>(
    'SELECT project_id FROM documents WHERE id = $1 AND deleted_at IS NULL',
    [documentId],
  );
  const projectId = meta.rowCount && meta.rowCount > 0 && meta.rows[0]
    ? meta.rows[0].project_id
    : null;
  if (!projectId) {
    // Document disappeared between UPDATE and snapshot read — drop
    // silently. The next save attempt will re-evaluate.
    return;
  }

  const summary = extractSummary(data.document);
  const actorId = data.context?.userId ?? null;
  try {
    await pool.query(
      `INSERT INTO doc_snapshots
         (doc_id, project_id, actor_id, yjs_state, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [documentId, projectId, actorId, Buffer.from(update), summary],
    );
    state.storesSinceSnapshot = 0;
    state.lastSnapshotAt = now;
    snapshotState.set(documentId, state);
  } catch (err) {
    // Snapshot is best-effort; the user's edits already saved to
    // documents.ydoc_state above. A failed snapshot just means the
    // page-history list misses one moment.
    console.warn(`[collab] doc_snapshots insert failed for ${documentId}`, err);
  }
}

/**
 * First ~120 chars of the document's plain text — used as a preview
 * in the page-history list so the user can pick a moment without
 * downloading the full yjs state. Best-effort: walks the default
 * 'default' fragment and gives up gracefully on shape mismatches.
 */
function extractSummary(doc: Y.Doc): string | null {
  try {
    const fragments = ['default', 'doc', 'content'];
    for (const name of fragments) {
      const xml = doc.getXmlFragment(name);
      const text = xml.toString();
      if (text && text.length > 0) {
        // toString returns serialised XML; strip tags for the preview.
        const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plain.length > 0) return plain.slice(0, 120);
      }
    }
  } catch {
    // Shape we don't know how to walk — let the snapshot land
    // without a summary.
  }
  return null;
}

server
  .listen()
  .then(() => console.log(`[collab] hocuspocus listening on :${port}`))
  .catch((err: unknown) => {
    console.error('[collab] failed to start', err);
    process.exit(1);
  });

// ─── Internal HTTP server for backend-to-sidecar signals ──────────────
// Port + secret come from env. Bound to 127.0.0.1 only (process-local
// internal channel — never exposed). Spring's DocDuplicateApiImpl hits
// /internal/snapshot/:docId right before reading documents.ydoc_state
// for a clone, so the bytes reflect the live in-memory state instead
// of the last throttled onStoreDocument flush (which can lag by up to
// 50 stores OR 5 idle minutes).
const internalSecret = process.env.COLLAB_INTERNAL_SECRET ?? '';
const internalPort = Number(process.env.COLLAB_INTERNAL_PORT ?? 1235);

if (!internalSecret) {
  console.warn(
    '[collab] COLLAB_INTERNAL_SECRET unset — internal endpoints will return 401',
  );
}

const internalServer = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  // Header-based shared-secret auth — internal-only, no JWT churn.
  // Empty secret never matches (handled by the falsy check + the
  // strict equality on a non-empty header).
  const headerSecret = req.headers['x-collab-internal-secret'];
  if (
    !internalSecret
    || typeof headerSecret !== 'string'
    || headerSecret !== internalSecret
  ) {
    res.writeHead(401).end();
    return;
  }

  const m = req.url?.match(/^\/internal\/snapshot\/([0-9a-f-]{36})\/?$/i);
  if (!m) {
    res.writeHead(404).end();
    return;
  }
  const docId = m[1] ?? '';

  try {
    const doc = server.hocuspocus.documents.get(docId);
    if (!doc) {
      // No live editor session for this doc — the most recent
      // onStoreDocument write is already on disk. Caller (Spring's
      // duplicate path) can proceed to read documents.ydoc_state
      // without further delay.
      res.writeHead(200, { 'Content-Type': 'application/json' })
         .end(JSON.stringify({ snapshot: 'idle' }));
      return;
    }
    // Live session — pull the current in-memory state and write it
    // to the documents row directly. This bypasses the
    // onStoreDocument throttle so the duplicate sees the absolute
    // latest bytes. Uses the same UPDATE shape onStoreDocument uses.
    // Hocuspocus's Document class extends yjs's Y.Doc, so the
    // doc instance itself is what Y.encodeStateAsUpdate expects —
    // no .document accessor (the .document property only exists on
    // hook payloads like onStoreDocument's `data.document`).
    const update = Y.encodeStateAsUpdate(doc);
    const r = await pool.query(
      `UPDATE documents
         SET ydoc_state = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL`,
      [Buffer.from(update), docId],
    );
    res.writeHead(200, { 'Content-Type': 'application/json' })
       .end(JSON.stringify({
         snapshot: r.rowCount && r.rowCount > 0 ? 'flushed' : 'no-row',
         bytes: update.byteLength,
       }));
  } catch (e) {
    console.error('[collab] /internal/snapshot failed', e);
    res.writeHead(500).end();
  }
});
internalServer.listen(internalPort, '127.0.0.1', () => {
  console.log(`[collab] internal HTTP listening on 127.0.0.1:${internalPort}`);
});

// Graceful shutdown — SIGTERM from docker stop / k8s rolling deploy.
const shutdown = (signal: string) => {
  console.log(`[collab] received ${signal}, shutting down`);
  internalServer.close();
  server.destroy()
    .catch((err: unknown) => console.error('[collab] shutdown error', err))
    .finally(() => {
      void pool.end();
      process.exit(0);
    });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
