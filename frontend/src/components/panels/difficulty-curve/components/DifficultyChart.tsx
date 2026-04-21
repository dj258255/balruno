/**
 * DifficultyChart - 난이도 곡선 시각화 컴포넌트
 *
 * 현업 게임 디자이너 수준의 시각화:
 * - 플로우 존 시각화 (지루함/몰입/불안)
 * - 휴식 포인트 표시
 * - DDA 조정 표시
 */

'use client';

import { TrendingUp, Maximize2, Coffee } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ReferenceArea,
  Area,
  ComposedChart,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { DifficultySegment, RestPoint, FlowZone } from '../hooks';

const PANEL_COLOR = '#9179f2';

// 플로우 존 색상
const FLOW_ZONE_COLORS: Record<FlowZone, string> = {
  boredom: '#3db88a',  // 녹색 - 지루함 (너무 쉬움)
  flow: '#5a9cf5',     // 파란색 - 몰입 (적정)
  anxiety: '#e86161',  // 빨간색 - 불안 (너무 어려움)
};

interface DifficultyChartProps {
  curveData: DifficultySegment[];
  wallStages: number[];
  maxStage: number;
  hoveredStage: number | null;
  setHoveredStage: (stage: number | null) => void;
  hoveredData: DifficultySegment | null;
  onShowFullscreen: () => void;
  showFlowZones?: boolean;
  restPoints?: RestPoint[];
  /** 차트 직접 조작 — 클릭한 지점의 stage 에 벽 추가/제거 토글 */
  onToggleWall?: (stage: number) => void;
}

export function DifficultyChart({
  curveData,
  wallStages,
  maxStage,
  hoveredStage,
  setHoveredStage,
  hoveredData,
  onShowFullscreen,
  showFlowZones = true,
  restPoints = [],
  onToggleWall,
}: DifficultyChartProps) {
  const t = useTranslations('difficultyCurve');

  // 플로우 존 구간 계산
  const flowZoneAreas = showFlowZones ? calculateFlowZoneAreas(curveData) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: PANEL_COLOR }} />
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('curveLabel')}
          </label>
        </div>
      </div>
      <div className="glass-card p-4 relative overflow-hidden group">
        {/* 전체화면 버튼 */}
        <button
          onClick={onShowFullscreen}
          className="absolute top-3 right-3 z-20 glass-button !p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title={t('fullscreen')}
        >
          <Maximize2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>

        {onToggleWall && (
          <div className="text-caption mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
            차트를 클릭하면 해당 위치에 <strong>벽 스테이지</strong>를 추가/제거합니다
          </div>
        )}

        {/* 그래프 - Recharts */}
        <div className="h-40" style={{ cursor: onToggleWall ? 'crosshair' : 'default' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={curveData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              onClick={(e) => {
                if (!onToggleWall || !e || typeof e.activeLabel !== 'number') return;
                const stage = Math.round(e.activeLabel);
                if (stage < 1 || stage > maxStage) return;
                onToggleWall(stage);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />

              {/* 플로우 존 배경 영역 */}
              {flowZoneAreas.map((area, idx) => (
                <ReferenceArea
                  key={`flow-${idx}`}
                  x1={area.start}
                  x2={area.end}
                  fill={FLOW_ZONE_COLORS[area.zone]}
                  fillOpacity={0.15}
                />
              ))}

              {/* 휴식 포인트 영역 */}
              {restPoints.map((rp) => (
                <ReferenceArea
                  key={`rest-${rp.stage}`}
                  x1={rp.stage}
                  x2={rp.stage + rp.duration}
                  fill="#e5a440"
                  fillOpacity={0.15}
                />
              ))}

              <XAxis
                dataKey="stage"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-primary)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-primary)' }}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const segment = payload[0]?.payload as DifficultySegment | undefined;
                  return (
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      padding: '8px 12px',
                      fontSize: 11,
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                        {t('stage')} {label}
                      </div>
                      <div style={{ color: '#5a9cf5' }}>{t('player')}: {segment?.playerPower.toLocaleString()}</div>
                      <div style={{ color: '#e86161' }}>{t('enemy')}: {segment?.enemyPower.toLocaleString()}</div>
                      <div style={{
                        marginTop: 4,
                        paddingTop: 4,
                        borderTop: '1px solid var(--border-primary)',
                        fontWeight: 600,
                        color: segment && segment.ratio >= 1 ? '#3db88a' : '#e86161'
                      }}>
                        {t('ratio')}: {segment?.ratio.toFixed(2)}x {segment && segment.ratio >= 1 ? '(Clear)' : '(Wall)'}
                      </div>
                      {/* 플로우 존 표시 */}
                      {segment && (
                        <div style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: FLOW_ZONE_COLORS[segment.flowZone],
                        }}>
                          {segment.flowZone === 'boredom' ? t('boredom') :
                           segment.flowZone === 'flow' ? t('flow') : t('anxiety')}
                          {segment.isRestPoint && (
                            <span style={{ marginLeft: 6, color: '#e5a440' }}>
                              {t('restPoint')}
                            </span>
                          )}
                        </div>
                      )}
                      {/* DDA 조정 표시 */}
                      {segment && segment.ddaAdjustment !== 0 && (
                        <div style={{
                          marginTop: 2,
                          fontSize: 10,
                          color: segment.ddaAdjustment > 0 ? '#3db88a' : '#e86161',
                        }}>
                          DDA: {segment.ddaAdjustment > 0 ? '+' : ''}{Math.round(segment.ddaAdjustment * 100)}%
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={30}
                formatter={(value) => value === 'playerPower' ? t('player') : t('enemy')}
                wrapperStyle={{ fontSize: 11 }}
              />
              {/* 벽 스테이지 표시 */}
              {wallStages.map((stage) => (
                <ReferenceLine
                  key={stage}
                  x={stage}
                  stroke="#e86161"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              ))}
              <Line
                type="monotone"
                dataKey="playerPower"
                stroke="#5a9cf5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#5a9cf5' }}
              />
              <Line
                type="monotone"
                dataKey="enemyPower"
                stroke="#e86161"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#e86161' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 비율 그래프 */}
        <RatioChart
          curveData={curveData}
          maxStage={maxStage}
          hoveredStage={hoveredStage}
          setHoveredStage={setHoveredStage}
          hoveredData={hoveredData}
          showFlowZones={showFlowZones}
        />
      </div>
    </div>
  );
}

interface RatioChartProps {
  curveData: DifficultySegment[];
  maxStage: number;
  hoveredStage: number | null;
  setHoveredStage: (stage: number | null) => void;
  hoveredData: DifficultySegment | null;
  showFlowZones?: boolean;
}

function RatioChart({
  curveData,
  maxStage,
  hoveredStage,
  setHoveredStage,
  hoveredData,
  showFlowZones = true,
}: RatioChartProps) {
  const t = useTranslations('difficultyCurve');

  // 플로우 존 구간 계산
  const flowZoneAreas = showFlowZones ? calculateFlowZoneAreas(curveData) : [];

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>{t('ratio')} ({t('player')}/{t('enemy')})</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.boredom }} />
            {t('boredom')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.flow }} />
            {t('flow')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.anxiety }} />
            {t('anxiety')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#e5a440' }} />
            {t('restPoint')}
          </span>
        </div>
      </div>
      {/* 비율 막대 그래프 */}
      <div
        className="relative h-12 rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-tertiary)' }}
        onMouseLeave={() => setHoveredStage(null)}
      >
        {/* 플로우 존 배경 영역 */}
        {showFlowZones && flowZoneAreas.map((area, idx) => {
          const startPercent = ((area.start - 1) / curveData.length) * 100;
          const widthPercent = ((area.end - area.start + 1) / curveData.length) * 100;
          const showLabel = widthPercent > 15; // 15% 이상일 때만 라벨 표시

          return (
            <div
              key={`zone-bg-${idx}`}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
                background: FLOW_ZONE_COLORS[area.zone],
                opacity: 0.12,
              }}
            >
              {showLabel && (
                <div
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 text-caption font-medium"
                  style={{ color: FLOW_ZONE_COLORS[area.zone], opacity: 0.9 }}
                >
                  {area.zone === 'boredom' ? t('boredom') :
                   area.zone === 'flow' ? t('flow') : t('anxiety')}
                </div>
              )}
            </div>
          );
        })}

        {/* 기준선 (비율 1.0) */}
        <div
          className="absolute left-0 right-0 border-t border-dashed z-10 pointer-events-none"
          style={{ top: '33.3%', borderColor: 'var(--text-secondary)', opacity: 0.5 }}
        />
        <div
          className="absolute right-1 text-caption z-10 pointer-events-none"
          style={{ top: '33.3%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
        >
          1.0
        </div>
        {/* 막대들 */}
        <div className="absolute inset-0 flex items-end rounded-lg overflow-hidden">
          {curveData.map((d, i) => {
            const width = 100 / curveData.length;
            const normalizedRatio = Math.min(Math.max(d.ratio, 0.5), 2.0);
            const height = ((normalizedRatio - 0.5) / 1.5) * 100;

            // 플로우 존 기반 색상
            const color = FLOW_ZONE_COLORS[d.flowZone];

            const isHovered = hoveredStage === d.stage;

            return (
              <div
                key={i}
                className="relative cursor-pointer"
                style={{ width: `${width}%`, height: '100%' }}
                onMouseEnter={() => setHoveredStage(d.stage)}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 transition-all duration-100"
                  style={{
                    height: `${height}%`,
                    background: color,
                    opacity: isHovered ? 1 : 0.7,
                    marginLeft: curveData.length > 50 ? '0px' : '1px',
                    marginRight: curveData.length > 50 ? '0px' : '1px',
                    borderRadius: curveData.length > 50 ? '0' : '2px 2px 0 0',
                    transform: isHovered ? 'scaleY(1.1)' : 'scaleY(1)',
                    transformOrigin: 'bottom',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* 호버 정보 표시 영역 */}
      <div
        className="flex items-center justify-between text-sm h-5"
        style={{ color: 'var(--text-secondary)' }}
      >
        {hoveredData ? (
          <div className="flex items-center gap-3 w-full">
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('stage')} {hoveredData.stage}
            </span>
            <span style={{
              color: FLOW_ZONE_COLORS[hoveredData.flowZone],
              fontWeight: 600
            }}>
              {hoveredData.ratio.toFixed(2)}x
              ({hoveredData.flowZone === 'boredom' ? t('boredom') :
                hoveredData.flowZone === 'flow' ? t('flow') : t('anxiety')})
            </span>
            {hoveredData.isRestPoint && (
              <span className="flex items-center gap-1" style={{ color: '#e5a440' }}>
                <Coffee className="w-3 h-3" />
                {t('restPoint')}
              </span>
            )}
            <span className="ml-auto">
              {t('player')}: {hoveredData.playerPower.toLocaleString()} / {t('enemy')}: {hoveredData.enemyPower.toLocaleString()}
            </span>
          </div>
        ) : (
          <>
            <span>{t('stage')} 1</span>
            <span className="text-caption">( {t('stage')} 1~{maxStage} )</span>
            <span>{t('stage')} {maxStage}</span>
          </>
        )}
      </div>
    </div>
  );
}

// 플로우 존 연속 구간 계산 헬퍼
function calculateFlowZoneAreas(curveData: DifficultySegment[]): Array<{
  start: number;
  end: number;
  zone: FlowZone;
}> {
  if (curveData.length === 0) return [];

  const areas: Array<{ start: number; end: number; zone: FlowZone }> = [];
  let currentZone = curveData[0].flowZone;
  let startStage = curveData[0].stage;

  for (let i = 1; i < curveData.length; i++) {
    const segment = curveData[i];
    if (segment.flowZone !== currentZone) {
      areas.push({
        start: startStage,
        end: curveData[i - 1].stage,
        zone: currentZone,
      });
      currentZone = segment.flowZone;
      startStage = segment.stage;
    }
  }

  // 마지막 구간 추가
  areas.push({
    start: startStage,
    end: curveData[curveData.length - 1].stage,
    zone: currentZone,
  });

  return areas;
}
