'use client';

/**
 * Comments / Mentions 패널 — 활성 시트의 모든 셀 코멘트 + 스레드 표시.
 *
 * - 셀 단위 (rowId, columnId) 로 그룹핑
 * - @멘션 하이라이트
 * - 답글 (parentId) 들여쓰기
 * - 해결 toggle
 * - 새 코멘트 작성 (활성 셀 selection 으로 anchor)
 */

import { useMemo, useState, useEffect } from 'react';
import { MessageCircle, Send, Check, Reply, Trash2, AtSign } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useComments } from '@/hooks/useComments';
import { usePresence } from '@/hooks/usePresence';
import PanelShell from '@/components/ui/PanelShell';
import Checkbox from '@/components/ui/Checkbox';
import { TextAreaWithMentions, type MentionCandidate } from '@/components/sheet/MentionAutocomplete';
import type { CellComment } from '@/lib/cellComments';

interface Props {
  onClose: () => void;
}

export default function CommentsPanel({ onClose }: Props) {
  const { projects, currentProjectId, currentSheetId } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId);
  const sheet = project?.sheets.find((s) => s.id === currentSheetId);

  const { comments, add, update, remove } = useComments(currentProjectId, currentSheetId);
  const { peers, myName, myColor } = usePresence(currentProjectId);

  const [newText, setNewText] = useState('');
  const [anchorRowId, setAnchorRowId] = useState<string>('');
  const [anchorColId, setAnchorColId] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'open' | 'mentions'>('all');
  const [showResolved, setShowResolved] = useState(false);

  // @mention 후보 = 접속자 + 자기 자신 + 코멘트 작성자
  const mentionCandidates: MentionCandidate[] = useMemo(() => {
    const map = new Map<string, MentionCandidate>();
    map.set(myName, { name: myName, color: myColor });
    for (const p of peers) map.set(p.name, { name: p.name, color: p.color });
    for (const c of comments) {
      if (!map.has(c.author)) map.set(c.author, { name: c.author, color: c.authorColor });
    }
    return Array.from(map.values());
  }, [peers, myName, myColor, comments]);

  // 시트 변경 시 anchor 초기화
  useEffect(() => {
    if (sheet && sheet.rows.length > 0 && sheet.columns.length > 0) {
      setAnchorRowId((prev) => sheet.rows.find((r) => r.id === prev) ? prev : sheet.rows[0].id);
      setAnchorColId((prev) => sheet.columns.find((c) => c.id === prev) ? prev : sheet.columns[0].id);
    } else {
      setAnchorRowId('');
      setAnchorColId('');
    }
  }, [sheet]);

  const selectedCell = anchorRowId && anchorColId ? { rowId: anchorRowId, columnId: anchorColId } : null;

  // 셀 단위 그룹핑 — 같은 cell 의 root + replies
  const grouped = useMemo(() => {
    const byCell = new Map<string, { root: CellComment; replies: CellComment[] }[]>();
    const roots = comments.filter((c) => !c.parentId);
    const repliesByParent = new Map<string, CellComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        if (!repliesByParent.has(c.parentId)) repliesByParent.set(c.parentId, []);
        repliesByParent.get(c.parentId)!.push(c);
      }
    }
    for (const root of roots) {
      const key = `${root.rowId}|${root.columnId}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key)!.push({
        root,
        replies: (repliesByParent.get(root.id) ?? []).sort((a, b) => a.timestamp - b.timestamp),
      });
    }
    // 정렬: 최신 root 가 위
    return Array.from(byCell.entries())
      .map(([key, threads]) => ({
        cellKey: key,
        threads: threads.sort((a, b) => b.root.timestamp - a.root.timestamp),
      }))
      .sort((a, b) => {
        const aLatest = Math.max(...a.threads.map((t) => t.root.timestamp));
        const bLatest = Math.max(...b.threads.map((t) => t.root.timestamp));
        return bLatest - aLatest;
      });
  }, [comments]);

  // 필터링
  const filteredGroups = useMemo(() => {
    return grouped
      .map((g) => ({
        ...g,
        threads: g.threads.filter((t) => {
          if (!showResolved && t.root.resolved) return false;
          if (filter === 'open' && t.root.resolved) return false;
          if (filter === 'mentions' && !t.root.mentions.includes(myName)) return false;
          return true;
        }),
      }))
      .filter((g) => g.threads.length > 0);
  }, [grouped, filter, showResolved, myName]);

  const cellLabel = (key: string): string => {
    if (!sheet) return key;
    const [rowId, columnId] = key.split('|');
    const rowIdx = sheet.rows.findIndex((r) => r.id === rowId);
    const col = sheet.columns.find((c) => c.id === columnId);
    return `Row ${rowIdx + 1} · ${col?.name ?? '?'}`;
  };

  const submit = () => {
    if (!newText.trim() || !selectedCell) return;
    add({
      rowId: selectedCell.rowId,
      columnId: selectedCell.columnId,
      author: myName,
      authorColor: myColor,
      text: newText.trim(),
    });
    setNewText('');
  };

  return (
    <PanelShell
      title="코멘트 / 멘션"
      subtitle={sheet ? `시트: ${sheet.name}` : '시트 선택'}
      icon={MessageCircle}
      onClose={onClose}
      headerExtra={
        <span className="text-caption px-1.5 py-0.5 rounded ml-2" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {comments.length}
        </span>
      }
      bodyClassName="flex flex-col p-0 overflow-hidden"
    >

      {/* 필터 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        {(['all', 'open', 'mentions'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2 py-0.5 text-caption rounded transition-colors"
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: filter === f ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f === 'all' ? '전체' : f === 'open' ? '미해결' : '내 멘션'}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-caption cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
          <Checkbox
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          해결 표시
        </label>
      </div>

      {/* 코멘트 리스트 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredGroups.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            {comments.length === 0
              ? '아직 코멘트가 없습니다. 셀을 선택하고 아래에서 작성하세요.'
              : '필터 조건에 맞는 코멘트가 없습니다.'}
          </p>
        ) : (
          filteredGroups.map((g) => (
            <div key={g.cellKey} className="space-y-2">
              <div className="text-caption font-mono px-1.5 py-0.5 rounded inline-block" style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}>
                {cellLabel(g.cellKey)}
              </div>
              {g.threads.map((thread) => (
                <CommentThread
                  key={thread.root.id}
                  thread={thread}
                  myName={myName}
                  myColor={myColor}
                  candidates={mentionCandidates}
                  onUpdate={update}
                  onDelete={remove}
                  onReply={(text) => {
                    add({
                      rowId: thread.root.rowId,
                      columnId: thread.root.columnId,
                      author: myName,
                      authorColor: myColor,
                      text,
                      parentId: thread.root.id,
                    });
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* 새 코멘트 작성 */}
      <div className="border-t p-2 space-y-1.5" style={{ borderColor: 'var(--border-primary)' }}>
        {!sheet || sheet.rows.length === 0 ? (
          <p className="text-caption text-center" style={{ color: 'var(--text-secondary)' }}>
            시트가 없거나 행이 비어있습니다.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={anchorRowId}
                onChange={(e) => setAnchorRowId(e.target.value)}
                className="px-1.5 py-0.5 text-caption rounded border bg-transparent"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                {sheet.rows.map((r, i) => (
                  <option key={r.id} value={r.id}>Row {i + 1}</option>
                ))}
              </select>
              <select
                value={anchorColId}
                onChange={(e) => setAnchorColId(e.target.value)}
                className="px-1.5 py-0.5 text-caption rounded border bg-transparent"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                {sheet.columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-1.5">
              <TextAreaWithMentions
                value={newText}
                onChange={setNewText}
                candidates={mentionCandidates}
                placeholder="@사용자 멘션 가능 · ⌘Enter 로 전송"
                rows={2}
                onSubmit={submit}
              />
              <button
                onClick={submit}
                disabled={!newText.trim()}
                className="p-2 rounded transition-colors"
                style={{
                  background: newText.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: newText.trim() ? 'white' : 'var(--text-secondary)',
                }}
              >
                <Send size={12} />
              </button>
            </div>
            {peers.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <AtSign size={10} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>접속자:</span>
                {peers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setNewText((t) => `${t}${t.endsWith(' ') || t === '' ? '' : ' '}@${p.name} `)}
                    className="text-caption px-1.5 py-0 rounded hover:opacity-80"
                    style={{ background: p.color, color: 'white' }}
                  >
                    @{p.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PanelShell>
  );
}

function CommentThread({
  thread, myName, myColor, candidates, onUpdate, onDelete, onReply,
}: {
  thread: { root: CellComment; replies: CellComment[] };
  myName: string;
  myColor: string;
  candidates: MentionCandidate[];
  onUpdate: (id: string, patch: Partial<Pick<CellComment, 'text' | 'resolved'>>) => void;
  onDelete: (id: string) => void;
  onReply: (text: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const sendReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim());
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div
      className="rounded border overflow-hidden"
      style={{
        borderColor: thread.root.resolved ? 'var(--border-primary)' : 'var(--accent)',
        background: 'var(--bg-secondary)',
        opacity: thread.root.resolved ? 0.6 : 1,
      }}
    >
      <CommentItem
        comment={thread.root}
        isReply={false}
        myName={myName}
        candidates={candidates}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onReplyClick={() => setShowReply((v) => !v)}
        onResolveToggle={() => onUpdate(thread.root.id, { resolved: !thread.root.resolved })}
      />
      {thread.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          isReply
          myName={myName}
          candidates={candidates}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
      {showReply && (
        <div className="border-t p-2 space-y-1.5" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-end gap-1.5">
            <TextAreaWithMentions
              value={replyText}
              onChange={setReplyText}
              candidates={candidates}
              placeholder={`답글 작성 (${myName})`}
              rows={2}
              onSubmit={sendReply}
            />
            <button
              onClick={sendReply}
              disabled={!replyText.trim()}
              className="p-1.5 rounded"
              style={{
                background: replyText.trim() ? myColor : 'var(--bg-tertiary)',
                color: replyText.trim() ? 'white' : 'var(--text-secondary)',
              }}
            >
              <Send size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment, isReply, myName, candidates, onUpdate, onDelete, onReplyClick, onResolveToggle,
}: {
  comment: CellComment;
  isReply: boolean;
  myName: string;
  candidates: MentionCandidate[];
  onUpdate: (id: string, patch: Partial<Pick<CellComment, 'text' | 'resolved'>>) => void;
  onDelete: (id: string) => void;
  onReplyClick?: () => void;
  onResolveToggle?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const isMine = comment.author === myName;

  useEffect(() => setEditText(comment.text), [comment.text]);

  const save = () => {
    if (editText.trim() && editText !== comment.text) {
      onUpdate(comment.id, { text: editText.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      className="p-2 space-y-1"
      style={{
        borderTop: isReply ? '1px solid var(--border-primary)' : undefined,
        paddingLeft: isReply ? 24 : 8,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-caption font-semibold text-white flex-shrink-0"
          style={{ background: comment.authorColor }}
        >
          {comment.author.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>{comment.author}</span>
        <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          {new Date(comment.timestamp).toLocaleString()}
        </span>
        {comment.resolved && (
          <span className="text-caption px-1 rounded" style={{ background: 'var(--bg-tertiary)', color: '#10b981' }}>
            해결됨
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {onResolveToggle && (
            <button onClick={onResolveToggle} title="해결 토글" className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]">
              <Check size={11} style={{ color: comment.resolved ? '#10b981' : 'var(--text-secondary)' }} />
            </button>
          )}
          {onReplyClick && (
            <button onClick={onReplyClick} title="답글" className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]">
              <Reply size={11} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
          {isMine && (
            <button onClick={() => onDelete(comment.id)} title="삭제" className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]">
              <Trash2 size={11} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="flex items-end gap-1">
          <TextAreaWithMentions
            value={editText}
            onChange={setEditText}
            candidates={candidates}
            rows={2}
            onSubmit={save}
          />
          <button onClick={save} className="px-2 py-1 text-caption rounded" style={{ background: 'var(--accent)', color: 'white' }}>저장</button>
          <button onClick={() => { setEditing(false); setEditText(comment.text); }} className="px-2 py-1 text-caption rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>취소</button>
        </div>
      ) : (
        <p
          className="text-xs whitespace-pre-wrap break-words"
          style={{ color: 'var(--text-primary)' }}
          onDoubleClick={() => isMine && setEditing(true)}
        >
          {renderWithMentions(comment.text, myName)}
        </p>
      )}
    </div>
  );
}

function renderWithMentions(text: string, myName: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches = text.matchAll(/@([A-Za-z0-9_-]{2,32})/g);
  for (const m of matches) {
    if (m.index! > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const isMe = m[1] === myName;
    parts.push(
      <span
        key={m.index}
        className="font-semibold rounded px-0.5"
        style={{
          background: isMe ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
          color: isMe ? '#10b981' : '#3b82f6',
        }}
      >
        @{m[1]}
      </span>,
    );
    lastIndex = m.index! + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
