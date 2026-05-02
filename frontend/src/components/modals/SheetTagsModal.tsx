'use client';

/**
 * 시트 태그 편집 모달.
 *
 * Tag = 시트의 *속성* (Folder = 시트의 *소속*).
 *  - 다중: 한 시트가 여러 tag 동시 보유
 *  - prefix 자유 (예: stage:wip, owner:김디, system:전투)
 *  - 사이드바 chip + 필터 + 검색 query 에서 활용
 *
 * UX:
 *  - 입력창에 tag 타이프 → Enter / 쉼표 / Tab 으로 commit
 *  - 기존 tag 클릭 → 토글 (있으면 제거, 없으면 추가)
 *  - 같은 프로젝트 내 다른 시트의 tag 추천 (재사용 유도)
 */

import { useMemo, useRef, useState } from 'react';
import { X, Tag as TagIcon, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface SheetTagsModalProps {
  projectId: string;
  sheetId: string;
  onClose: () => void;
}

export default function SheetTagsModal({ projectId, sheetId, onClose }: SheetTagsModalProps) {
  useEscapeKey(onClose);
  const t = useTranslations();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const sheet = project?.sheets.find((s) => s.id === sheetId);
  const updateSheet = useProjectStore((s) => s.updateSheet);

  const [draft, setDraft] = useState<string[]>(sheet?.tags ?? []);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 같은 프로젝트의 다른 시트들에 이미 쓰인 tag — 자동 추천 (재사용 유도)
  const projectTags = useMemo(() => {
    if (!project) return [];
    const set = new Set<string>();
    for (const s of project.sheets) {
      if (s.id === sheetId) continue;
      for (const tag of s.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [project, sheetId]);

  if (!project || !sheet) return null;

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (draft.includes(tag)) return;
    setDraft((prev) => [...prev, tag]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    setDraft((prev) => prev.filter((t) => t !== tag));
  };

  const toggleSuggestion = (tag: string) => {
    if (draft.includes(tag)) removeTag(tag);
    else setDraft((prev) => [...prev, tag]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글/일본어 IME 조합 중에는 Enter 가 compose 종료용으로 한 번 더 발화됨.
    // 그 첫 Enter 를 commit 으로 처리하면 "안녕" → "안녕" + "녕" 두 번 add 되는 버그.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (input.trim()) {
        // 입력 중인 텍스트가 있으면: chip 추가만 (저장 X)
        e.preventDefault();
        addTag(input);
      } else if (e.key === 'Enter' && draft.length >= 0) {
        // 빈 입력 + Enter → 저장 + 닫기 (Linear/Notion 패턴)
        e.preventDefault();
        handleSave();
      }
    } else if (e.key === 'Backspace' && !input && draft.length > 0) {
      removeTag(draft[draft.length - 1]);
    }
  };

  const handleSave = () => {
    // 진단: 어디서 끊기는지 추적 — 테스트 후 제거 예정
    // eslint-disable-next-line no-console
    console.log('[SheetTagsModal] save', { projectId, sheetId, draft });
    updateSheet(projectId, sheetId, { tags: draft.length > 0 ? draft : undefined });
    // 저장 직후 store 의 시트 tags 도 함께 출력 (50ms observer 후 갱신될 것)
    setTimeout(() => {
      const updated = useProjectStore.getState().projects.find((p) => p.id === projectId)?.sheets.find((s) => s.id === sheetId);
      // eslint-disable-next-line no-console
      console.log('[SheetTagsModal] after-save sheet.tags', updated?.tags);
    }, 200);
    onClose();
  };

  const unusedSuggestions = projectTags.filter((tag) => !draft.includes(tag));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <TagIcon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.editTags')}
            </h3>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              · {sheet.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div
            className="flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[42px] cursor-text"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            onClick={() => inputRef.current?.focus()}
          >
            {draft.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent-text)',
                  border: '1px solid var(--accent)',
                }}
              >
                {tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="hover:opacity-70"
                  aria-label={t('common.remove')}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={draft.length === 0 ? t('sheet.tagsPlaceholder') : ''}
              className="flex-1 min-w-[80px] bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('sheet.tagsHint')}
          </p>

          {unusedSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('sheet.tagsSuggestions')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unusedSuggestions.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleSuggestion(tag)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs hover:opacity-80"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px dashed var(--border-secondary)',
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
