'use client';

/**
 * DocView — Milestone 1: tiptap WYSIWYG 에디터.
 *
 * 이전 2열 구조 (textarea + preview) → 단일 WYSIWYG.
 * @참조는 tiptap extension 으로 처리 (M1-4 에서 추가).
 * Custom blocks 는 M2 에서 NodeView 로 추가.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Trash2, HelpCircle, Link as LinkIcon, Download, Printer,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { findBacklinks } from '@/lib/docReferences';
import { exportDocAsMarkdown, exportDocAsPDF } from '@/lib/docExport';
import type { Doc, Project } from '@/types';
import PanelShell from '@/components/ui/PanelShell';
import TiptapDocEditor from './TiptapDocEditor';
import DocIconPicker from './DocIconPicker';

interface Props {
  projectId: string;
  doc: Doc;
  onClose: () => void;
}

export default function DocView({ projectId, doc, onClose }: Props) {
  const t = useTranslations('docs');
  const locale = useLocale();
  const updateDoc = useProjectStore((s) => s.updateDoc);
  const deleteDoc = useProjectStore((s) => s.deleteDoc);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId)
  ) as Project | undefined;

  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content);
  const [showHelp, setShowHelp] = useState(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 다른 문서로 전환 시 로컬 state 갱신
  useEffect(() => {
    setName(doc.name);
    setContent(doc.content);
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 이름 자동저장
  useEffect(() => {
    if (name === doc.name) return;
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      updateDoc(projectId, doc.id, { name });
    }, 500);
    return () => {
      if (nameTimer.current) clearTimeout(nameTimer.current);
    };
  }, [name, doc.name, doc.id, projectId, updateDoc]);

  // content 저장은 TiptapDocEditor 가 debounce 후 onChange 콜백
  const handleContentChange = (html: string) => {
    setContent(html);
    updateDoc(projectId, doc.id, { content: html });
  };

  const handleDelete = () => {
    if (window.confirm(t('deleteConfirm', { name: doc.name }))) {
      deleteDoc(projectId, doc.id);
      onClose();
    }
  };

  const handleJumpToDoc = (docId: string) => {
    setCurrentDoc(docId);
  };

  // backlinks 계산
  const backlinks = useMemo(() => {
    if (!project?.docs) return [];
    return findBacklinks(doc.id, project.docs);
  }, [project?.docs, doc.id]);

  return (
    <PanelShell
      title={t('title')}
      subtitle={t('subtitle')}
      iconNode={
        <DocIconPicker
          icon={doc.icon}
          onChange={(emoji) => updateDoc(projectId, doc.id, { icon: emoji })}
          size="sm"
        />
      }
      onClose={onClose}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={
        <>
          <button
            onClick={() => exportDocAsMarkdown({ ...doc, content, name }, project)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
            title={t('exportMd')}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportDocAsPDF({ ...doc, content, name }, project)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
            title={t('printPdf')}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
            title={t('syntaxHelp')}
            style={{ color: showHelp ? '#3b82f6' : 'var(--text-secondary)' }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
            title={t('delete')}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      }
    >
      {/* 제목 + 아이콘 */}
      <div
        className="px-6 py-4 border-b flex items-start gap-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <DocIconPicker
          icon={doc.icon}
          onChange={(emoji) => updateDoc(projectId, doc.id, { icon: emoji })}
          size="lg"
          className="shrink-0 mt-1"
        />
        <div className="flex-1 min-w-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full text-2xl font-bold bg-transparent outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        <div className="flex items-center gap-3 mt-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
          <span>
            {t('modifiedPrefix')}: {new Date(doc.updatedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {backlinks.length > 0 && (
            <span className="flex items-center gap-1">
              <LinkIcon className="w-3 h-3" />
              {t('backlinkRefs', { count: backlinks.length })}
            </span>
          )}
        </div>
        </div>
      </div>

      {/* 도움말 */}
      {showHelp && (
        <div
          className="mx-6 mt-4 p-3 rounded-lg text-xs space-y-1.5"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('editorUsage')}
          </div>
          <div><kbd className="px-1 rounded bg-[var(--bg-primary)]">/</kbd> — {t('helpSlash')}</div>
          <div><kbd className="px-1 rounded bg-[var(--bg-primary)]">@</kbd> — {t('helpAt')}</div>
          <div><kbd className="px-1 rounded bg-[var(--bg-primary)]">**bold**</kbd> <kbd className="px-1 rounded bg-[var(--bg-primary)]">*italic*</kbd> <kbd className="px-1 rounded bg-[var(--bg-primary)]">`code`</kbd> — {t('helpInlineMd')}</div>
          <div><kbd className="px-1 rounded bg-[var(--bg-primary)]"># H1</kbd> <kbd className="px-1 rounded bg-[var(--bg-primary)]">- list</kbd> <kbd className="px-1 rounded bg-[var(--bg-primary)]">&gt; quote</kbd> — {t('helpLineMd')}</div>
        </div>
      )}

      {/* Tiptap 에디터 — 본문 스크롤 가능 + 최대 너비 제한 없음 (컨테이너 full width) */}
      <div className="flex-1 overflow-y-auto">
        <TiptapDocEditor
          content={content}
          onChange={handleContentChange}
          projectId={projectId}
        />
      </div>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div
          className="mx-6 mb-6 pt-4 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div
            className="text-overline mb-2 flex items-center gap-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <LinkIcon className="w-3 h-3" />
            {t('thisDocReferenced')}
          </div>
          <div className="space-y-1">
            {backlinks.map((b) => (
              <button
                key={b.id}
                onClick={() => handleJumpToDoc(b.id)}
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <FileText className="w-3 h-3 inline mr-1" style={{ color: 'var(--text-secondary)' }} />
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}
