'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, MousePointer, PenTool, Copy, Check, Download, RotateCcw, TrendingUp, Maximize2, X, History, ChevronDown, Settings } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import CustomSelect from '@/components/ui/CustomSelect';
import Checkbox from '@/components/ui/Checkbox';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { cn } from '@/lib/utils';

function removeTokenBackgrounds(style: Record<string, React.CSSProperties>): Record<string, React.CSSProperties> {
  const newStyle: Record<string, React.CSSProperties> = {};
  for (const [key, value] of Object.entries(style)) {
    newStyle[key] = { ...value, background: 'transparent', backgroundColor: 'transparent' };
  }
  return newStyle;
}

import {
  Point,
  FitResult,
  CurveType,
  fitAllCurves,
  generateFormulaCode
} from '@/lib/curveFitting';

interface CurveFittingPanelProps {
  onClose?: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

type DrawMode = 'point' | 'draw';
type CodeLanguage = 'typescript' | 'csharp' | 'python';

const PANEL_COLOR = '#9179f2'; // 소프트 퍼플

const CURVE_COLORS: Record<CurveType, string> = {
  linear: '#5a9cf5',
  quadratic: '#9179f2',
  cubic: '#e87aa8',
  power: '#e5a440',
  exponential: '#3db88a',
  logarithmic: '#4fc4d4',
  sigmoid: '#e86161'
};

const CURVE_NAMES: Record<CurveType, string> = {
  linear: 'Linear',
  quadratic: 'Quadratic',
  cubic: 'Cubic',
  power: 'Power',
  exponential: 'Exponential',
  logarithmic: 'Logarithmic',
  sigmoid: 'Sigmoid'
};

export default function CurveFittingPanel({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: CurveFittingPanelProps) {
  const t = useTranslations('curveFitting');
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('point');
  const [fitResults, setFitResults] = useState<FitResult[]>([]);
  const [selectedFit, setSelectedFit] = useState<FitResult | null>(null);
  const [showAllCurves, setShowAllCurves] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('typescript');
  const [isDrawing, setIsDrawing] = useState(false);

  const [xRange, setXRange] = useState({ min: 0, max: 100 });
  const [yRange, setYRange] = useState({ min: 0, max: 100 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreenCanvas, setFullscreenCanvas] = useState(false);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  const [history, setHistory] = useState<{ points: Point[]; timestamp: Date }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  const saveToHistory = useCallback((newPoints: Point[]) => {
    setHistory(prev => {
      const lastEntry = prev[prev.length - 1];
      if (lastEntry && lastEntry.points.length === newPoints.length && Date.now() - lastEntry.timestamp.getTime() < 100) {
        return prev;
      }
      const newHistory = [...prev, { points: [...newPoints], timestamp: new Date() }];
      if (newHistory.length > 50) {
        return newHistory.slice(-50);
      }
      return newHistory;
    });
    setHistoryIndex(-1);
  }, []);

  const restoreFromHistory = (index: number) => {
    if (index >= 0 && index < history.length) {
      setPoints([...history[index].points]);
      setHistoryIndex(index);
      setShowHistory(false);
    }
  };

  const deleteFromHistory = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter((_, i) => i !== index));
    if (historyIndex === index) setHistoryIndex(-1);
    else if (historyIndex > index) setHistoryIndex(historyIndex - 1);
  };

  const canvasToData = useCallback((canvasX: number, canvasY: number, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    const padding = 40;
    const plotWidth = rect.width - padding * 2;
    const plotHeight = rect.height - padding * 2;
    const x = ((canvasX - padding) / plotWidth) * (xRange.max - xRange.min) + xRange.min;
    const y = ((plotHeight - (canvasY - padding)) / plotHeight) * (yRange.max - yRange.min) + yRange.min;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }, [xRange, yRange]);

  const dataToCanvas = useCallback((point: Point, canvas: HTMLCanvasElement): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const padding = 40;
    const plotWidth = rect.width - padding * 2;
    const plotHeight = rect.height - padding * 2;
    const x = padding + ((point.x - xRange.min) / (xRange.max - xRange.min)) * plotWidth;
    const y = padding + plotHeight - ((point.y - yRange.min) / (yRange.max - yRange.min)) * plotHeight;
    return { x, y };
  }, [xRange, yRange]);

  const isDark = theme === 'dark';
  const colors = {
    background: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    axisLabel: isDark ? '#94a3b8' : '#64748b',
    point: isDark ? '#f1f5f9' : '#1e293b',
    pointStroke: PANEL_COLOR,
  };

  const drawOnCanvas = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const padding = 40;
    const plotWidth = rect.width - padding * 2;
    const plotHeight = rect.height - padding * 2;

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + plotHeight);
      ctx.stroke();
    }

    for (let i = 0; i <= 10; i++) {
      const y = padding + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = colors.axisLabel;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 10; i += 2) {
      const x = padding + (i / 10) * plotWidth;
      const value = xRange.min + (i / 10) * (xRange.max - xRange.min);
      ctx.fillText(value.toFixed(0), x, rect.height - 10);
    }

    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i += 2) {
      const y = padding + (i / 10) * plotHeight;
      const value = yRange.max - (i / 10) * (yRange.max - yRange.min);
      ctx.fillText(value.toFixed(0), padding - 5, y + 4);
    }

    const curvesToDraw = showAllCurves ? fitResults : (selectedFit ? [selectedFit] : []);

    for (const fit of curvesToDraw) {
      ctx.strokeStyle = CURVE_COLORS[fit.type];
      ctx.lineWidth = selectedFit?.type === fit.type ? 3 : 2;
      ctx.beginPath();

      let firstPoint = true;
      for (let px = 0; px <= plotWidth; px += 2) {
        const dataX = xRange.min + (px / plotWidth) * (xRange.max - xRange.min);
        try {
          const dataY = fit.predict(dataX);
          if (isFinite(dataY) && dataY >= yRange.min && dataY <= yRange.max) {
            const canvasY = padding + plotHeight - ((dataY - yRange.min) / (yRange.max - yRange.min)) * plotHeight;
            if (firstPoint) {
              ctx.moveTo(padding + px, canvasY);
              firstPoint = false;
            } else {
              ctx.lineTo(padding + px, canvasY);
            }
          } else {
            firstPoint = true;
          }
        } catch {
          firstPoint = true;
        }
      }
      ctx.stroke();
    }

    for (const point of points) {
      const { x, y } = dataToCanvas(point, canvas);
      if (x >= padding && x <= rect.width - padding && y >= padding && y <= rect.height - padding) {
        ctx.fillStyle = colors.point;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.pointStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [points, fitResults, selectedFit, showAllCurves, xRange, yRange, dataToCanvas, colors]);

  const drawCanvas = useCallback(() => {
    if (canvasRef.current) drawOnCanvas(canvasRef.current);
  }, [drawOnCanvas]);

  const drawFullscreenCanvas = useCallback(() => {
    if (fullscreenCanvasRef.current) drawOnCanvas(fullscreenCanvasRef.current);
  }, [drawOnCanvas]);

  useEffect(() => {
    if (points.length >= 2) {
      const results = fitAllCurves(points);
      setFitResults(results);
      if (results.length > 0 && !selectedFit) setSelectedFit(results[0]);
    } else {
      setFitResults([]);
      setSelectedFit(null);
    }
  }, [points]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);
  useEffect(() => {
    if (fullscreenCanvas) setTimeout(drawFullscreenCanvas, 50);
  }, [fullscreenCanvas, drawFullscreenCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode !== 'point') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dataPoint = canvasToData(x, y, canvas);
    if (dataPoint.x >= xRange.min && dataPoint.x <= xRange.max && dataPoint.y >= yRange.min && dataPoint.y <= yRange.max) {
      setPoints(prev => {
        const newPoints = [...prev, dataPoint];
        saveToHistory(newPoints);
        return newPoints;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode === 'draw') {
      setIsDrawing(true);
      handleCanvasClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawMode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dataPoint = canvasToData(x, y, canvas);
    const lastPoint = points[points.length - 1];
    if (!lastPoint || Math.abs(dataPoint.x - lastPoint.x) > (xRange.max - xRange.min) / 50) {
      if (dataPoint.x >= xRange.min && dataPoint.x <= xRange.max && dataPoint.y >= yRange.min && dataPoint.y <= yRange.max) {
        setPoints(prev => [...prev, dataPoint]);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && points.length > 0) saveToHistory(points);
    setIsDrawing(false);
  };

  const handleCopyCode = async () => {
    if (!selectedFit) return;
    const code = generateFormulaCode(selectedFit, codeLanguage);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleExportCSV = () => {
    const csv = 'x,y\n' + points.map(p => `${p.x},${p.y}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curve_points.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setPoints([]);
    setFitResults([]);
    setSelectedFit(null);
  };

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  return (
    <PanelShell
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={PenTool}
      iconColor="#6366f1"
      onClose={onClose ?? (() => {})}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#6366f1" />}
    >
      <div className="p-4 space-y-5 overflow-y-auto overflow-x-hidden flex-1 scrollbar-slim">
        {/* Help Section */}
        {showHelp && (
          <div className="glass-card p-4 animate-slideDown space-y-4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpCurvesTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpDescription') || 'Draw or click to place data points, then analyze the best-fitting curve.'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(CURVE_COLORS).slice(0, 4).map(([key, color]) => (
                <div key={key} className="glass-section p-2" style={{ borderLeft: `3px solid ${color}` }}>
                  <span className="font-medium text-sm" style={{ color }}>{t(`curves.${key}`)}</span>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t(`curves.${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="glass-card p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode Toggle */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
              <button
                className={cn('px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all', drawMode === 'point' && 'shadow-sm')}
                style={{
                  background: drawMode === 'point' ? PANEL_COLOR : 'transparent',
                  color: drawMode === 'point' ? 'white' : 'var(--text-secondary)'
                }}
                onClick={() => setDrawMode('point')}
              >
                <MousePointer size={14} />
                {t('pointMode')}
              </button>
              <button
                className={cn('px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all', drawMode === 'draw' && 'shadow-sm')}
                style={{
                  background: drawMode === 'draw' ? PANEL_COLOR : 'transparent',
                  color: drawMode === 'draw' ? 'white' : 'var(--text-secondary)'
                }}
                onClick={() => setDrawMode('draw')}
              >
                <PenTool size={14} />
                {t('drawMode')}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Tooltip content={t('undo')}>
                <button className="glass-button !p-2" onClick={handleUndo} disabled={points.length === 0}>
                  <RotateCcw size={16} className={points.length === 0 ? 'opacity-50' : ''} />
                </button>
              </Tooltip>

              {/* History Dropdown */}
              <div className="relative" ref={historyRef}>
                <Tooltip content={t('history')}>
                  <button
                    className="glass-button !p-2 flex items-center gap-0.5"
                    onClick={() => setShowHistory(!showHistory)}
                    disabled={history.length === 0}
                  >
                    <History size={16} className={history.length === 0 ? 'opacity-50' : ''} />
                    <ChevronDown size={12} className={history.length === 0 ? 'opacity-50' : ''} />
                  </button>
                </Tooltip>

                {showHistory && history.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 glass-panel z-50 min-w-[200px] overflow-hidden">
                    <div className="max-h-[250px] overflow-y-auto py-1">
                      {history.slice().reverse().map((entry, idx) => {
                        const actualIndex = history.length - 1 - idx;
                        const isSelected = actualIndex === historyIndex;
                        return (
                          <div key={actualIndex} className="flex items-center group hover:bg-black/5 dark:hover:bg-white/5">
                            <button
                              className="flex-1 px-3 py-1.5 text-left text-sm flex items-center justify-between gap-2"
                              style={{ color: isSelected ? PANEL_COLOR : 'var(--text-secondary)' }}
                              onClick={() => restoreFromHistory(actualIndex)}
                            >
                              <span>{entry.points.length} {t('points')}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </button>
                            <button
                              className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => deleteFromHistory(actualIndex, e)}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t px-3 py-1.5" style={{ borderColor: 'var(--border-primary)' }}>
                      <button
                        className="w-full text-sm py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        style={{ color: '#e86161' }}
                        onClick={() => { setHistory([]); setHistoryIndex(-1); setShowHistory(false); }}
                      >
                        {t('clearHistory')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Tooltip content={t('clear')}>
                <button className="glass-button !p-2" onClick={handleClear}>
                  <Trash2 size={16} />
                </button>
              </Tooltip>

              <Tooltip content={t('exportCSV')}>
                <button className="glass-button !p-2" onClick={handleExportCSV} disabled={points.length === 0}>
                  <Download size={16} className={points.length === 0 ? 'opacity-50' : ''} />
                </button>
              </Tooltip>
            </div>

            <div className="ml-auto glass-badge">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('points')}: {points.length}</span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="glass-card relative group min-h-[300px]">
          <canvas
            ref={canvasRef}
            className="w-full h-[300px] cursor-crosshair rounded-xl"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          <button
            onClick={() => setFullscreenCanvas(true)}
            className="absolute top-3 right-3 glass-button !p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            title={t('fullscreen') || 'Fullscreen'}
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Axis Range Controls */}
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('axisRange') || 'Axis Range'}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-secondary)' }}>X:</span>
              <input
                type="text"
                inputMode="decimal"
                value={xRange.min}
                onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setXRange(prev => ({ ...prev, min: val })); }}
                className="glass-input w-16 text-center text-sm"
              />
              <span style={{ color: 'var(--text-secondary)' }}>-</span>
              <input
                type="text"
                inputMode="decimal"
                value={xRange.max}
                onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setXRange(prev => ({ ...prev, max: val })); }}
                className="glass-input w-16 text-center text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-secondary)' }}>Y:</span>
              <input
                type="text"
                inputMode="decimal"
                value={yRange.min}
                onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setYRange(prev => ({ ...prev, min: val })); }}
                className="glass-input w-16 text-center text-sm"
              />
              <span style={{ color: 'var(--text-secondary)' }}>-</span>
              <input
                type="text"
                inputMode="decimal"
                value={yRange.max}
                onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setYRange(prev => ({ ...prev, max: val })); }}
                className="glass-input w-16 text-center text-sm"
              />
            </div>
          </div>
        </div>

        {/* Fit Results */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('fittedCurves')}</span>
            <label className="flex items-center gap-1.5 text-sm ml-auto cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
              <Checkbox
                checked={showAllCurves}
                onChange={(e) => setShowAllCurves(e.target.checked)}
              />
              {t('showAll')}
            </label>
          </div>

          {fitResults.length === 0 ? (
            <div className="glass-section text-center py-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('addPointsHint')}</p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-slim">
              {fitResults.map((fit, index) => {
                const color = CURVE_COLORS[fit.type];
                const isSelected = selectedFit?.type === fit.type;
                return (
                  <button
                    key={fit.type}
                    className={cn('shrink-0 glass-section p-3 text-left transition-all min-w-[150px]', isSelected && 'shadow-sm')}
                    style={{ borderLeft: `3px solid ${color}`, background: isSelected ? `${color}10` : undefined }}
                    onClick={() => setSelectedFit(fit)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold" style={{ color }}>{CURVE_NAMES[fit.type]}</span>
                      {index === 0 && (
                        <span className="text-sm px-1.5 py-0.5 rounded-lg ml-auto" style={{ background: '#3db88a', color: 'white' }}>
                          {t('bestFit')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{fit.equation}</div>
                    <div className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>R² = {(fit.rSquared * 100).toFixed(2)}%</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Code Export */}
        {selectedFit && (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('formulaCode')}</h4>
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={codeLanguage}
                  onChange={(v) => setCodeLanguage(v as CodeLanguage)}
                  options={[
                    { value: 'typescript', label: 'TypeScript' },
                    { value: 'csharp', label: 'C#' },
                    { value: 'python', label: 'Python' },
                  ]}
                  color={PANEL_COLOR}
                  size="sm"
                />
                <button
                  className="glass-button-primary !px-3 !py-1.5 text-sm flex items-center gap-1.5"
                  onClick={handleCopyCode}
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode ? t('copied') : t('copyCode')}
                </button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
              <SyntaxHighlighter
                language={codeLanguage === 'csharp' ? 'csharp' : codeLanguage}
                style={removeTokenBackgrounds(isDark ? oneDark : oneLight)}
                customStyle={{ margin: 0, padding: '0.75rem', fontSize: '12px', background: 'var(--bg-tertiary)' }}
                wrapLongLines
              >
                {generateFormulaCode(selectedFit, codeLanguage)}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenCanvas && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setFullscreenCanvas(false)}
        >
          <div className="glass-panel w-full max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="glass-panel-header">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
                >
                  <TrendingUp className="w-4.5 h-4.5 text-white" />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('curveFitting') || 'Curve Fitting'}</h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Mode Toggle */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  <button
                    className={cn('px-2 py-1 rounded-lg text-sm flex items-center gap-1 transition-all')}
                    style={{
                      background: drawMode === 'point' ? PANEL_COLOR : 'transparent',
                      color: drawMode === 'point' ? 'white' : 'var(--text-secondary)'
                    }}
                    onClick={() => setDrawMode('point')}
                  >
                    <MousePointer size={12} />
                  </button>
                  <button
                    className={cn('px-2 py-1 rounded-lg text-sm flex items-center gap-1 transition-all')}
                    style={{
                      background: drawMode === 'draw' ? PANEL_COLOR : 'transparent',
                      color: drawMode === 'draw' ? 'white' : 'var(--text-secondary)'
                    }}
                    onClick={() => setDrawMode('draw')}
                  >
                    <PenTool size={12} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button className="glass-button !p-1.5" onClick={handleUndo} disabled={points.length === 0}>
                    <RotateCcw size={14} className={points.length === 0 ? 'opacity-50' : ''} />
                  </button>
                  <button className="glass-button !p-1.5" onClick={handleClear}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{points.length} pts</span>

                <button onClick={() => setFullscreenCanvas(false)} className="glass-button !p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 min-h-0">
              <canvas
                ref={fullscreenCanvasRef}
                className="w-full h-full rounded-xl cursor-crosshair"
                onClick={(e) => {
                  if (drawMode === 'point' && fullscreenCanvasRef.current) {
                    const rect = fullscreenCanvasRef.current.getBoundingClientRect();
                    const point = canvasToData(e.clientX - rect.left, e.clientY - rect.top, fullscreenCanvasRef.current);
                    if (point.x >= xRange.min && point.x <= xRange.max && point.y >= yRange.min && point.y <= yRange.max) {
                      setPoints(prev => [...prev, point]);
                    }
                  }
                }}
                onMouseDown={() => { if (drawMode === 'draw') setIsDrawing(true); }}
                onMouseMove={(e) => {
                  if (isDrawing && drawMode === 'draw' && fullscreenCanvasRef.current) {
                    const rect = fullscreenCanvasRef.current.getBoundingClientRect();
                    const point = canvasToData(e.clientX - rect.left, e.clientY - rect.top, fullscreenCanvasRef.current);
                    if (point.x >= xRange.min && point.x <= xRange.max && point.y >= yRange.min && point.y <= yRange.max) {
                      setPoints(prev => {
                        if (prev.length === 0) return [point];
                        const last = prev[prev.length - 1];
                        const dist = Math.sqrt(Math.pow(point.x - last.x, 2) + Math.pow(point.y - last.y, 2));
                        if (dist > 2) return [...prev, point];
                        return prev;
                      });
                    }
                  }
                }}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
              />
            </div>

            <div className="px-6 pb-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--text-secondary)' }}>X:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={xRange.min}
                  onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setXRange(prev => ({ ...prev, min: val })); }}
                  className="glass-input w-16 text-center text-sm"
                />
                <span>-</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={xRange.max}
                  onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setXRange(prev => ({ ...prev, max: val })); }}
                  className="glass-input w-16 text-center text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--text-secondary)' }}>Y:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={yRange.min}
                  onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setYRange(prev => ({ ...prev, min: val })); }}
                  className="glass-input w-16 text-center text-sm"
                />
                <span>-</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={yRange.max}
                  onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) setYRange(prev => ({ ...prev, max: val })); }}
                  className="glass-input w-16 text-center text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
