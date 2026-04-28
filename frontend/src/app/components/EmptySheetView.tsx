'use client';

/**
 * EmptySheetView — 프로젝트는 선택됐으나 표시할 시트가 없을 때.
 *
 * HomeEmptyState 와 같은 디자인 언어 (glass-card CTA 3개, gradient 아이콘)
 * 로 일관성 유지. 시트 닫고 돌아왔을 때 Home 과 이질감 없이 연결.
 */

import { FileSpreadsheet, Plus, Wand2, FolderPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmptySheetViewProps {
  onCreateSheet: () => void;
}

export default function EmptySheetView({ onCreateSheet }: EmptySheetViewProps) {
  const t = useTranslations();

  const openAiSetup = () => window.dispatchEvent(new Event('balruno:open-ai-setup'));
  const openGallery = () => window.dispatchEvent(new Event('balruno:open-gallery'));
  const openImport = () => window.dispatchEvent(new Event('balruno:open-import-modal'));

  return (
    <div
      className="flex-1 overflow-y-auto p-6 sm:p-8 flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('sheet.noSheets')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('sheet.createSheetDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onCreateSheet}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #3b82f6' }}
          >
            <Plus className="w-6 h-6 mb-2" style={{ color: '#3b82f6' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.createSheet')}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('sheet.startBlank')}
            </div>
          </button>

          <button
            onClick={openAiSetup}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #8b5cf6' }}
          >
            <Wand2 className="w-6 h-6 mb-2" style={{ color: '#8b5cf6' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.startWithAi')}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('sheet.startWithAiDesc')}
            </div>
          </button>

          <button
            onClick={openGallery}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #10b981' }}
          >
            <FolderPlus className="w-6 h-6 mb-2" style={{ color: '#10b981' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.browseTemplates')}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('sheet.browseTemplatesDesc')}
            </div>
          </button>

          <button
            onClick={openImport}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #f59e0b' }}
          >
            <FileSpreadsheet className="w-6 h-6 mb-2" style={{ color: '#f59e0b' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.importExcel')}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('sheet.importExcelDesc')}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
