/**
 * FullscreenChart - 전체화면 차트 모달
 */
import { TrendingUp, X, ZoomIn, ZoomOut, RotateCcw, Move, Coffee, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { DifficultySegment, MilestoneData, RestPoint, FlowZone } from '../hooks';

const PANEL_COLOR = '#06b6d4';

// 플로우 존 색상
const FLOW_ZONE_COLORS: Record<FlowZone, string> = {
  boredom: '#3db88a',
  flow: '#5a9cf5',
  anxiety: '#e86161',
};

interface FullscreenChartProps {
  curveData: DifficultySegment[];
  wallStages: number[];
  milestones: Record<number, MilestoneData>;
  maxStage: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onPanStart: (e: React.MouseEvent) => void;
  onPanMove: (e: React.MouseEvent) => void;
  onPanEnd: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onClose: () => void;
  showFlowZones?: boolean;
  restPoints?: RestPoint[];
  flowZoneStats?: {
    boredom: number;
    flow: number;
    anxiety: number;
    boredomPercent: number;
    flowPercent: number;
    anxietyPercent: number;
  };
}

export function FullscreenChart({
  curveData,
  wallStages,
  milestones,
  maxStage,
  zoomLevel,
  panOffset,
  isPanning,
  onZoomIn,
  onZoomOut,
  onResetView,
  onPanStart,
  onPanMove,
  onPanEnd,
  onWheel,
  onClose,
  showFlowZones = true,
  restPoints = [],
  flowZoneStats,
}: FullscreenChartProps) {
  const t = useTranslations('difficultyCurve');

  // 플로우 존 구간 계산
  const flowZoneAreas = showFlowZones ? calculateFlowZoneAreas(curveData) : [];

  const handleClose = () => {
    onResetView();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-8" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full h-[95vh] sm:h-full max-w-6xl sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
        }}
      >
        {/* 모달 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${PANEL_COLOR}15` }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: PANEL_COLOR }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('curveLabel')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('stage')} 1 ~ {maxStage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 줌 컨트롤 */}
            <div className="flex items-center gap-1 glass-section px-2 py-1 rounded-lg">
              <button
                onClick={onZoomOut}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="text-sm font-medium px-2 min-w-[50px] text-center" style={{ color: 'var(--text-secondary)' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={onZoomIn}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <button
              onClick={onResetView}
              className="glass-button !p-2"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={handleClose}
              className="glass-button !p-2"
            >
              <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>

        {/* 차트 영역 */}
        <div
          className="flex-1 p-6 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ background: 'var(--bg-primary)' }}
          onMouseDown={onPanStart}
          onMouseMove={onPanMove}
          onMouseUp={onPanEnd}
          onMouseLeave={onPanEnd}
          onWheel={onWheel}
        >
          <div
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              width: '100%',
              height: '100%',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={curveData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />

                {/* 플로우 존 배경 영역 */}
                {flowZoneAreas.map((area, idx) => (
                  <ReferenceArea
                    key={`flow-${idx}`}
                    x1={area.start}
                    x2={area.end}
                    fill={FLOW_ZONE_COLORS[area.zone]}
                    fillOpacity={0.1}
                  />
                ))}

                {/* 휴식 포인트 영역 */}
                {restPoints.map((rp) => (
                  <ReferenceArea
                    key={`rest-${rp.stage}`}
                    x1={rp.stage}
                    x2={rp.stage + rp.duration}
                    fill="#e5a440"
                    fillOpacity={0.2}
                  />
                ))}
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-secondary)' }}
                  label={{ value: t('stage'), position: 'insideBottom', offset: -10, fontSize: 12, fill: 'var(--text-secondary)' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-secondary)' }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                  label={{ value: 'Power', angle: -90, position: 'insideLeft', fontSize: 12, fill: 'var(--text-secondary)' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const segment = payload[0]?.payload as DifficultySegment | undefined;
                    const ratio = segment ? segment.playerPower / segment.enemyPower : 1;
                    return (
                      <div style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        padding: '12px 16px',
                      }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                          {t('stage')} {label}
                        </div>
                        {segment?.milestone && (
                          <div style={{ fontSize: 11, color: '#3db88a', marginBottom: 4 }}>
                            {segment.milestone}
                          </div>
                        )}
                        {segment?.type === 'wall' && (
                          <div style={{ fontSize: 11, color: '#e86161', marginBottom: 4 }}>
                            {t('wallStage')}
                          </div>
                        )}
                        {payload.map((entry: any, idx: number) => (
                          <div key={idx} style={{ fontSize: 12, color: entry.color, marginBottom: 2 }}>
                            {entry.name === 'playerPower' ? t('player') : t('enemy')}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                          </div>
                        ))}
                        {segment && (
                          <>
                            <div style={{ fontSize: 11, color: ratio >= 1 ? '#3db88a' : '#e86161', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                              {t('player')}/{t('enemy')}: {ratio.toFixed(2)}x
                            </div>
                            <div style={{ fontSize: 10, color: FLOW_ZONE_COLORS[segment.flowZone], marginTop: 4 }}>
                              {segment.flowZone === 'boredom' ? t('boredom') :
                               segment.flowZone === 'flow' ? t('flow') : t('anxiety')}
                              {segment.isRestPoint && (
                                <span style={{ marginLeft: 6, color: '#e5a440' }}>
                                  {t('restPoint')}
                                </span>
                              )}
                            </div>
                            {segment.ddaAdjustment !== 0 && (
                              <div style={{ fontSize: 10, color: segment.ddaAdjustment > 0 ? '#3db88a' : '#e86161', marginTop: 2 }}>
                                DDA: {segment.ddaAdjustment > 0 ? '+' : ''}{Math.round(segment.ddaAdjustment * 100)}%
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={40}
                  formatter={(value) => value === 'playerPower' ? t('player') : t('enemy')}
                  wrapperStyle={{ fontSize: 13 }}
                />
                {/* 벽 스테이지 표시 */}
                {wallStages.map((stage) => (
                  <ReferenceLine
                    key={stage}
                    x={stage}
                    stroke="#e86161"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{
                      value: `Wall`,
                      position: 'top',
                      fontSize: 10,
                      fill: '#e86161',
                    }}
                  />
                ))}
                {/* 마일스톤 표시 */}
                {Object.keys(milestones).map((stage) => (
                  <ReferenceLine
                    key={`milestone-${stage}`}
                    x={Number(stage)}
                    stroke="#3db88a"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="playerPower"
                  stroke="#5a9cf5"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#5a9cf5', stroke: '#fff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="enemyPower"
                  stroke="#e86161"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#e86161', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 모달 푸터 - 조작 안내 + 플로우 존 통계 */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between text-sm shrink-0"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          {/* 플로우 존 통계 */}
          {flowZoneStats && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />
                <span>{t('flowZone')}:</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.boredom }} />
                <span>{flowZoneStats.boredomPercent}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.flow }} />
                <span>{flowZoneStats.flowPercent}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: FLOW_ZONE_COLORS.anxiety }} />
                <span>{flowZoneStats.anxietyPercent}%</span>
              </div>
              {restPoints.length > 0 && (
                <div className="flex items-center gap-1">
                  <Coffee className="w-3 h-3" style={{ color: '#e5a440' }} />
                  <span>{restPoints.length}</span>
                </div>
              )}
            </div>
          )}

          {/* 조작 안내 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" />
              <span>{t('dragToMove')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{t('scrollToZoom')}</span>
            </div>
          </div>
        </div>
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
