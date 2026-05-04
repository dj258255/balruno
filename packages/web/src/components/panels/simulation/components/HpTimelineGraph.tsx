import { useState, useRef, useMemo } from 'react';
import { Maximize2, X, ZoomIn, ZoomOut, Skull, Sword, Heart, Shield, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BattleLogEntry {
  time: number;
  actor: string;
  action?: 'attack' | 'skill' | 'buff' | 'debuff' | 'heal' | 'hot_tick' | 'hot_end' | 'death' | 'invincible' | 'invincible_end' | 'revive';
  remainingHp?: number;
  target?: string;
  skillName?: string;
  damage?: number;
  healAmount?: number;
}

interface HpTimelineGraphProps {
  log: BattleLogEntry[];
  unit1Name: string;
  unit2Name: string;
  unit1MaxHp: number;
  unit2MaxHp: number;
}

// 그래프 렌더링 컴포넌트 (재사용)
function HpGraph({
  hpTimeline,
  skillEvents,
  maxTime,
  unit1Name,
  unit2Name,
  unit1MaxHp,
  unit2MaxHp,
  hoveredPoint,
  setHoveredPoint,
  containerRef,
  height = 'h-32',
  showTooltip = true,
  zoomLevel = 1,
}: {
  hpTimeline: { time: number; unit1Hp: number; unit2Hp: number }[];
  skillEvents: (BattleLogEntry & { hp: number; maxHp: number })[];
  maxTime: number;
  unit1Name: string;
  unit2Name: string;
  unit1MaxHp: number;
  unit2MaxHp: number;
  hoveredPoint: { time: number; unit1Hp: number; unit2Hp: number } | null;
  setHoveredPoint: (point: { time: number; unit1Hp: number; unit2Hp: number } | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  height?: string;
  showTooltip?: boolean;
  zoomLevel?: number;
}) {
  const t = useTranslations('simulation');
  // 여백 (%) - 끝부분이 잘리지 않도록
  const paddingX = 2;
  const paddingTop = 4;
  const paddingBottom = 10; // 하단 여백 더 크게 (해골 아이콘용)
  const getX = (time: number) => paddingX + (time / maxTime) * (100 - paddingX * 2);
  const getY = (hp: number, maxUnitHp: number) => paddingTop + (1 - hp / maxUnitHp) * (100 - paddingTop - paddingBottom);

  // 점을 잇는 선 그래프 (HP 0 지점도 포함)
  const createLinePath = (getData: (point: typeof hpTimeline[0]) => number, maxUnitHp: number) => {
    const pathParts: string[] = [];
    for (let i = 0; i < hpTimeline.length; i++) {
      const point = hpTimeline[i];
      const hp = getData(point);
      const x = getX(point.time);
      const y = getY(hp, maxUnitHp);

      pathParts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);

      // HP가 0이면 여기서 종료
      if (hp <= 0) break;
    }
    return pathParts.join(' ');
  };

  // 각 포인트의 좌표 계산 (HP 0 제외, 사망 지점 별도 추출)
  const getPointsAndDeath = (getData: (point: typeof hpTimeline[0]) => number, maxUnitHp: number) => {
    const points: { x: number; y: number; time: number; hp: number }[] = [];
    let deathPoint: { x: number; y: number; time: number } | null = null;

    for (const point of hpTimeline) {
      const hp = getData(point);
      const x = getX(point.time);
      const y = getY(hp, maxUnitHp);

      if (hp <= 0) {
        // 사망 지점 저장 (HP 0 위치)
        deathPoint = { x, y: getY(0, maxUnitHp), time: point.time };
        break;
      }

      points.push({ x, y, time: point.time, hp });
    }

    return { points, deathPoint };
  };

  const unit1Path = createLinePath(p => p.unit1Hp, unit1MaxHp);
  const unit2Path = createLinePath(p => p.unit2Hp, unit2MaxHp);
  const { points: unit1Points, deathPoint: unit1Death } = getPointsAndDeath(p => p.unit1Hp, unit1MaxHp);
  const { points: unit2Points, deathPoint: unit2Death } = getPointsAndDeath(p => p.unit2Hp, unit2MaxHp);

  // x좌표(%)에서 시간으로 역변환 (패딩 고려)
  const getTimeFromX = (xPercent: number) => {
    return ((xPercent - paddingX) / (100 - paddingX * 2)) * maxTime;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft || 0;
    const totalWidth = containerRef.current.scrollWidth || rect.width;
    const xPercent = ((e.clientX - rect.left + scrollLeft) / totalWidth) * 100;
    const time = getTimeFromX(xPercent);

    // 가장 가까운 시간 찾기
    let closestTime = hpTimeline[0].time;
    let minDiff = Math.abs(closestTime - time);
    for (const point of hpTimeline) {
      const diff = Math.abs(point.time - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = point.time;
      }
    }

    // 해당 시간의 마지막 포인트 선택 (같은 시간에 여러 이벤트 있을 경우 최종 상태)
    let closest = hpTimeline[0];
    for (const point of hpTimeline) {
      if (point.time === closestTime) {
        closest = point;
      }
    }
    setHoveredPoint(closest);
  };

  const graphWidth = zoomLevel > 1 ? `${zoomLevel * 100}%` : '100%';

  return (
    <div
      ref={containerRef}
      className={`relative ${height} rounded-lg cursor-crosshair ${zoomLevel > 1 ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}
      style={{ background: 'var(--bg-primary)' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredPoint(null)}
    >
      <div className="relative h-full" style={{ width: graphWidth, minWidth: '100%' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="25" y1="0" x2="25" y2="100" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="75" y1="0" x2="75" y2="100" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Unit 1 HP line */}
          <path d={unit1Path} fill="none" stroke="var(--primary-blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Unit 2 HP line */}
          <path d={unit2Path} fill="none" stroke="var(--primary-red)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Skill event markers (vertical lines) */}
          {skillEvents.map((event, i) => {
            let color = '#e5a440';
            if (event.action === 'heal') color = '#3db88a';
            if (event.action === 'invincible') color = '#5a9cf5';
            if (event.action === 'revive') color = '#a896f5';

            return (
              <line
                key={`skill-line-${i}`}
                x1={getX(event.time)}
                y1="0"
                x2={getX(event.time)}
                y2="100"
                stroke={color}
                strokeWidth="1"
                strokeDasharray="2,2"
                strokeOpacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Hover indicator */}
          {hoveredPoint && (
            <line
              x1={getX(hoveredPoint.time)} y1="0"
              x2={getX(hoveredPoint.time)} y2="100"
              stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4,4" vectorEffect="non-scaling-stroke"
              strokeOpacity="0.5"
            />
          )}
        </svg>

        {/* Data points - Unit 1 */}
        {unit1Points.map((point, i) => (
          <div
            key={`unit1-point-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              background: 'var(--primary-blue)',
            }}
          />
        ))}

        {/* Data points - Unit 2 */}
        {unit2Points.map((point, i) => (
          <div
            key={`unit2-point-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              background: 'var(--primary-red)',
            }}
          />
        ))}

        {/* Death markers */}
        {unit1Death && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${unit1Death.x}%`,
              top: `${unit1Death.y}%`,
            }}
            title={t('unit1Death', { name: unit1Name, time: unit1Death.time.toFixed(1) })}
          >
            <Skull className="w-3 h-3" style={{ color: 'var(--primary-blue)', filter: 'drop-shadow(0 0 2px var(--primary-blue))' }} />
          </div>
        )}
        {unit2Death && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${unit2Death.x}%`,
              top: `${unit2Death.y}%`,
            }}
            title={t('unit1Death', { name: unit2Name, time: unit2Death.time.toFixed(1) })}
          >
            <Skull className="w-3 h-3" style={{ color: 'var(--primary-red)', filter: 'drop-shadow(0 0 2px var(--primary-red))' }} />
          </div>
        )}

        {/* Skill event markers */}
        {skillEvents.map((event, i) => {
          let color = '#e5a440';
          let Icon = Sword;
          if (event.action === 'heal') { color = '#3db88a'; Icon = Heart; }
          if (event.action === 'invincible') { color = '#5a9cf5'; Icon = Shield; }
          if (event.action === 'revive') { color = '#a896f5'; Icon = RotateCcw; }

          return (
            <div
              key={`skill-marker-${i}`}
              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                left: `${getX(event.time)}%`,
                top: `${getY(event.hp, event.maxHp)}%`,
              }}
              title={`${event.skillName || event.action} (${event.time.toFixed(1)}s)`}
            >
              <Icon className="w-3 h-3" style={{ color, filter: 'drop-shadow(0 0 2px var(--bg-primary))' }} />
            </div>
          );
        })}

        {/* Hover points */}
        {hoveredPoint && (
          <>
            <div
              className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white shadow-sm"
              style={{
                left: `${getX(hoveredPoint.time)}%`,
                top: `${getY(hoveredPoint.unit1Hp, unit1MaxHp)}%`,
                background: 'var(--primary-blue)',
              }}
            />
            <div
              className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white shadow-sm"
              style={{
                left: `${getX(hoveredPoint.time)}%`,
                top: `${getY(hoveredPoint.unit2Hp, unit2MaxHp)}%`,
                background: 'var(--primary-red)',
              }}
            />
          </>
        )}
      </div>

      {/* Hover tooltip - fixed position */}
      {showTooltip && hoveredPoint && (
        <div
          className="absolute top-2 left-2 px-2.5 py-1.5 rounded-lg text-sm z-10 shadow-lg pointer-events-none"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <div className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{hoveredPoint.time.toFixed(1)}s</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary-blue)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{unit1Name}:</span>
            <span style={{ color: 'var(--primary-blue)' }}>{hoveredPoint.unit1Hp.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary-red)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{unit2Name}:</span>
            <span style={{ color: 'var(--primary-red)' }}>{hoveredPoint.unit2Hp.toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HpTimelineGraph({
  log,
  unit1Name,
  unit2Name,
  unit1MaxHp,
  unit2MaxHp
}: HpTimelineGraphProps) {
  const t = useTranslations('simulation');
  const [hoveredPoint, setHoveredPoint] = useState<{ time: number; unit1Hp: number; unit2Hp: number } | null>(null);
  const [modalHoveredPoint, setModalHoveredPoint] = useState<{ time: number; unit1Hp: number; unit2Hp: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // 로그에서 시간별 HP 추출
  const hpTimeline = useMemo(() => {
    const timeline: { time: number; unit1Hp: number; unit2Hp: number }[] = [];
    let unit1Hp = unit1MaxHp;
    let unit2Hp = unit2MaxHp;

    timeline.push({ time: 0, unit1Hp, unit2Hp });

    for (const entry of log) {
      // 사망 이벤트 - actor의 HP를 0으로
      if (entry.action === 'death') {
        if (entry.actor === unit1Name) {
          unit1Hp = 0;
        } else if (entry.actor === unit2Name) {
          unit2Hp = 0;
        }
        timeline.push({ time: entry.time, unit1Hp, unit2Hp });
      }
      // 데미지로 HP 감소
      else if (entry.remainingHp !== undefined && entry.target) {
        if (entry.target === unit1Name) {
          unit1Hp = entry.remainingHp;
        } else if (entry.target === unit2Name) {
          unit2Hp = entry.remainingHp;
        }
        timeline.push({ time: entry.time, unit1Hp: Math.max(0, unit1Hp), unit2Hp: Math.max(0, unit2Hp) });
      }
      // 힐/부활로 HP 변경 (actor 기준)
      else if (entry.remainingHp !== undefined && (entry.action === 'heal' || entry.action === 'hot_tick' || entry.action === 'revive')) {
        if (entry.actor === unit1Name) {
          unit1Hp = entry.remainingHp;
        } else if (entry.actor === unit2Name) {
          unit2Hp = entry.remainingHp;
        }
        timeline.push({ time: entry.time, unit1Hp: Math.max(0, unit1Hp), unit2Hp: Math.max(0, unit2Hp) });
      }
    }

    return timeline;
  }, [log, unit1Name, unit2Name, unit1MaxHp, unit2MaxHp]);

  // 스킬/특수 이벤트 추출
  const skillEvents = useMemo(() => {
    return log.filter(entry =>
      entry.action === 'skill' ||
      entry.action === 'heal' ||
      entry.action === 'invincible' ||
      entry.action === 'revive'
    ).map(entry => {
      let hp = 0;
      let maxHp = 0;
      if (entry.actor === unit1Name) {
        maxHp = unit1MaxHp;
        const point = hpTimeline.find(p => p.time >= entry.time) || hpTimeline[hpTimeline.length - 1];
        hp = point?.unit1Hp ?? unit1MaxHp;
      } else {
        maxHp = unit2MaxHp;
        const point = hpTimeline.find(p => p.time >= entry.time) || hpTimeline[hpTimeline.length - 1];
        hp = point?.unit2Hp ?? unit2MaxHp;
      }
      return { ...entry, hp, maxHp };
    });
  }, [log, hpTimeline, unit1Name, unit2Name, unit1MaxHp, unit2MaxHp]);

  if (hpTimeline.length < 2) return null;

  const maxTime = Math.max(...hpTimeline.map(t => t.time));

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 1, 5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 1, 1));

  return (
    <>
      <div className="space-y-2">
        {/* 그래프 컨테이너 */}
        <div className="relative">
          <HpGraph
            hpTimeline={hpTimeline}
            skillEvents={skillEvents}
            maxTime={maxTime}
            unit1Name={unit1Name}
            unit2Name={unit2Name}
            unit1MaxHp={unit1MaxHp}
            unit2MaxHp={unit2MaxHp}
            hoveredPoint={hoveredPoint}
            setHoveredPoint={setHoveredPoint}
            containerRef={containerRef}
          />

          {/* 전체화면 버튼 */}
          <button
            onClick={() => {
              setIsModalOpen(true);
              setZoomLevel(1);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            title={t('fullscreen')}
          >
            <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>0s</span>
          <div className="flex gap-3 flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5" style={{ background: 'var(--primary-blue)' }} />
              {unit1Name}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5" style={{ background: 'var(--primary-red)' }} />
              {unit2Name}
            </span>
            {skillEvents.length > 0 && (
              <>
                <span className="flex items-center gap-0.5">
                  <Sword className="w-3 h-3" style={{ color: '#e5a440' }} />
                  <span className="text-xs">{t('skill')}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <Heart className="w-3 h-3" style={{ color: '#3db88a' }} />
                  <span className="text-xs">{t('heal')}</span>
                </span>
              </>
            )}
          </div>
          <span>{maxTime.toFixed(1)}s</span>
        </div>
      </div>

      {/* 전체화면 모달 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.8)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('hpTimeline')}
              </h3>
              <div className="flex items-center gap-2">
                {/* 줌 컨트롤 */}
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                    title={t('zoomOut')}
                  >
                    <ZoomOut className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <span className="text-sm px-2 min-w-[3rem] text-center" style={{ color: 'var(--text-secondary)' }}>
                    {zoomLevel}x
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 5}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                    title={t('zoomIn')}
                  >
                    <ZoomIn className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <HpGraph
                hpTimeline={hpTimeline}
                skillEvents={skillEvents}
                maxTime={maxTime}
                unit1Name={unit1Name}
                unit2Name={unit2Name}
                unit1MaxHp={unit1MaxHp}
                unit2MaxHp={unit2MaxHp}
                hoveredPoint={modalHoveredPoint}
                setHoveredPoint={setModalHoveredPoint}
                containerRef={modalContainerRef}
                height="h-96"
                zoomLevel={zoomLevel}
              />

              {/* 시간 축 라벨 */}
              <div className="flex justify-between text-sm mt-2 px-1" style={{ color: 'var(--text-secondary)' }}>
                <span>0s</span>
                <span>{(maxTime * 0.25).toFixed(1)}s</span>
                <span>{(maxTime * 0.5).toFixed(1)}s</span>
                <span>{(maxTime * 0.75).toFixed(1)}s</span>
                <span>{maxTime.toFixed(1)}s</span>
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-6 mt-4 pt-4 border-t flex-wrap" style={{ borderColor: 'var(--border-primary)' }}>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ background: 'var(--primary-blue)' }} />
                  <span style={{ color: 'var(--primary-blue)' }}>{unit1Name}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>(Max: {unit1MaxHp})</span>
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ background: 'var(--primary-red)' }} />
                  <span style={{ color: 'var(--primary-red)' }}>{unit2Name}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>(Max: {unit2MaxHp})</span>
                </span>
                {skillEvents.length > 0 && (
                  <>
                    <span className="flex items-center gap-1">
                      <Sword className="w-3 h-3" style={{ color: '#e5a440' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{t('skill')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" style={{ color: '#3db88a' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{t('heal')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" style={{ color: '#5a9cf5' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{t('invincibleLegend')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" style={{ color: '#a896f5' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{t('reviveLegend')}</span>
                    </span>
                  </>
                )}
              </div>

              {/* 줌 안내 */}
              {zoomLevel > 1 && (
                <div className="text-center text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {t('scrollHint')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
