// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Balruno collab server — Hocuspocus + Postgres for the document-body
 * sync region (yjs binary). Sheet/tree sync runs on a separate Spring
 * WebSocket; see ADR 0008 v2.0 for the 4-region split, ADR 0017 §2 for
 * how this container fits the deploy.
 *
 * Persistence model: the canonical row in {@code documents} is created
 * by the Spring backend (Stage B work), which also owns soft-delete.
 * This server does not insert orphan rows — first-write to a missing
 * document drops the save and logs a warning, so a dangling client can
 * never spawn a phantom document outside the project tree.
 */

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
   * On first subscribe, hydrate the Y.Doc from {@code documents.binary}.
   * Missing / soft-deleted rows return an empty Y.Doc — the client can
   * still edit locally; persistence is gated below.
   */
  async onLoadDocument(data) {
    const documentId = data.documentName;
    const result = await pool.query<{ binary: Buffer }>(
      'SELECT binary FROM documents WHERE id = $1 AND deleted_at IS NULL',
      [documentId],
    );
    const ydoc = new Y.Doc();
    if (result.rowCount && result.rowCount > 0 && result.rows[0]) {
      Y.applyUpdate(ydoc, result.rows[0].binary);
    }
    return ydoc;
  },

  /**
   * Persist the latest state vector. UPDATE-only on purpose: orphan
   * INSERTs would let a leaked token spawn rogue documents outside the
   * project tree. Until Stage B exposes a "register document" endpoint
   * the row must already exist — created by whichever backend path
   * mints the document metadata.
   */
  async onStoreDocument(data) {
    const documentId = data.documentName;
    const update = Y.encodeStateAsUpdate(data.document);
    const r = await pool.query(
      `UPDATE documents
         SET binary = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL`,
      [Buffer.from(update), documentId],
    );
    if (r.rowCount === 0) {
      console.warn(`[collab] no active document row, dropped save: ${documentId}`);
    }
  },
});

server
  .listen()
  .then(() => console.log(`[collab] hocuspocus listening on :${port}`))
  .catch((err: unknown) => {
    console.error('[collab] failed to start', err);
    process.exit(1);
  });

// Graceful shutdown — SIGTERM from docker stop / k8s rolling deploy.
const shutdown = (signal: string) => {
  console.log(`[collab] received ${signal}, shutting down`);
  server.destroy()
    .catch((err: unknown) => console.error('[collab] shutdown error', err))
    .finally(() => {
      void pool.end();
      process.exit(0);
    });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
