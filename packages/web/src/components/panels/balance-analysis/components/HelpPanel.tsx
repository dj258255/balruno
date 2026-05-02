/**
 * HelpPanel - 밸런스 분석 도움말 패널
 */

'use client';

import { GitBranch, TrendingUp, BarChart2, AlertTriangle, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function HelpPanel() {
  const t = useTranslations();
  return (
    <div className="mb-4 glass-card p-3 rounded-lg animate-slideDown">
      <div className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-primary)' }}>{t('balanceAnalysisHelp.header')}</div>
      <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.desc')}</p>

      <div className="space-y-3">
        {/* 상성 분석 */}
        <div className="glass-section p-3 rounded-lg" style={{ borderLeft: '3px solid #7c7ff2' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <GitBranch className="w-4 h-4" style={{ color: '#7c7ff2' }} />
            <span className="font-semibold text-sm" style={{ color: '#7c7ff2' }}>{t('balanceAnalysisHelp.matchupTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.matchupDesc')}</p>
          <div className="mt-2 text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <div>{t('balanceAnalysisHelp.matchupRequired')}</div>
            <div>{t('balanceAnalysisHelp.matchupResult')}</div>
          </div>
        </div>

        {/* 파워 커브 */}
        <div className="glass-section p-3 rounded-lg" style={{ borderLeft: '3px solid #3db88a' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4" style={{ color: '#3db88a' }} />
            <span className="font-semibold text-sm" style={{ color: '#3db88a' }}>{t('balanceAnalysisHelp.powerTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.powerDesc')}</p>
          <div className="mt-2 text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <div>{t('balanceAnalysisHelp.powerRequired')}</div>
            <div>{t('balanceAnalysisHelp.powerResult')}</div>
          </div>
        </div>

        {/* 상관관계 */}
        <div className="glass-section p-3 rounded-lg" style={{ borderLeft: '3px solid #5a9cf5' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart2 className="w-4 h-4" style={{ color: '#5a9cf5' }} />
            <span className="font-semibold text-sm" style={{ color: '#5a9cf5' }}>{t('balanceAnalysisHelp.corrTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.corrDesc')}</p>
          <div className="mt-2 text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <div>{t('balanceAnalysisHelp.corrRequired')}</div>
            <div>{t('balanceAnalysisHelp.corrResult')}</div>
          </div>
        </div>

        {/* 데드존 */}
        <div className="glass-section p-3 rounded-lg" style={{ borderLeft: '3px solid #e5a440' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4" style={{ color: '#e5a440' }} />
            <span className="font-semibold text-sm" style={{ color: '#e5a440' }}>{t('balanceAnalysisHelp.deadTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.deadDesc')}</p>
          <div className="mt-2 text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <div>{t('balanceAnalysisHelp.deadRequired')}</div>
            <div>{t('balanceAnalysisHelp.deadResult')}</div>
          </div>
        </div>

        {/* 커브 생성 */}
        <div className="glass-section p-3 rounded-lg" style={{ borderLeft: '3px solid #9179f2' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Target className="w-4 h-4" style={{ color: '#9179f2' }} />
            <span className="font-semibold text-sm" style={{ color: '#9179f2' }}>{t('balanceAnalysisHelp.curveTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balanceAnalysisHelp.curveDesc')}</p>
          <div className="mt-2 text-sm space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <div>{t('balanceAnalysisHelp.curveRequired')}</div>
            <div>{t('balanceAnalysisHelp.curveResult')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
