'use client';

/**
 * Track 11 MVP — AI 요구사항 → 초기 밸런스 시트 추천 UI.
 *
 * 자연어 요구사항 + 장르 선택 → /api/ai/recommend 호출 → 시트 자동 생성
 * LLM 없을 시 템플릿 fallback.
 */

import { useState } from 'react';
import { X, Sparkles, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CustomSelect from '@/components/ui/CustomSelect';

interface RecommendedColumn {
  name: string;
  type: string;
  formula?: string;
}

interface RecommendedSheet {
  name: string;
  columns: RecommendedColumn[];
  sampleRows?: Record<string, string | number>[];
}

interface AISetupModalProps {
  onClose: () => void;
}

export default function AISetupModal({ onClose }: AISetupModalProps) {
  const t = useTranslations();
  useEscapeKey(onClose);

  const createProject = useProjectStore((s) => s.createProject);
  const createSheet = useProjectStore((s) => s.createSheet);
  const addColumn = useProjectStore((s) => s.addColumn);

  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState<'balancing' | 'pm' | 'design-doc'>('balancing');
  const [genre, setGenre] = useState('rpg');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecommendedSheet[] | null>(null);
  const [mode, setMode] = useState<'llm' | 'template-fallback'>('template-fallback');
  const [note, setNote] = useState<string>('');

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('요구사항을 입력해주세요');
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, genre, workType }),
      });
      if (!res.ok) {
        setError(`요청 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      setPreview(data.sheets);
      setMode(data.mode);
      setNote(data.note);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const name = projectName.trim() || `AI 생성: ${description.slice(0, 20)}`;
    const projectId = createProject(name, description);
    for (const s of preview) {
      const sheetId = createSheet(projectId, s.name);
      for (const col of s.columns) {
        addColumn(projectId, sheetId, {
          name: col.name,
          type: col.type as 'general' | 'formula',
          formula: col.formula,
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-4">
      <div
        className="w-full max-w-2xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        style={{ background: 'var(--bg-primary)' }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(139, 92, 246, 0.15)' }}
            >
              <Sparkles className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                AI 로 프로젝트 시작
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                요구사항 입력 → 초기 밸런스 시트 자동 생성
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 워크타입 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              유형
            </label>
            <CustomSelect
              value={workType}
              onChange={(v) => setWorkType(v as typeof workType)}
              options={[
                { value: 'balancing', label: '⚔️  밸런싱 (수치 시트)' },
                { value: 'pm', label: '📋  팀 PM (스프린트 / 버그 / 로드맵)' },
                { value: 'design-doc', label: '📝  기획 문서 (베타)' },
              ]}
              size="md"
            />
          </div>

          {/* 장르 (밸런싱일 때만) */}
          {workType === 'balancing' && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                장르
              </label>
              <CustomSelect
                value={genre}
                onChange={setGenre}
                options={[
                  { value: 'rpg', label: 'RPG (캐릭터 스탯, 레벨, 스킬)' },
                  { value: 'fps', label: 'FPS (무기 DPS/TTK)' },
                  { value: 'moba', label: 'MOBA (챔피언 밸런스)' },
                  { value: 'idle', label: '방치형 (업그레이드 ROI)' },
                  { value: 'roguelike', label: '로그라이크 (유물, 등급)' },
                ]}
                size="md"
              />
            </div>
          )}

          {/* 요구사항 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              요구사항 (자연어)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="예: 메트로이드바니아 장르 + 난이도 중상 + 플레이 20시간 목표 + 스킬 트리 30개 노드 + F2P 가챠 없음"
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* 프로젝트 이름 */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              프로젝트 이름 <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="비우면 자동 생성"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: '#8b5cf6', color: 'white' }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 생성 중…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 추천 시트 생성
              </>
            )}
          </button>

          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
            >
              {error}
            </div>
          )}

          {/* 프리뷰 */}
          {preview && (
            <div
              className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {preview.length}개 시트 제안
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: mode === 'llm' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: mode === 'llm' ? '#8b5cf6' : '#f59e0b',
                  }}
                >
                  {mode === 'llm' ? 'LLM' : 'Template'}
                </span>
              </div>
              {note && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {note}
                </p>
              )}
              <div className="space-y-2">
                {preview.map((s, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    <div className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      📋 {s.name}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.columns.map((col, j) => (
                        <span
                          key={j}
                          className="text-[11px] px-2 py-0.5 rounded"
                          style={{
                            background:
                              col.type === 'formula'
                                ? 'rgba(139, 92, 246, 0.1)'
                                : 'var(--bg-tertiary)',
                            color:
                              col.type === 'formula'
                                ? '#8b5cf6'
                                : 'var(--text-secondary)',
                          }}
                          title={col.formula ?? ''}
                        >
                          {col.type === 'formula' ? 'ƒ ' : ''}
                          {col.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#10b981', color: 'white' }}
              >
                <Check className="w-4 h-4" /> 프로젝트로 적용
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
