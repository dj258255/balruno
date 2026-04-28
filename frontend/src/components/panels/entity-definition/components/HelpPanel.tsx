/**
 * HelpPanel - 엔티티 정의 도움말 패널
 */

'use client';

import { Users, TrendingUp, Settings, Table2, Database, Sliders, FileJson } from 'lucide-react';
import { useTranslations } from 'next-intl';

const PANEL_COLOR = '#5a9cf5';

export function HelpPanel() {
  const t = useTranslations();
  return (
    <div className="glass-card p-4 animate-slideDown space-y-4">
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
        >
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.header')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('entityDefHelp.intro')}
          </p>
        </div>
      </div>

      {/* 기본 개념 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.sourceSheetLabel')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('entityDefHelp.sourceSheetDesc')}
          </p>
        </div>
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.statDefLabel')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('entityDefHelp.statDefDesc')}
          </p>
        </div>
      </div>

      {/* 성장 곡선 타입 */}
      <div className="glass-section p-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.curveTypesHeader')}</span>
        </div>
        <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.curveLinear')}</span>
            <span>{t('entityDefHelp.curveLinearDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.curveExp')}</span>
            <span>{t('entityDefHelp.curveExpDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.curveLog')}</span>
            <span>{t('entityDefHelp.curveLogDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.curveQuad')}</span>
            <span>{t('entityDefHelp.curveQuadDesc')}</span>
          </div>
        </div>
      </div>

      {/* 오버라이드 & 보간 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.overrideLabel')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('entityDefHelp.overrideDesc')}
          </p>
        </div>
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#9179f2' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.interpLabel')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('entityDefHelp.interpDesc')}
          </p>
        </div>
      </div>

      {/* 출력 형식 */}
      <div className="glass-section p-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <FileJson className="w-3.5 h-3.5" style={{ color: '#9179f2' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('entityDefHelp.outputLabel')}</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('entityDefHelp.outputDesc')}
        </p>
        <div className="text-xs mt-2 p-2 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
          <code>{'{ id, name, level, HP, ATK, DEF, ... }'}</code>
        </div>
      </div>

      <div className="glass-divider" />

      {/* 사용 순서 */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { num: 1, text: t('entityDefHelp.step1') },
          { num: 2, text: t('entityDefHelp.step2') },
          { num: 3, text: t('entityDefHelp.step3') },
          { num: 4, text: t('entityDefHelp.step4') },
        ].map(({ num, text }) => (
          <div key={num} className="flex gap-2 items-start">
            <span
              className="w-5 h-5 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: `${PANEL_COLOR}20`, color: PANEL_COLOR }}
            >
              {num}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
