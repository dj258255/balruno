'use client';

/**
 * 수식 검증기 패널 — 실측 데이터 vs 가정 수식 회귀 + 이상치 탐지.
 *
 * Workflow:
 *  1. x, y 데이터 입력 (CSV paste or 직접 편집)
 *  2. 수식 선택 (linear / power / exp / log / poly)
 *  3. 파라미터 수정 or "자동 피팅"
 *  4. R² / RMSE / 이상치 리포트
 */

import { useState, useMemo } from 'react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Sigma, Plus, Trash2, Sparkles, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  verifyFormula,
  fitFormula,
  FORMULA_PRESETS,
  type DataPoint,
  type FormulaSpec,
} from '@/lib/formulaVerifier';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

// 샘플 데이터 — RPG 레벨별 필요 XP (임의 값, 약간 노이즈)
const SAMPLE_DATA: DataPoint[] = [
  { x: 1, y: 100, label: 'Lv 1' },
  { x: 2, y: 260, label: 'Lv 2' },
  { x: 3, y: 500, label: 'Lv 3' },
  { x: 4, y: 820, label: 'Lv 4' },
  { x: 5, y: 1250, label: 'Lv 5' },
  { x: 6, y: 1800, label: 'Lv 6' },
  { x: 7, y: 2400, label: 'Lv 7' },
  { x: 8, y: 3100, label: 'Lv 8' },
  { x: 9, y: 3900, label: 'Lv 9' },
  { x: 10, y: 4800, label: 'Lv 10' },
];

export default function FormulaVerifierPanel({ onClose }: Props) {
  const t = useTranslations();
  const [data, setData] = useState<DataPoint[]>(SAMPLE_DATA);
  const [formulaId, setFormulaId] = useState(FORMULA_PRESETS[1].id); // power
  const [params, setParams] = useState<number[]>(FORMULA_PRESETS[1].params);

  const baseFormula = useMemo(
    () => FORMULA_PRESETS.find((f) => f.id === formulaId) ?? FORMULA_PRESETS[0],
    [formulaId],
  );
  const formula: FormulaSpec = { ...baseFormula, params };

  const result = useMemo(() => verifyFormula(data, formula), [data, formula]);

  // 예측 곡선
  const curveData = useMemo(() => {
    if (data.length === 0) return [];
    const xs = data.map((d) => d.x).sort((a, b) => a - b);
    const min = xs[0];
    const max = xs[xs.length - 1];
    const step = (max - min) / 40;
    const points: { x: number; predicted: number }[] = [];
    for (let x = min; x <= max; x += step) {
      points.push({ x: Math.round(x * 100) / 100, predicted: formula.fn(x, formula.params) });
    }
    return points;
  }, [data, formula]);

  const combinedChart = useMemo(() => {
    return curveData.map((cp) => {
      const obs = data.find((d) => Math.abs(d.x - cp.x) < 0.5);
      return {
        x: cp.x,
        predicted: cp.predicted,
        observed: obs?.y,
      };
    });
  }, [curveData, data]);

  const handleAutoFit = () => {
    const fit = fitFormula(data, formula, 12);
    setParams(fit.params);
  };

  const handleFormulaChange = (id: string) => {
    const f = FORMULA_PRESETS.find((x) => x.id === id);
    if (f) {
      setFormulaId(id);
      setParams([...f.params]);
    }
  };

  const addPoint = () => {
    const lastX = data[data.length - 1]?.x ?? 0;
    setData([...data, { x: lastX + 1, y: 0 }]);
  };
  const removePoint = (idx: number) => setData(data.filter((_, i) => i !== idx));
  const updatePoint = (idx: number, key: 'x' | 'y' | 'label', value: string) => {
    setData(data.map((p, i) => {
      if (i !== idx) return p;
      if (key === 'label') return { ...p, label: value };
      return { ...p, [key]: parseFloat(value) || 0 };
    }));
  };

  const pasteCsv = (text: string) => {
    const lines = text.trim().split('\n');
    const points: DataPoint[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t,]/).map((s) => s.trim());
      if (parts.length < 2) continue;
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (isNaN(x) || isNaN(y)) continue;
      points.push({ x, y, label: parts[2] });
    }
    if (points.length > 0) setData(points);
  };

  const r2Color = result.r2 >= 0.95 ? '#10b981' : result.r2 >= 0.8 ? '#f59e0b' : '#ef4444';

  return (
    <PanelShell
      title={t('formulaVerifier.titleHeader')}
      subtitle={t('formulaVerifier.subtitleHeader')}
      icon={Sigma}
      iconColor="#3b82f6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 수식 선택 + 파라미터 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <select
            value={formulaId}
            onChange={(e) => handleFormulaChange(e.target.value)}
            className="input-compact"
          >
            {FORMULA_PRESETS.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <span className="text-label font-mono" style={{ color: 'var(--text-primary)' }}>
            {baseFormula.expression}
          </span>
          <button
            onClick={handleAutoFit}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-label font-semibold ml-auto"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Sparkles className="w-3.5 h-3.5" /> {t('formulaVerifier.autoFit')}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('formulaVerifier.paramLabel')}</span>
          {params.map((p, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-caption font-mono" style={{ color: 'var(--text-secondary)' }}>
                {String.fromCharCode(97 + idx)}
              </span>
              <input
                type="number"
                step="0.01"
                value={p}
                onChange={(e) => setParams(params.map((v, i) => (i === idx ? parseFloat(e.target.value) || 0 : v)))}
                className="input-compact hide-spinner w-20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat
          label={t('formulaVerifier.r2Label')}
          value={result.r2.toFixed(4)}
          sub={result.r2 >= 0.95 ? t('formulaVerifier.r2Perfect') : result.r2 >= 0.8 ? t('formulaVerifier.r2Good') : t('formulaVerifier.r2Need')}
          color={r2Color}
          icon={result.r2 >= 0.8 ? CheckCircle : AlertCircle}
        />
        <Stat label="RMSE" value={result.rmse.toFixed(2)} sub={t('formulaVerifier.rmseSub')} color="#3b82f6" icon={Sigma} />
        <Stat label="MAE" value={result.mae.toFixed(2)} sub={t('formulaVerifier.maeSub')} color="#8b5cf6" icon={Sigma} />
        <Stat
          label={t('formulaVerifier.outlierLabel')}
          value={`${result.outlierCount}/${data.length}`}
          sub={t('formulaVerifier.outlierSub')}
          color={result.outlierCount > 0 ? '#ef4444' : '#10b981'}
          icon={AlertCircle}
        />
      </div>

      {/* 차트 — 예측 곡선 + 실측 점 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('formulaVerifier.predictedVsObserved')}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={combinedChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="x" type="number" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={2} name={t('formulaVerifier.predictedLine')} dot={false} />
              <Line type="monotone" dataKey="observed" stroke="#ef4444" strokeWidth={0} name={t('formulaVerifier.observedLine')} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 잔차 플롯 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('formulaVerifier.residualPlot')}
        </div>
        <div className="h-40">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="x" type="number" tick={{ fontSize: 10 }} name="x" />
              <YAxis dataKey="residual" type="number" tick={{ fontSize: 10 }} name={t('formulaVerifier.residualAxis')} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
              <Scatter
                name={t('formulaVerifier.normalLabel')}
                data={result.residuals.filter((r) => !r.isOutlier)}
                fill="#3b82f6"
              />
              <Scatter
                name={t('formulaVerifier.outlierMark')}
                data={result.residuals.filter((r) => r.isOutlier)}
                fill="#ef4444"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 잔차 테이블 (이상치만) */}
      {result.outlierCount > 0 && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid #ef4444' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
            <span className="text-label font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('formulaVerifier.outlierExplain', { n: result.outlierCount })}
            </span>
          </div>
          <table className="w-full text-caption">
            <thead>
              <tr style={{ color: 'var(--text-tertiary)' }}>
                <th className="text-left px-2">x</th>
                <th className="text-left px-2">{t('formulaVerifier.colLabel')}</th>
                <th className="text-right px-2">{t('formulaVerifier.colObserved')}</th>
                <th className="text-right px-2">{t('formulaVerifier.colPredicted')}</th>
                <th className="text-right px-2">{t('formulaVerifier.colResidual')}</th>
                <th className="text-right px-2">%</th>
              </tr>
            </thead>
            <tbody>
              {result.residuals.filter((r) => r.isOutlier).map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-primary)' }}>
                  <td className="px-2 py-0.5 tabular-nums">{r.x}</td>
                  <td className="px-2 py-0.5">{r.label ?? '—'}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{r.yObserved.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{r.yPredicted.toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums font-semibold" style={{ color: '#ef4444' }}>
                    {r.residual > 0 ? '+' : ''}{r.residual.toFixed(2)}
                  </td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{r.residualPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 데이터 편집 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('formulaVerifier.dataCount', { n: data.length })}
          </span>
          <div className="flex gap-1">
            <label className="inline-flex items-center gap-1 px-2 py-1 rounded text-caption cursor-pointer" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              <Upload className="w-3 h-3" /> {t('formulaVerifier.csvPaste')}
              <textarea
                className="hidden"
                onPaste={(e) => pasteCsv(e.clipboardData.getData('text'))}
                onBlur={(e) => { if (e.target.value) pasteCsv(e.target.value); }}
              />
            </label>
            <button onClick={addPoint} className="inline-flex items-center gap-1 px-2 py-1 rounded text-caption" style={{ background: 'var(--accent)', color: 'white' }}>
              <Plus className="w-3 h-3" /> {t('formulaVerifier.addRow')}
            </button>
          </div>
        </div>
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {data.map((p, idx) => {
            const resp = result.residuals.find((r) => r.x === p.x);
            return (
              <div
                key={idx}
                className="flex items-center gap-1.5 p-1 rounded"
                style={{ background: resp?.isOutlier ? '#ef444420' : 'var(--bg-primary)' }}
              >
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>x</label>
                <input
                  type="number"
                  value={p.x}
                  onChange={(e) => updatePoint(idx, 'x', e.target.value)}
                  className="input-compact hide-spinner w-16"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>y</label>
                <input
                  type="number"
                  value={p.y}
                  onChange={(e) => updatePoint(idx, 'y', e.target.value)}
                  className="input-compact hide-spinner w-20"
                />
                <input
                  value={p.label ?? ''}
                  onChange={(e) => updatePoint(idx, 'label', e.target.value)}
                  placeholder={t('formulaVerifier.labelPlaceholder')}
                  className="input-compact flex-1 min-w-0"
                />
                {resp && (
                  <span className="text-caption font-mono tabular-nums w-14 text-right" style={{ color: resp.isOutlier ? '#ef4444' : 'var(--text-tertiary)' }}>
                    {resp.residual > 0 ? '+' : ''}{resp.residual.toFixed(1)}
                  </span>
                )}
                <button onClick={() => removePoint(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('formulaVerifier.r2Note')}
      </p>
    </PanelShell>
  );
}

function Stat({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: typeof Sigma }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="flex items-center gap-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-heading font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
