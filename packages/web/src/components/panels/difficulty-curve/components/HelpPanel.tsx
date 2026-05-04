/**
 * HelpPanel - 난이도 커브 도움말 패널
 */
import { TrendingUp, AlertTriangle, Target, Activity, Coffee, Sliders } from 'lucide-react';
import { useTranslations } from 'next-intl';

const PANEL_COLOR = '#06b6d4';

export function HelpPanel() {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="glass-card p-4 animate-slideDown space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
        >
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpTitle')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpOverviewDesc')}</p>
        </div>
      </div>

      {/* 기본 개념 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#e86161' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpWall')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpWallDesc')}</p>
        </div>
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3.5 h-3.5" style={{ color: '#3db88a' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpMilestone')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpMilestoneDesc')}</p>
        </div>
      </div>

      {/* 벽 타입 설명 */}
      <div className="glass-section p-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#e86161' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpWallTypes')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#e86161' }} />
            <div>
              <span className="font-medium" style={{ color: '#e86161' }}>{t('helpBossWall')}</span>
              <p style={{ color: 'var(--text-tertiary)' }}>{t('helpBossWallDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#e5a440' }} />
            <div>
              <span className="font-medium" style={{ color: '#e5a440' }}>{t('helpGearWall')}</span>
              <p style={{ color: 'var(--text-tertiary)' }}>{t('helpGearWallDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#5a9cf5' }} />
            <div>
              <span className="font-medium" style={{ color: '#5a9cf5' }}>{t('helpLevelWall')}</span>
              <p style={{ color: 'var(--text-tertiary)' }}>{t('helpLevelWallDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#06b6d4' }} />
            <div>
              <span className="font-medium" style={{ color: '#06b6d4' }}>{t('helpTimeWall')}</span>
              <p style={{ color: 'var(--text-tertiary)' }}>{t('helpTimeWallDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 곡선 타입 설명 */}
      <div className="glass-section p-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: PANEL_COLOR }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpCurveTypes')}</span>
        </div>
        <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('helpLinear')}:</span>
            <span>{t('helpLinearDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('helpExponential')}:</span>
            <span>{t('helpExponentialDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('helpLogarithmic')}:</span>
            <span>{t('helpLogarithmicDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('helpSigmoid')}:</span>
            <span>{t('helpSigmoidDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>{t('helpSawtooth')}:</span>
            <span>{t('helpSawtoothDesc')}</span>
          </div>
        </div>
      </div>

      {/* 플로우 존 설명 */}
      <div className="glass-section p-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpFlowZone')}</span>
        </div>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('helpFlowZoneDesc')}</p>
        <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#3db88a' }} />
            <span><strong>{t('boredom')}</strong>: {t('helpBoredomDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#5a9cf5' }} />
            <span><strong>{t('flow')}</strong>: {t('helpFlowDesc')}</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#e86161' }} />
            <span><strong>{t('anxiety')}</strong>: {t('helpAnxietyDesc')}</span>
          </div>
        </div>
      </div>

      {/* 휴식 포인트 & DDA */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Coffee className="w-3.5 h-3.5" style={{ color: '#e5a440' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpRestPoints')}</span>
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('helpRestPointsDesc')}</p>
          <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
            <div><strong style={{ color: '#e5a440' }}>{t('restStartStage')}</strong>: {t('restStartStageDesc')}</div>
            <div><strong style={{ color: '#e5a440' }}>{t('restDuration')}</strong>: {t('restDurationDesc')}</div>
          </div>
        </div>
        <div className="glass-section p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="w-3.5 h-3.5" style={{ color: '#06b6d4' }} />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpDDA')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpDDADesc')}</p>
        </div>
      </div>

      <div className="glass-divider" />

      <div className="grid grid-cols-2 gap-2 text-sm">
        {[1, 2, 3, 4].map(num => (
          <div key={num} className="flex gap-2 items-start">
            <span
              className="w-5 h-5 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: `${PANEL_COLOR}20`, color: PANEL_COLOR }}
            >
              {num}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{t(`helpStep${num}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
