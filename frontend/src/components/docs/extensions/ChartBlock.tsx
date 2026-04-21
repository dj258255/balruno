'use client';

/**
 * Chart Block — M2-2.
 *
 * 블록 노드: 시트의 X/Y 컬럼을 live line chart 로.
 * 수식 변경 시 자동 반영.
 *
 * Syntax:
 *   <div data-chart data-sheet="..." data-x="..." data-y="..."></div>
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { BarChart3, Settings } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { computeSheetRows } from '@/lib/formulaEngine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export interface ChartBlockAttrs {
  projectId: string;
  sheetId: string;
  xColumnName: string;
  yColumnName: string;
  chartType: 'line' | 'bar';
  title?: string;
}

function ChartView({ node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as ChartBlockAttrs;
  const project = useProjectStore((s) => s.projects.find((p) => p.id === attrs.projectId));
  const [showSettings, setShowSettings] = useState(false);

  const { data, xKey, yKey, sheetName, valid } = useMemo(() => {
    if (!project) return { data: [], xKey: '', yKey: '', sheetName: '', valid: false };
    const sheet = project.sheets.find((s) => s.id === attrs.sheetId);
    if (!sheet) return { data: [], xKey: '', yKey: '', sheetName: '', valid: false };

    const computed = computeSheetRows(sheet, project.sheets);
    const rows = computed.map((r) => ({
      [attrs.xColumnName]: Number(r[attrs.xColumnName]) || 0,
      [attrs.yColumnName]: Number(r[attrs.yColumnName]) || 0,
    }));

    return {
      data: rows,
      xKey: attrs.xColumnName,
      yKey: attrs.yColumnName,
      sheetName: sheet.name,
      valid: true,
    };
  }, [project, attrs.sheetId, attrs.xColumnName, attrs.yColumnName]);

  const sheet = project?.sheets.find((s) => s.id === attrs.sheetId);
  const availableCols = sheet?.columns.filter((c) => c.type === 'general' || c.type === 'formula') ?? [];

  return (
    <NodeViewWrapper>
      <div
        className="my-3 rounded-xl border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
        contentEditable={false}
      >
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {attrs.title || `${sheetName} — ${attrs.xColumnName} × ${attrs.yColumnName}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
            title="차트 설정"
          >
            <Settings className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {showSettings && sheet && (
          <div
            className="p-3 space-y-2 border-b"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                차트 타입
                <select
                  value={attrs.chartType}
                  onChange={(e) => updateAttributes({ chartType: e.target.value as 'line' | 'bar' })}
                  className="w-full mt-1 px-2 py-1 text-xs rounded border bg-transparent"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                X 컬럼
                <select
                  value={attrs.xColumnName}
                  onChange={(e) => updateAttributes({ xColumnName: e.target.value })}
                  className="w-full mt-1 px-2 py-1 text-xs rounded border bg-transparent"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  {availableCols.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Y 컬럼
                <select
                  value={attrs.yColumnName}
                  onChange={(e) => updateAttributes({ yColumnName: e.target.value })}
                  className="w-full mt-1 px-2 py-1 text-xs rounded border bg-transparent"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  {availableCols.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="p-3">
          {!valid || data.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              데이터 없음 · 설정 확인 필요
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              {attrs.chartType === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
                  <XAxis dataKey={xKey} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey={yKey} fill="#3b82f6" />
                </BarChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
                  <XAxis dataKey={xKey} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const ChartBlock = Node.create({
  name: 'chartBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      projectId: { default: '' },
      sheetId: { default: '' },
      xColumnName: { default: '' },
      yColumnName: { default: '' },
      chartType: { default: 'line' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-chart-block]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            projectId: el.getAttribute('data-project') || '',
            sheetId: el.getAttribute('data-sheet') || '',
            xColumnName: el.getAttribute('data-x') || '',
            yColumnName: el.getAttribute('data-y') || '',
            chartType: (el.getAttribute('data-chart-type') as 'line' | 'bar') || 'line',
            title: el.getAttribute('data-title') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-chart-block': 'true',
        'data-project': node.attrs.projectId,
        'data-sheet': node.attrs.sheetId,
        'data-x': node.attrs.xColumnName,
        'data-y': node.attrs.yColumnName,
        'data-chart-type': node.attrs.chartType,
        'data-title': node.attrs.title,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartView);
  },
});

export default ChartBlock;
