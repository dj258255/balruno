'use client';

import { useEffect, useState, useCallback } from 'react';
import { getProjectDoc } from '@/lib/ydoc';
import {
  getCommentsArray,
  getCommentsForSheet,
  addComment as addCommentDoc,
  updateComment as updateCommentDoc,
  deleteComment as deleteCommentDoc,
  type CellComment,
} from '@/lib/cellComments';

export function useComments(projectId: string | null, sheetId: string | null): {
  comments: CellComment[];
  add: (input: Omit<CellComment, 'id' | 'timestamp' | 'mentions'>) => CellComment | null;
  update: (id: string, patch: Partial<Pick<CellComment, 'text' | 'resolved'>>) => void;
  remove: (id: string) => void;
} {
  const [comments, setComments] = useState<CellComment[]>([]);

  useEffect(() => {
    if (!projectId || !sheetId) {
      setComments([]);
      return;
    }
    const doc = getProjectDoc(projectId);
    const arr = getCommentsArray(doc, sheetId);
    if (!arr) return;

    const refresh = () => setComments(getCommentsForSheet(doc, sheetId));
    refresh();
    arr.observe(refresh);
    return () => arr.unobserve(refresh);
  }, [projectId, sheetId]);

  const add = useCallback(
    (input: Omit<CellComment, 'id' | 'timestamp' | 'mentions'>): CellComment | null => {
      if (!projectId || !sheetId) return null;
      return addCommentDoc(getProjectDoc(projectId), sheetId, input);
    },
    [projectId, sheetId],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<CellComment, 'text' | 'resolved'>>) => {
      if (!projectId || !sheetId) return;
      updateCommentDoc(getProjectDoc(projectId), sheetId, id, patch);
    },
    [projectId, sheetId],
  );

  const remove = useCallback(
    (id: string) => {
      if (!projectId || !sheetId) return;
      deleteCommentDoc(getProjectDoc(projectId), sheetId, id);
    },
    [projectId, sheetId],
  );

  return { comments, add, update, remove };
}
