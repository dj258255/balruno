'use client';

/**
 * InboxPanel — 전역 알림 집약 (MVP).
 *
 * 현재 버전: 로드된 모든 프로젝트의 changelog 엔트리를 timestamp 역순으로.
 * 클릭 시 해당 행 열어 RecordEditor 슬라이드.
 *
 * 다음 버전 (확장 예정):
 *  - @mention 크로스 프로젝트 집약 (y-doc 순회 필요)
 *  - 행 단위 코멘트 스레드 통합
 *  - 필터: 내 담당 · 언멘션 · 최근 7일
 */

import { useMemo, useEffect, useRef } from 'react';
import { X, Inbox as InboxIcon, Check, CheckCheck } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import { useInbox } from '@/stores/inboxStore';
import type { ChangeEntry, Project, Sheet } from '@/types';

interface FeedItem {
  id: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  sheet: Sheet | null;
  rowId: string;
  columnLabel: string;
  userName: string;
  summary: string;
}

function entryToFeedItem(project: Project, entry: ChangeEntry): FeedItem {
  const sheet = project.sheets.find((s) => s.id === entry.sheetId) ?? null;
  const col = sheet?.columns.find((c) => c.id === entry.columnId);
  const before =
    entry.before === null || entry.before === undefined || entry.before === ''
      ? '(빈 값)'
      : String(entry.before);
  const after =
    entry.after === null || entry.after === undefined || entry.after === ''
      ? '(빈 값)'
      : String(entry.after);
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    projectId: project.id,
    projectName: project.name,
    sheet,
    rowId: entry.rowId,
    columnLabel: col?.name ?? entry.columnId.slice(0, 6),
    userName: entry.userName,
    summary: `${before} → ${after}`,
  };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return '방금';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

export default function InboxPanel() {
  const open = useInbox((s) => s.open);
  const closeInbox = useInbox((s) => s.closeInbox);
  const readIds = useInbox((s) => s.readIds);
  const markRead = useInbox((s) => s.markRead);
  const markAllRead = useInbox((s) => s.markAllRead);

  const projects = useProjectStore((s) => s.projects);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const openRecord = useRecordDetail((s) => s.openRecord);
  const panelRef = useRef<HTMLDivElement>(null);

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    for (const project of projects) {
      for (const entry of project.changelog ?? []) {
        items.push(entryToFeedItem(project, entry));
      }
    }
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, 100); // 상한 — 너무 오래된 건 잘라냄
  }, [projects]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = feed.filter((f) => !readSet.has(f.id)).length;

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeInbox]);

  if (!open) return null;

  const handleItemClick = (item: FeedItem) => {
    markRead(item.id);
    if (item.sheet) {
      setCurrentProject(item.projectId);
      setCurrentSheet(item.sheet.id);
      openRecord({
        projectId: item.projectId,
        sheetId: item.sheet.id,
        rowId: item.rowId,
      });
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] max-w-full z-40 flex flex-col shadow-2xl border-l"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
      role="dialog"
      aria-label="Inbox"
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2">
          <InboxIcon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Inbox
          </span>
          {unreadCount > 0 && (
            <span
              className="text-caption px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead(feed.map((f) => f.id))}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="모두 읽음 표시"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              모두 읽음
            </button>
          )}
          <button
            type="button"
            onClick={closeInbox}
            className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {feed.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            아직 변경 이력이 없습니다.
            <br />
            시트 편집이 쌓이면 여기에 모입니다.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
            {feed.map((item) => {
              const read = readSet.has(item.id);
              return (
                <li key={`${item.projectId}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      opacity: read ? 0.55 : 1,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: read ? 'transparent' : 'var(--accent)',
                        border: read ? '1px solid var(--border-primary)' : 'none',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {item.userName}
                        </span>
                        <span className="opacity-70">편집</span>
                        <span className="opacity-70">·</span>
                        <span>{relativeTime(item.timestamp)}</span>
                      </div>
                      <div
                        className="text-xs mt-0.5 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.sheet?.name ?? item.projectName} · {item.columnLabel}
                      </div>
                      <div
                        className="text-caption mt-0.5 truncate font-mono"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {item.summary}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
