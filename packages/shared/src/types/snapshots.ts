/**
 * Named version snapshots — Figma "version history with names" pattern.
 *
 * Persisted alongside changelog entries. Each snapshot points at a Y.Doc state
 * that can be restored. v0.5 stores the snapshot inline as a JSON Project blob;
 * v0.6+ will switch to yjs binary state vector.
 */

export interface NamedSnapshot {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  /** JSON-serialized Project at the moment the snapshot was taken. */
  payload: unknown;
}
