'use client';

/**
 * Simulation Block — M2-4.
 *
 * 블록 노드: 문서 안에서 DPS Monte Carlo 돌리고 히스토그램.
 * dpsVarianceSimulator 재사용.
 *
 * Attrs: damage, attackSpeed, critRate, critDamage, iterations
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Swords, Play, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { simulateDPSVariance } from '@/lib/dpsVarianceSimulator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface SimAttrs {
  damage: number;
  attackSpeed: number;
  critRate: number;
  critDamage: number;
  iterations: number;
}

function SimulationView({ node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as SimAttrs;
  const [ranAt, setRanAt] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const result = useMemo(() => {
    try {
      return simulateDPSVariance({
        baseDamage: attrs.damage,
        attackSpeed: attrs.attackSpeed,
        critRate: attrs.critRate,
        critDamage: attrs.critDamage,
        iterations: Math.min(Math.max(100, attrs.iterations), 100000),
        duration: 10,
      });
    } catch {
      return null;
    }
    // ranAt 의존성 → "실행" 클릭 시 재계산 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrs.damage, attrs.attackSpeed, attrs.critRate, attrs.critDamage, attrs.iterations, ranAt]);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setRanAt(Date.now());
      setIsRunning(false);
    }, 30);
  };

  const histogram = useMemo(() => {
    if (!result) return [];
    return result.histogram.map((b) => ({
      bin: Math.round((b.min + b.max) / 2),
      count: b.count,
    }));
  }, [result]);

  return (
    <NodeViewWrapper>
      <div
        className="my-3 rounded-xl border"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          borderLeft: '3px solid #e11d48',
        }}
        contentEditable={false}
      >
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" style={{ color: '#e11d48' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              DPS Monte Carlo · {attrs.iterations.toLocaleString()}회
            </span>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] disabled:opacity-50"
            style={{ background: '#e11d48', color: 'white' }}
          >
            {isRunning ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            재실행
          </button>
        </div>

        {/* Input row */}
        <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <NumField label="DMG" value={attrs.damage} onChange={(v) => updateAttributes({ damage: v })} />
          <NumField label="SPD" value={attrs.attackSpeed} onChange={(v) => updateAttributes({ attackSpeed: v })} step={0.1} />
          <NumField label="Crit%" value={attrs.critRate} onChange={(v) => updateAttributes({ critRate: v })} step={0.01} />
          <NumField label="CritX" value={attrs.critDamage} onChange={(v) => updateAttributes({ critDamage: v })} step={0.1} />
          <NumField label="반복" value={attrs.iterations} onChange={(v) => updateAttributes({ iterations: v })} step={100} />
        </div>

        {result ? (
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="평균 DPS" value={result.mean.toFixed(1)} color="#e11d48" />
              <Stat label="표준편차" value={result.stdDev.toFixed(1)} />
              <Stat label="P5" value={result.percentiles.p5.toFixed(1)} />
              <Stat label="P95" value={result.percentiles.p95.toFixed(1)} />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
                <XAxis dataKey="bin" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#e11d48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-3 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
            시뮬 준비 중
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function NumField({
  label, value, onChange, step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>
      {label}
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-0.5 px-2 py-1 text-xs rounded border bg-transparent font-mono"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      />
    </label>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div className="text-sm font-bold font-mono" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

export const SimulationBlock = Node.create({
  name: 'simulationBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      damage: { default: 100 },
      attackSpeed: { default: 1 },
      critRate: { default: 0.2 },
      critDamage: { default: 2 },
      iterations: { default: 1000 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-sim-block]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            damage: Number(el.getAttribute('data-dmg')) || 100,
            attackSpeed: Number(el.getAttribute('data-spd')) || 1,
            critRate: Number(el.getAttribute('data-crit')) || 0.2,
            critDamage: Number(el.getAttribute('data-critx')) || 2,
            iterations: Number(el.getAttribute('data-iter')) || 1000,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-sim-block': 'true',
        'data-dmg': String(node.attrs.damage),
        'data-spd': String(node.attrs.attackSpeed),
        'data-crit': String(node.attrs.critRate),
        'data-critx': String(node.attrs.critDamage),
        'data-iter': String(node.attrs.iterations),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SimulationView);
  },
});

export default SimulationBlock;
