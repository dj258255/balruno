/**
 * SidebarFooter - 사이드바 하단 컴포넌트
 */

'use client';

import { Download, Upload, HelpCircle, BookOpen, Globe, MessageSquare } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { formatRelativeTime } from '@/lib/utils';

interface SidebarFooterProps {
  selectedRowsCount: number;
  clearSelectedRows: () => void;
  lastSaved: number | null;
  onShowExportModal?: () => void;
  onShowImportModal?: () => void;
  onShowHelp: () => void;
  onShowReferences: () => void;
  onShowSettings?: () => void;
  handleToolsResizeStart: (e: React.MouseEvent) => void;
}

export function SidebarFooter({
  selectedRowsCount,
  clearSelectedRows,
  lastSaved,
  onShowExportModal,
  onShowImportModal,
  onShowHelp,
  onShowReferences,
  onShowSettings,
  handleToolsResizeStart,
}: SidebarFooterProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <>
      {/* 선택된 행 */}
      {selectedRowsCount > 0 && (
        <div className="border-t px-3 py-2" style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--accent-light)'
        }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              {t('sidebar.selectedRows', { count: selectedRowsCount })}
            </span>
            <button
              onClick={clearSelectedRows}
              className="text-xs px-2 py-1 rounded font-medium transition-colors"
              style={{
                color: 'var(--accent)',
                background: 'var(--bg-primary)'
              }}
              aria-label={t('sidebar.deselect')}
            >
              {t('sidebar.deselect')}
            </button>
          </div>
        </div>
      )}

      {/* 리사이즈 핸들 제거됨 — 도구가 BottomDock 으로 일원화되어 사이드바 내부 리사이즈는 불필요 */}
    </>
  );
}

interface DataButtonsProps {
  onShowExportModal?: () => void;
  onShowImportModal?: () => void;
}

export function DataButtons({ onShowExportModal, onShowImportModal }: DataButtonsProps) {
  const t = useTranslations();

  return (
    <div className="border-t p-2" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex gap-1.5 lg:gap-2">
        <button
          onClick={onShowExportModal}
          className="flex-1 flex items-center justify-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium rounded-lg border transition-colors whitespace-nowrap hover:bg-[var(--bg-hover)]"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-primary)'
          }}
          aria-label={t('common.export')}
        >
          <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('common.export')}</span>
        </button>

        <button
          onClick={onShowImportModal}
          className="flex-1 flex items-center justify-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium rounded-lg border transition-colors whitespace-nowrap hover:bg-[var(--bg-hover)]"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-primary)'
          }}
          aria-label={t('common.import')}
        >
          <Upload className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('common.import')}</span>
        </button>
      </div>
    </div>
  );
}

interface HelpButtonsProps {
  onShowHelp: () => void;
  onShowReferences: () => void;
}

export const FEEDBACK_FORM_URL = 'https://forms.gle/jfStPBidvpqieh3Z8';

export function HelpButtons({ onShowHelp, onShowReferences }: HelpButtonsProps) {
  const t = useTranslations();

  return (
    <div className="border-t p-2" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2">
        <button
          onClick={onShowHelp}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-primary)'
          }}
          aria-label={t('sidebar.help')}
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
          {t('sidebar.help')}
        </button>
        <button
          onClick={onShowReferences}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-primary)'
          }}
          aria-label={t('sidebar.references')}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          {t('sidebar.references')}
        </button>
      </div>
    </div>
  );
}

interface SaveStatusProps {
  lastSaved: number | null;
  onShowSettings?: () => void;
}

export function SaveStatus({ lastSaved, onShowSettings }: SaveStatusProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="px-4 py-2.5 border-t text-xs flex items-center justify-between" style={{
      borderColor: 'var(--border-primary)',
      color: 'var(--text-tertiary)'
    }}>
      {lastSaved ? (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {t('sidebar.savedAt')} · {formatRelativeTime(lastSaved)}
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-1.5">
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            color: 'var(--accent)',
            borderColor: 'var(--border-primary)'
          }}
          title={t('sidebar.feedbackTooltip')}
          aria-label={t('sidebar.feedback')}
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">{t('sidebar.feedback')}</span>
        </a>
        {onShowSettings && (
          <button
            onClick={onShowSettings}
            className="flex items-center gap-1 px-2 py-1 rounded border transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-primary)'
            }}
            title={t('sidebar.settings')}
            aria-label={t('sidebar.settings')}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-xs font-medium">{locale === 'ko' ? '한국어' : 'EN'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
