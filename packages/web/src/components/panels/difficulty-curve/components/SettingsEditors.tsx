/**
 * SettingsEditors - 프리셋, 플레이타임, 벽 스테이지, 마일스톤, 곡선타입, 플로우존, DDA 설정 컴포넌트들
 */

'use client';

import { useState } from 'react';
import { Layers, Clock, Wand2, AlertTriangle, Zap, TrendingUp, Activity, Coffee, Sliders, BarChart3, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  CURVE_PRESETS,
  CURVE_TYPES,
  PLAYTIME_TARGETS,
  WALL_TYPES,
  type PresetKey,
  type PlaytimeKey,
  type MilestoneData,
  type CurveType,
  type FlowZoneConfig,
  type RestPoint,
  type DDAConfig,
  type WallType,
  type WallData,
} from '../hooks';

const PANEL_COLOR = '#06b6d4';

// 프리셋 선택
interface PresetSelectorProps {
  preset: PresetKey;
  setPreset: (preset: PresetKey) => void;
}

export function PresetSelector({ preset, setPreset }: PresetSelectorProps) {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4" style={{ color: PANEL_COLOR }} />
        <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('presetLabel')}
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(CURVE_PRESETS).map(([key]) => (
          <button
            key={key}
            onClick={() => setPreset(key as PresetKey)}
            className={cn(
              'glass-card p-3 text-left transition-all duration-200',
              preset === key && 'ring-2'
            )}
            style={{
              // @ts-expect-error CSS ring color custom property
              '--tw-ring-color': preset === key ? PANEL_COLOR : undefined,
              background: preset === key ? `${PANEL_COLOR}10` : undefined,
            }}
          >
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {t(`presets.${key}`)}
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t(`presets.${key}Desc`)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 플레이타임 선택
interface PlaytimeSelectorProps {
  playtime: PlaytimeKey;
  setPlaytime: (playtime: PlaytimeKey) => void;
  onGenerateRecommended: () => void;
  wallStages: number[];
  estimatedDays: Record<number, number>;
  maxStage: number;
}

export function PlaytimeSelector({
  playtime,
  setPlaytime,
  onGenerateRecommended,
  wallStages,
  estimatedDays,
  maxStage,
}: PlaytimeSelectorProps) {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: PANEL_COLOR }} />
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('playtimeLabel')}
          </label>
        </div>
        <button
          onClick={onGenerateRecommended}
          className="glass-button-primary flex items-center gap-1.5 !px-3 !py-1.5 text-sm"
          style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}dd)` }}
        >
          <Wand2 className="w-3.5 h-3.5" />
          {t('autoPlace')}
        </button>
      </div>
      <div className="glass-tabs">
        {Object.entries(PLAYTIME_TARGETS).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setPlaytime(key as PlaytimeKey)}
            className={cn('glass-tab flex-1 text-center', playtime === key && 'active')}
          >
            <div className="text-sm font-medium">{t(`playtime.${key}`)}</div>
            <div className="text-sm opacity-60 mt-0.5">
              {t('playtime.wallInterval', { interval: value.wallInterval })}
            </div>
          </button>
        ))}
      </div>

      {/* 예상 진행 시간 */}
      <div
        className="glass-section p-3 mt-2"
        style={{ background: `${PANEL_COLOR}08` }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('estimatedTime')}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            ({t(`playtime.${playtime}`)} {t('basis')})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {wallStages.slice(0, 4).map((stage) => (
            <div key={stage} className="flex items-center gap-1.5 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{t('stage')} {stage}:</span>
              <span className="font-semibold" style={{ color: PANEL_COLOR }}>
                {t('approxDays', { days: estimatedDays[stage] || 0 })}
              </span>
            </div>
          ))}
          {wallStages.length > 4 && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>+{wallStages.length - 4}</span>
          )}
          <div className="flex items-center gap-1.5 text-sm ml-auto">
            <span style={{ color: 'var(--text-secondary)' }}>{t('finalStage')}:</span>
            <span className="font-bold" style={{ color: PANEL_COLOR }}>
              {t('approxDays', { days: estimatedDays[maxStage] || 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 최대 스테이지 슬라이더
interface MaxStageSelectorProps {
  maxStage: number;
  setMaxStage: (stage: number) => void;
}

export function MaxStageSelector({ maxStage, setMaxStage }: MaxStageSelectorProps) {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('maxStage')}
        </label>
        <span
          className="glass-badge font-bold"
          style={{ color: PANEL_COLOR }}
        >
          {maxStage}
        </span>
      </div>
      <div className="glass-section p-3">
        <input
          type="range"
          min="50"
          max="500"
          step="10"
          value={maxStage}
          onChange={(e) => setMaxStage(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${PANEL_COLOR} 0%, ${PANEL_COLOR} ${((maxStage - 50) / 450) * 100}%, var(--bg-tertiary) ${((maxStage - 50) / 450) * 100}%, var(--bg-tertiary) 100%)`,
          }}
        />
        <div className="flex justify-between mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>50</span>
          <span>500</span>
        </div>
      </div>
    </div>
  );
}

// 벽 타입 아이콘 및 색상
const WALL_TYPE_COLORS: Record<WallType, string> = {
  boss: '#e86161',
  gear: '#e5a440',
  level: '#5a9cf5',
  time: '#06b6d4',
};

// 벽 스테이지 편집기 (개선된 버전)
interface WallStageEditorProps {
  wallStages: number[];
  wallData: WallData[];
  maxStage: number;
  onAdd: (stage: number, type?: WallType) => void;
  onRemove: (stage: number) => void;
  onUpdate: (stage: number, updates: Partial<WallData>) => void;
  onChangeType: (stage: number, newType: WallType) => void;
}

export function WallStageEditor({
  wallData,
  maxStage,
  onAdd,
  onRemove,
  onUpdate,
  onChangeType,
}: WallStageEditorProps) {
  const t = useTranslations('difficultyCurve');
  const [expandedWall, setExpandedWall] = useState<number | null>(null);
  const [newWallType, setNewWallType] = useState<WallType>('gear');

  // 총 예상 막힘 시간 계산
  const totalStuckTime = wallData.reduce((sum, w) => sum + w.expectedStuckTime, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: '#e86161' }} />
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('wallStages')}
          </label>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(232, 97, 97, 0.1)', color: '#e86161' }}>
            {wallData.length}{t('wallCount')}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('totalStuckTime')}: <strong style={{ color: '#e86161' }}>{totalStuckTime}{t('hours')}</strong>
        </span>
      </div>

      {/* 벽 타입 범례 */}
      <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {(Object.keys(WALL_TYPES) as WallType[]).map((type) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: WALL_TYPE_COLORS[type] }} />
            {t(`wallTypes.${type}`)}
          </span>
        ))}
      </div>

      {/* 벽 목록 */}
      <div className="space-y-2">
        {wallData.map((wall) => {
          const isExpanded = expandedWall === wall.stage;
          const typeColor = WALL_TYPE_COLORS[wall.type];

          return (
            <div
              key={wall.stage}
              className="glass-card overflow-hidden transition-all"
              style={{ borderLeft: `3px solid ${typeColor}` }}
            >
              {/* 벽 헤더 */}
              <div
                className="p-2.5 flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setExpandedWall(isExpanded ? null : wall.stage)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                )}
                <span
                  className="glass-badge shrink-0 font-bold text-xs"
                  style={{ background: `${typeColor}15`, color: typeColor }}
                >
                  {wall.stage}
                </span>
                <span className="text-sm font-medium" style={{ color: typeColor }}>
                  {t(`wallTypes.${wall.type}`)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  ×{wall.intensity.toFixed(1)}
                </span>
                <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                  ~{wall.expectedStuckTime}{t('hours')}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(wall.stage); }}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors"
                  style={{ color: '#e86161' }}
                >
                  ×
                </button>
              </div>

              {/* 벽 상세 설정 (펼쳐졌을 때) */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                  {/* 벽 타입 선택 */}
                  <div className="pt-3">
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {t('wallType')}
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(Object.keys(WALL_TYPES) as WallType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => onChangeType(wall.stage, type)}
                          className={cn(
                            'px-2 py-1.5 rounded text-xs font-medium transition-all',
                            wall.type === type ? 'ring-1' : 'opacity-60 hover:opacity-100'
                          )}
                          style={{
                            background: `${WALL_TYPE_COLORS[type]}20`,
                            color: WALL_TYPE_COLORS[type],
                            // @ts-expect-error CSS ring color
                            '--tw-ring-color': wall.type === type ? WALL_TYPE_COLORS[type] : undefined,
                          }}
                        >
                          {t(`wallTypes.${type}`)}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      {t(`wallTypeDesc.${wall.type}`)}
                    </div>
                  </div>

                  {/* 강도 & 예상 막힘 시간 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-section p-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('intensity')}</span>
                        <span className="text-xs font-bold" style={{ color: typeColor }}>
                          ×{wall.intensity.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1.1"
                        max="2.5"
                        step="0.1"
                        value={wall.intensity}
                        onChange={(e) => onUpdate(wall.stage, { intensity: Number(e.target.value) })}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${typeColor} 0%, ${typeColor} ${((wall.intensity - 1.1) / 1.4) * 100}%, var(--bg-tertiary) ${((wall.intensity - 1.1) / 1.4) * 100}%, var(--bg-tertiary) 100%)`,
                        }}
                      />
                      <div className="flex justify-between mt-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        <span>1.1×</span>
                        <span>2.5×</span>
                      </div>
                    </div>
                    <div className="glass-section p-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('expectedStuckTime')}</span>
                        <span className="text-xs font-bold" style={{ color: typeColor }}>
                          {wall.expectedStuckTime}{t('hours')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="48"
                        step="1"
                        value={wall.expectedStuckTime}
                        onChange={(e) => onUpdate(wall.stage, { expectedStuckTime: Number(e.target.value) })}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${typeColor} 0%, ${typeColor} ${((wall.expectedStuckTime - 1) / 47) * 100}%, var(--bg-tertiary) ${((wall.expectedStuckTime - 1) / 47) * 100}%, var(--bg-tertiary) 100%)`,
                        }}
                      />
                      <div className="flex justify-between mt-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        <span>1h</span>
                        <span>48h</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 새 벽 추가 */}
        <div className="glass-section p-2.5 flex items-center gap-2">
          <input
            type="number"
            placeholder={t('stagePlaceholder')}
            className="glass-input hide-spinner !w-20 !px-2 !py-1.5 text-sm"
            id="newWallStage"
          />
          <CustomSelect
            value={newWallType}
            onChange={(v) => setNewWallType(v as WallType)}
            options={(Object.keys(WALL_TYPES) as WallType[]).map((type) => ({
              value: type,
              label: t(`wallTypes.${type}`)
            }))}
            color={WALL_TYPE_COLORS[newWallType]}
            size="sm"
          />
          <button
            onClick={() => {
              const stageInput = document.getElementById('newWallStage') as HTMLInputElement;
              const stage = Number(stageInput.value);
              if (stage > 0 && stage <= maxStage) {
                onAdd(stage, newWallType);
                stageInput.value = '';
              }
            }}
            className="glass-button-primary !px-3 !py-1.5 text-sm"
            style={{ background: `linear-gradient(135deg, #e86161, #c74d4d)` }}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}

// 마일스톤 편집기 (개선된 버전)
interface MilestoneEditorProps {
  milestones: Record<number, MilestoneData>;
  onUpdate: (stage: number, name: string, powerBonus?: number) => void;
  onUpdateBonus: (stage: number, powerBonus: number) => void;
}

export function MilestoneEditor({ milestones, onUpdate, onUpdateBonus }: MilestoneEditorProps) {
  const t = useTranslations('difficultyCurve');
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);

  const milestoneEntries = Object.entries(milestones).sort(([a], [b]) => Number(a) - Number(b));
  const totalPowerBonus = milestoneEntries.reduce((sum, [, data]) => sum + data.powerBonus, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: '#3db88a' }} />
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('milestones')}
          </label>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(61, 184, 138, 0.1)', color: '#3db88a' }}>
            {milestoneEntries.length}{t('milestoneCount')}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('totalPowerBonus')}: <strong style={{ color: '#3db88a' }}>+{totalPowerBonus}%</strong>
        </span>
      </div>

      {/* 마일스톤 목록 */}
      <div className="space-y-2">
        {milestoneEntries.map(([stage, data]) => {
          const stageNum = Number(stage);
          const isExpanded = expandedMilestone === stageNum;

          return (
            <div
              key={stage}
              className="glass-card overflow-hidden transition-all"
              style={{ borderLeft: '3px solid #3db88a' }}
            >
              {/* 마일스톤 헤더 */}
              <div
                className="p-2.5 flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setExpandedMilestone(isExpanded ? null : stageNum)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                )}
                <span
                  className="glass-badge shrink-0 font-bold text-xs"
                  style={{ background: 'rgba(61, 184, 138, 0.15)', color: '#3db88a' }}
                >
                  {stage}
                </span>
                <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {data.name}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#3db88a' }}>
                  +{data.powerBonus}%
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(stageNum, ''); }}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors"
                  style={{ color: '#e86161' }}
                >
                  ×
                </button>
              </div>

              {/* 마일스톤 상세 설정 (펼쳐졌을 때) */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                  {/* 콘텐츠 이름 */}
                  <div className="pt-3">
                    <span className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {t('contentName')}
                    </span>
                    <input
                      type="text"
                      value={data.name}
                      onChange={(e) => onUpdate(stageNum, e.target.value)}
                      className="glass-input w-full !py-1.5 text-sm"
                      placeholder={t('contentName')}
                    />
                  </div>

                  {/* 파워 보너스 슬라이더 */}
                  <div className="glass-section p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('powerBonus')}</span>
                      <span className="text-xs font-bold" style={{ color: '#3db88a' }}>
                        +{data.powerBonus}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={data.powerBonus}
                      onChange={(e) => onUpdateBonus(stageNum, Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3db88a 0%, #3db88a ${data.powerBonus}%, var(--bg-tertiary) ${data.powerBonus}%, var(--bg-tertiary) 100%)`,
                      }}
                    />
                    <div className="flex justify-between mt-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* 설명 */}
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('milestoneDesc')}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 새 마일스톤 추가 */}
        <div className="glass-section p-2.5 flex items-center gap-2">
          <input
            type="number"
            placeholder={t('stagePlaceholder')}
            className="glass-input hide-spinner !w-20 !px-2 !py-1.5 text-sm"
            id="newMilestoneStage"
          />
          <input
            type="text"
            placeholder={t('unlockContent')}
            className="glass-input flex-1 !py-1.5 text-sm"
            id="newMilestoneText"
          />
          <input
            type="number"
            placeholder="%"
            className="glass-input hide-spinner !w-14 !px-2 !py-1.5 text-sm text-center"
            id="newMilestoneBonus"
            defaultValue={30}
          />
          <button
            onClick={() => {
              const stageInput = document.getElementById('newMilestoneStage') as HTMLInputElement;
              const textInput = document.getElementById('newMilestoneText') as HTMLInputElement;
              const bonusInput = document.getElementById('newMilestoneBonus') as HTMLInputElement;
              const stage = Number(stageInput.value);
              if (stage > 0 && textInput.value.trim()) {
                onUpdate(stage, textInput.value, Number(bonusInput.value) || 30);
                stageInput.value = '';
                textInput.value = '';
                bonusInput.value = '30';
              }
            }}
            className="glass-button-primary !px-3 !py-1.5 text-sm"
            style={{ background: `linear-gradient(135deg, #3db88a, #2f9e75)` }}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}

// 곡선 타입 선택
interface CurveTypeSelectorProps {
  curveType: CurveType;
  setCurveType: (type: CurveType) => void;
  sawtoothPeriod: number;
  setSawtoothPeriod: (period: number) => void;
}

export function CurveTypeSelector({
  curveType,
  setCurveType,
  sawtoothPeriod,
  setSawtoothPeriod,
}: CurveTypeSelectorProps) {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4" style={{ color: PANEL_COLOR }} />
        <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('curveType')}
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(Object.keys(CURVE_TYPES) as CurveType[]).map((type) => {
          const info = CURVE_TYPES[type];
          return (
            <button
              key={type}
              onClick={() => setCurveType(type)}
              className={cn(
                'glass-card p-3 text-left transition-all duration-200',
                curveType === type && 'ring-2'
              )}
              style={{
                // @ts-expect-error CSS ring color custom property
                '--tw-ring-color': curveType === type ? PANEL_COLOR : undefined,
                background: curveType === type ? `${PANEL_COLOR}10` : undefined,
              }}
            >
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {t(`curve.${type}`)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t(`curve.${type}Desc`)}
              </div>
              <div className="text-xs mt-1 font-mono opacity-60" style={{ color: 'var(--text-tertiary)' }}>
                {info.formula}
              </div>
            </button>
          );
        })}
      </div>

      {/* 톱니파 주기 설정 (sawtooth 선택 시만 표시) */}
      {curveType === 'sawtooth' && (
        <div className="glass-section p-3 mt-2" style={{ background: `${PANEL_COLOR}08` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('sawtoothPeriod')}
            </span>
            <span className="text-sm font-bold" style={{ color: PANEL_COLOR }}>
              {sawtoothPeriod} {t('stages')}
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={sawtoothPeriod}
            onChange={(e) => setSawtoothPeriod(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${PANEL_COLOR} 0%, ${PANEL_COLOR} ${((sawtoothPeriod - 5) / 25) * 100}%, var(--bg-tertiary) ${((sawtoothPeriod - 5) / 25) * 100}%, var(--bg-tertiary) 100%)`,
            }}
          />
          <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span>5</span>
            <span>30</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 플로우 존 설정 (토글 형태)
interface FlowZoneEditorProps {
  flowZoneConfig: FlowZoneConfig;
  setFlowZoneConfig: (config: FlowZoneConfig) => void;
  showFlowZones: boolean;
  setShowFlowZones: (show: boolean) => void;
  flowZoneStats: {
    boredom: number;
    flow: number;
    anxiety: number;
    boredomPercent: number;
    flowPercent: number;
    anxietyPercent: number;
  };
}

export function FlowZoneEditor({
  flowZoneConfig,
  setFlowZoneConfig,
  showFlowZones,
  setShowFlowZones,
  flowZoneStats,
}: FlowZoneEditorProps) {
  const t = useTranslations('difficultyCurve');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-card overflow-hidden">
      {/* 설명 메시지 */}
      <div className="px-3 py-2 text-xs" style={{ background: 'rgba(90, 156, 245, 0.08)', color: 'var(--text-secondary)' }}>
        {t('flowZoneNote')}
      </div>

      {/* 헤더 (토글 버튼) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
          <Activity className="w-4 h-4" style={{ color: '#5a9cf5' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('flowZone')}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(90, 156, 245, 0.1)', color: '#5a9cf5' }}>
            Flow Theory
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 요약 통계 (접혀있을 때) */}
          {!isExpanded && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#5a9cf5' }} />
              {flowZoneStats.flowPercent}% {t('flow')}
            </div>
          )}
          <div
            onClick={(e) => { e.stopPropagation(); setShowFlowZones(!showFlowZones); }}
            className={cn(
              'px-2 py-0.5 rounded text-xs transition-all cursor-pointer',
              showFlowZones ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
            )}
          >
            {showFlowZones ? t('visible') : t('hidden')}
          </div>
        </div>
      </button>

      {/* 내용 (펼쳐졌을 때) */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          {/* 플로우 존 통계 */}
          <div className="glass-section p-3 space-y-2 mt-3">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{t('zoneDistribution')}</span>
            </div>
            <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-center text-xs font-medium transition-all"
                style={{
                  width: `${flowZoneStats.boredomPercent}%`,
                  background: '#3db88a',
                  color: 'white',
                  minWidth: flowZoneStats.boredomPercent > 5 ? 'auto' : '0',
                }}
              >
                {flowZoneStats.boredomPercent > 10 && `${flowZoneStats.boredomPercent}%`}
              </div>
              <div
                className="flex items-center justify-center text-xs font-medium transition-all"
                style={{
                  width: `${flowZoneStats.flowPercent}%`,
                  background: '#5a9cf5',
                  color: 'white',
                  minWidth: flowZoneStats.flowPercent > 5 ? 'auto' : '0',
                }}
              >
                {flowZoneStats.flowPercent > 10 && `${flowZoneStats.flowPercent}%`}
              </div>
              <div
                className="flex items-center justify-center text-xs font-medium transition-all"
                style={{
                  width: `${flowZoneStats.anxietyPercent}%`,
                  background: '#e86161',
                  color: 'white',
                  minWidth: flowZoneStats.anxietyPercent > 5 ? 'auto' : '0',
                }}
              >
                {flowZoneStats.anxietyPercent > 10 && `${flowZoneStats.anxietyPercent}%`}
              </div>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#3db88a' }} />
                {t('boredom')} ({flowZoneStats.boredom})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#5a9cf5' }} />
                {t('flow')} ({flowZoneStats.flow})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#e86161' }} />
                {t('anxiety')} ({flowZoneStats.anxiety})
              </span>
            </div>
          </div>

          {/* 임계값 설정 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#3db88a' }}>{t('boredomThreshold')}</span>
                <span className="text-sm font-bold" style={{ color: '#3db88a' }}>
                  {flowZoneConfig.boredomThreshold.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1.1"
                max="2.0"
                step="0.1"
                value={flowZoneConfig.boredomThreshold}
                onChange={(e) => setFlowZoneConfig({
                  ...flowZoneConfig,
                  boredomThreshold: Number(e.target.value)
                })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #3db88a, var(--bg-tertiary))` }}
              />
              <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('boredomThresholdDesc')}
              </div>
            </div>
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#e86161' }}>{t('anxietyThreshold')}</span>
                <span className="text-sm font-bold" style={{ color: '#e86161' }}>
                  {flowZoneConfig.anxietyThreshold.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={flowZoneConfig.anxietyThreshold}
                onChange={(e) => setFlowZoneConfig({
                  ...flowZoneConfig,
                  anxietyThreshold: Number(e.target.value)
                })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--bg-tertiary), #e86161)` }}
              />
              <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('anxietyThresholdDesc')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 휴식 포인트 편집기
interface RestPointEditorProps {
  restPoints: RestPoint[];
  maxStage: number;
  onAdd: (stage: number, duration?: number, reason?: string) => void;
  onRemove: (stage: number) => void;
  onUpdate: (stage: number, updates: Partial<RestPoint>) => void;
}

export function RestPointEditor({
  restPoints,
  maxStage,
  onAdd,
  onRemove,
  onUpdate,
}: RestPointEditorProps) {
  const t = useTranslations('difficultyCurve');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Coffee className="w-4 h-4" style={{ color: '#e5a440' }} />
        <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('restPoints')}
        </label>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          ({t('restPointsDesc')})
        </span>
      </div>

      {/* 휴식 포인트 설명 */}
      <div className="glass-section p-2.5 text-xs" style={{ background: 'rgba(229, 164, 64, 0.05)', color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-4">
          <span><strong style={{ color: '#e5a440' }}>{t('restStartStage')}</strong>: {t('restStartStageDesc')}</span>
          <span><strong style={{ color: '#e5a440' }}>{t('restDuration')}</strong>: {t('restDurationDesc')}</span>
        </div>
      </div>

      {/* 열 헤더 */}
      {restPoints.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span className="w-10 text-center">{t('restStartStage')}</span>
          <span className="flex-1">{t('restReason')}</span>
          <span className="w-20 text-center">{t('restDuration')}</span>
          <span className="w-6"></span>
        </div>
      )}

      <div className="space-y-2">
        {restPoints.map((rp) => (
          <div
            key={rp.stage}
            className="glass-card p-2.5 flex items-center gap-2"
            style={{ background: 'rgba(229, 164, 64, 0.05)' }}
          >
            <span
              className="glass-badge shrink-0 font-bold w-10 text-center"
              style={{ background: 'rgba(229, 164, 64, 0.15)', color: '#e5a440' }}
            >
              {rp.stage}
            </span>
            <input
              type="text"
              value={rp.reason}
              onChange={(e) => onUpdate(rp.stage, { reason: e.target.value })}
              className="glass-input flex-1 !py-1.5 text-sm"
              placeholder={t('restReason')}
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                value={rp.duration}
                onChange={(e) => onUpdate(rp.stage, { duration: Number(e.target.value) || 1 })}
                className="glass-input hide-spinner !w-12 !px-2 !py-1.5 text-sm text-center"
                min={1}
                max={10}
              />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('stagesUnit')}</span>
            </div>
            <button
              onClick={() => onRemove(rp.stage)}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
              style={{ color: '#e86161' }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="glass-section p-2.5 flex items-center gap-2">
          <input
            type="number"
            placeholder={t('restStartStage')}
            className="glass-input hide-spinner !w-20 !px-2 !py-1.5 text-sm"
            id="newRestPointStage"
          />
          <input
            type="text"
            placeholder={t('restReason')}
            className="glass-input flex-1 !py-1.5 text-sm"
            id="newRestPointReason"
          />
          <input
            type="number"
            placeholder="1"
            className="glass-input hide-spinner !w-12 !px-2 !py-1.5 text-sm text-center"
            id="newRestPointDuration"
            defaultValue={1}
            title={t('restDurationDesc')}
          />
          <button
            onClick={() => {
              const stageInput = document.getElementById('newRestPointStage') as HTMLInputElement;
              const reasonInput = document.getElementById('newRestPointReason') as HTMLInputElement;
              const durationInput = document.getElementById('newRestPointDuration') as HTMLInputElement;
              const stage = Number(stageInput.value);
              if (stage > 0 && stage <= maxStage) {
                onAdd(stage, Number(durationInput.value) || 1, reasonInput.value || t('restDefault'));
                stageInput.value = '';
                reasonInput.value = '';
                durationInput.value = '1';
              }
            }}
            className="glass-button-primary !px-3 !py-1.5 text-sm"
            style={{ background: `linear-gradient(135deg, #e5a440, #d49430)` }}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}

// 동적 난이도 조절 (DDA) 설정 (토글 형태)
interface DDAEditorProps {
  ddaConfig: DDAConfig;
  setDDAConfig: (config: DDAConfig) => void;
  ddaSimulation: { currentStreak: number; streakType: 'win' | 'loss' | 'none' };
  onSimulateWin: (count: number) => void;
  onSimulateLoss: (count: number) => void;
  onResetSimulation: () => void;
}

export function DDAEditor({
  ddaConfig,
  setDDAConfig,
  ddaSimulation,
  onSimulateWin,
  onSimulateLoss,
  onResetSimulation,
}: DDAEditorProps) {
  const t = useTranslations('difficultyCurve');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-card overflow-hidden">
      {/* 시뮬레이션 안내 메시지 */}
      <div className="px-3 py-2 text-xs" style={{ background: 'rgba(168, 85, 247, 0.08)', color: 'var(--text-secondary)' }}>
        {t('ddaSimulationNote')}
      </div>

      {/* 헤더 (토글 버튼) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
          <Sliders className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('dda')}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
            {t('ddaSimulationBadge')}
          </span>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); setDDAConfig({ ...ddaConfig, enabled: !ddaConfig.enabled }); }}
          className={cn(
            'px-2 py-0.5 rounded text-xs transition-all cursor-pointer',
            ddaConfig.enabled ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
          )}
        >
          {ddaConfig.enabled ? t('enabled') : t('disabled')}
        </div>
      </button>

      {/* 내용 (펼쳐졌을 때) */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          {/* DDA 파라미터 설정 */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('winStreakThreshold')}</span>
                <span className="text-sm font-bold" style={{ color: '#3db88a' }}>
                  {ddaConfig.winStreakThreshold}{t('consecutive')}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={ddaConfig.winStreakThreshold}
                onChange={(e) => setDDAConfig({ ...ddaConfig, winStreakThreshold: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #3db88a, var(--bg-tertiary))` }}
              />
            </div>
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('lossStreakThreshold')}</span>
                <span className="text-sm font-bold" style={{ color: '#e86161' }}>
                  {ddaConfig.lossStreakThreshold}{t('consecutive')}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={ddaConfig.lossStreakThreshold}
                onChange={(e) => setDDAConfig({ ...ddaConfig, lossStreakThreshold: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--bg-tertiary), #e86161)` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('adjustmentRate')}</span>
                <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
                  {Math.round(ddaConfig.adjustmentRate * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.25"
                step="0.05"
                value={ddaConfig.adjustmentRate}
                onChange={(e) => setDDAConfig({ ...ddaConfig, adjustmentRate: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #06b6d4, var(--bg-tertiary))` }}
              />
            </div>
            <div className="glass-section p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('maxAdjustment')}</span>
                <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
                  ±{Math.round(ddaConfig.maxAdjustment * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={ddaConfig.maxAdjustment}
                onChange={(e) => setDDAConfig({ ...ddaConfig, maxAdjustment: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, var(--bg-tertiary), #06b6d4)` }}
              />
            </div>
          </div>

          {/* DDA 시뮬레이션 */}
          <div className="glass-section p-3" style={{ background: 'rgba(168, 85, 247, 0.05)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-3.5 h-3.5" style={{ color: '#06b6d4' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('ddaSimulation')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('currentState')}:</span>
              {ddaSimulation.streakType === 'none' ? (
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('noStreak')}</span>
              ) : (
                <span
                  className="text-sm font-bold"
                  style={{ color: ddaSimulation.streakType === 'win' ? '#3db88a' : '#e86161' }}
                >
                  {ddaSimulation.currentStreak}{ddaSimulation.streakType === 'win' ? t('winStreak') : t('lossStreak')}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {[3, 5, 7, 10].map((count) => (
                <button
                  key={`win-${count}`}
                  onClick={() => onSimulateWin(count)}
                  className="px-2 py-1 rounded text-xs transition-all hover:opacity-80"
                  style={{ background: 'rgba(61, 184, 138, 0.2)', color: '#3db88a' }}
                >
                  {count}{t('win')}
                </button>
              ))}
              {[3, 5, 7, 10].map((count) => (
                <button
                  key={`loss-${count}`}
                  onClick={() => onSimulateLoss(count)}
                  className="px-2 py-1 rounded text-xs transition-all hover:opacity-80"
                  style={{ background: 'rgba(232, 97, 97, 0.2)', color: '#e86161' }}
                >
                  {count}{t('loss')}
                </button>
              ))}
              <button
                onClick={onResetSimulation}
                className="px-2 py-1 rounded text-xs transition-all hover:opacity-80"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {t('reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
