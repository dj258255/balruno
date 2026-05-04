/**
 * Comments store — keyed by projectId. Each project holds an array of threads.
 *
 * Persisted to localStorage (zustand `persist`) so comments survive reload while
 * the backend's comment endpoint is still being wired. Once the backend is up,
 * this store becomes a cache layer that hydrates from `GET /api/projects/{id}/comments`.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { Comment, CommentTarget, CommentThread } from '@/types/comments';
import { targetKey } from '@/types/comments';

interface CommentsState {
  threadsByProject: Record<string, CommentThread[]>;

  threadsFor: (projectId: string, target: CommentTarget) => CommentThread[];
  hasThreads: (projectId: string, target: CommentTarget) => boolean;
  startThread: (projectId: string, target: CommentTarget, firstComment: Omit<Comment, 'id' | 'createdAt'>) => string;
  reply: (projectId: string, threadId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => void;
  edit: (projectId: string, threadId: string, commentId: string, body: string) => void;
  remove: (projectId: string, threadId: string, commentId: string) => void;
  resolve: (projectId: string, threadId: string, resolved: boolean) => void;
  deleteThread: (projectId: string, threadId: string) => void;
}

export const useCommentsStore = create<CommentsState>()(
  persist(
    (set, get) => ({
      threadsByProject: {},

      threadsFor: (projectId, target) => {
        const key = targetKey(target);
        return (get().threadsByProject[projectId] ?? []).filter((th) => targetKey(th.target) === key);
      },

      hasThreads: (projectId, target) => {
        const key = targetKey(target);
        return (get().threadsByProject[projectId] ?? []).some(
          (th) => targetKey(th.target) === key && !th.resolved,
        );
      },

      startThread: (projectId, target, firstComment) => {
        const id = uuid();
        const now = Date.now();
        const thread: CommentThread = {
          id,
          target,
          resolved: false,
          createdAt: now,
          comments: [{ ...firstComment, id: uuid(), createdAt: now }],
        };
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: [...(state.threadsByProject[projectId] ?? []), thread],
          },
        }));
        return id;
      },

      reply: (projectId, threadId, comment) => {
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: (state.threadsByProject[projectId] ?? []).map((th) =>
              th.id === threadId
                ? { ...th, comments: [...th.comments, { ...comment, id: uuid(), createdAt: Date.now() }] }
                : th,
            ),
          },
        }));
      },

      edit: (projectId, threadId, commentId, body) => {
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: (state.threadsByProject[projectId] ?? []).map((th) =>
              th.id === threadId
                ? {
                    ...th,
                    comments: th.comments.map((c) =>
                      c.id === commentId ? { ...c, body, editedAt: Date.now() } : c,
                    ),
                  }
                : th,
            ),
          },
        }));
      },

      remove: (projectId, threadId, commentId) => {
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: (state.threadsByProject[projectId] ?? []).map((th) =>
              th.id === threadId ? { ...th, comments: th.comments.filter((c) => c.id !== commentId) } : th,
            ),
          },
        }));
      },

      resolve: (projectId, threadId, resolved) => {
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: (state.threadsByProject[projectId] ?? []).map((th) =>
              th.id === threadId ? { ...th, resolved } : th,
            ),
          },
        }));
      },

      deleteThread: (projectId, threadId) => {
        set((state) => ({
          threadsByProject: {
            ...state.threadsByProject,
            [projectId]: (state.threadsByProject[projectId] ?? []).filter((th) => th.id !== threadId),
          },
        }));
      },
    }),
    {
      name: 'balruno-comments',
    },
  ),
);
