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

import { useMemo, useEffect, useRef, useState } from 'react';
import { X, Inbox as InboxIcon, CheckCheck, AtSign, GitCommit } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import { useInbox } from '@/stores/inboxStore';
import { getProjectDoc } from '@/lib/ydoc';
import { getCommentsArray, getCommentsForSheet, type CellComment } from '@/lib/cellComments';
import type { ChangeEntry, Project, Sheet } from '@/types';
import { useTranslations } from 'next-intl';

type FeedKind = 'change' | 'mention' | 'comment';

interface FeedItem {
  id: string;
  kind: FeedKind;
  timestamp: number;
  projectId: string;
  projectName: string;
  sheet: Sheet | null;
  rowId: string;
  columnLabel: string;
  userName: string;
  /** 'change' 는 before→after, 'mention'/'comment' 는 원문 텍스트 */
  summary: string;
}

function entryToFeedItem(project: Project, entry: ChangeEntry): FeedItem {
  const t = useTranslations();
  const sheet = project.sheets.find((s) => s.id === entry.sheetId) ?? null;
  const col = sheet?.columns.find((c) => c.id === entry.columnId);
  const before =
    entry.before === null || entry.before === undefined || entry.before === ''
      ? t('inboxPanel.emptyValue')
      : String(entry.before);
  const after =
    entry.after === null || entry.after === undefined || entry.after === ''
      ? t('inboxPanel.emptyValue')
      : String(entry.after);
  return {
    id: `change-${entry.id}`,
    kind: 'change',
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

function commentToFeedItem(
  project: Project,
  sheet: Sheet,
  comment: CellComment,
  kind: FeedKind,
): FeedItem {
  const col = sheet.columns.find((c) => c.id === comment.columnId);
  return {
    id: `${kind}-${comment.id}`,
    kind,
    timestamp: comment.timestamp,
    projectId: project.id,
    projectName: project.name,
    sheet,
    rowId: comment.rowId,
    columnLabel: col?.name ?? comment.columnId.slice(0, 6),
    userName: comment.author,
    summary: comment.text.slice(0, 200),
  };
}

function relativeTime(ts: number): string {
  const t = useTranslations();
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return t('inboxPanel.justNow');
  const m = Math.floor(s / 60);
  if (m < 60) return t('inboxPanel.minutesAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('inboxPanel.hoursAgo', { h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('inboxPanel.daysAgo', { d });
  return new Date(ts).toLocaleDateString('ko-KR');
}

function KindIcon({ kind }: { kind: FeedKind }) {
  if (kind === 'mention') {
    return <AtSign className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#ec4899' }} />;
  }
  if (kind === 'comment') {
    return <InboxIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />;
  }
  return <GitCommit className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />;
}

export default function InboxPanel() {
  const t = useTranslations();
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

  // 현재 유저 — presence localStorage 재사용 (백엔드 오기 전까지 client-side 식별자)
  const currentUser = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('balruno:user-name') ?? '';
  }, []);

  // 코멘트 live 구독 — Inbox 열린 동안만 모든 프로젝트/시트의 Y.Array observer 등록.
  // observer 가 tick 카운터를 올려 feed 재계산 트리거.
  const [commentTick, setCommentTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const unsubs: Array<() => void> = [];
    for (const project of projects) {
      const doc = getProjectDoc(project.id);
      for (const sheet of project.sheets) {
        const arr = getCommentsArray(doc, sheet.id);
        if (!arr) continue;
        const handler = () => setCommentTick((t) => t + 1);
        arr.observe(handler);
        unsubs.push(() => arr.unobserve(handler));
      }
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [open, projects]);

  const feed: FeedItem[] = useMemo(() => {
    if (!open) return []; // 닫혔을 때는 계산 비용 없음
    const items: FeedItem[] = [];

    // 1. changelog
    for (const project of projects) {
      for (const entry of project.changelog ?? []) {
        items.push(entryToFeedItem(project, entry));
      }
    }

    // 2. 코멘트 — @mention 이 나 포함 or 남이 최근 7일 내 쓴 것
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const project of projects) {
      const doc = getProjectDoc(project.id);
      for (const sheet of project.sheets) {
        const comments = getCommentsForSheet(doc, sheet.id);
        for (const c of comments) {
          const mentionsMe = currentUser ? c.mentions.includes(currentUser) : false;
          const otherRecent = c.author !== currentUser && c.timestamp >= cutoff;
          if (mentionsMe) {
            items.push(commentToFeedItem(project, sheet, c, 'mention'));
          } else if (otherRecent) {
            items.push(commentToFeedItem(project, sheet, c, 'comment'));
          }
        }
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, 150);
    // commentTick 은 live 구독 트리거 용 — react 가 recompute 하도록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projects, currentUser, commentTick]);

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
              title={t('inboxPanel.markAllRead')}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t('inboxPanel.markAllReadShort')}
            </button>
          )}
          <button
            type="button"
            onClick={closeInbox}
            className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
            aria-label={t('inboxPanel.closeAria')}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {feed.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('inboxPanel.noChanges1')}
            <br />
            {t('inboxPanel.noChanges2')}
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
                        background: read ? 'transparent' : item.kind === 'mention' ? '#ec4899' : 'var(--accent)',
                        border: read ? '1px solid var(--border-primary)' : 'none',
                      }}
                    />
                    <KindIcon kind={item.kind} />
                    <div className="flex-1 min-w-0">
                      <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {item.userName}
                        </span>
                        <span className="opacity-70">
                          {item.kind === 'change' ? t('inboxPanel.kindEdit') : item.kind === 'mention' ? t('inboxPanel.kindMention') : t('inboxPanel.kindComment')}
                        </span>
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
                        className="text-caption mt-0.5 truncate"
                        style={{
                          color: 'var(--text-tertiary)',
                          fontFamily: item.kind === 'change' ? 'var(--font-mono)' : undefined,
                        }}
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
