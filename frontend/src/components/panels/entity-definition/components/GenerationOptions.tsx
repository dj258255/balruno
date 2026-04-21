'use client';

import { FileSpreadsheet, FilePlus, Loader2 } from 'lucide-react';

interface GenerationOptionsProps {
  outputMode: 'new-sheet' | 'current-sheet';
  onOutputModeChange: (mode: 'new-sheet' | 'current-sheet') => void;
  sheetNamePattern: string;
  onSheetNamePatternChange: (pattern: string) => void;
  onGenerate: () => void;
  onGenerateAll: () => void;
  isGenerating: boolean;
  generationProgress: number;
  entityCount: number;
  selectedEntityName?: string;
  rowCount: number;
}

export default function GenerationOptions({
  outputMode,
  onOutputModeChange,
  sheetNamePattern,
  onSheetNamePatternChange,
  onGenerate,
  onGenerateAll,
  isGenerating,
  generationProgress,
  entityCount,
  selectedEntityName,
  rowCount,
}: GenerationOptionsProps) {
  return (
    <div className="space-y-4">
      {/* 출력 모드 선택 */}
      <div className="space-y-2">
        <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          생성 옵션
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOutputModeChange('new-sheet')}
            className="p-3 rounded-lg text-left transition-all"
            style={{
              background: outputMode === 'new-sheet' ? '#9179f220' : 'var(--bg-secondary)',
              border: `1px solid ${outputMode === 'new-sheet' ? '#9179f2' : 'var(--border-primary)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <FilePlus className="w-4 h-4" style={{ color: outputMode === 'new-sheet' ? '#9179f2' : 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                새 시트 생성
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              별도 시트에 레벨 테이블 생성
            </p>
          </button>

          <button
            onClick={() => onOutputModeChange('current-sheet')}
            className="p-3 rounded-lg text-left transition-all opacity-50 cursor-not-allowed"
            disabled
            style={{
              background: outputMode === 'current-sheet' ? '#9179f220' : 'var(--bg-secondary)',
              border: `1px solid ${outputMode === 'current-sheet' ? '#9179f2' : 'var(--border-primary)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                현재 시트에 추가
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              (준비 중)
            </p>
          </button>
        </div>
      </div>

      {/* 시트 이름 패턴 */}
      {outputMode === 'new-sheet' && (
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            시트 이름 패턴
          </label>
          <input
            type="text"
            value={sheetNamePattern}
            onChange={(e) => onSheetNamePatternChange(e.target.value)}
            placeholder="{entity}_레벨테이블"
            className="w-full input-base"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {'{entity}'} = 엔티티 이름으로 대체됨
          </p>
        </div>
      )}

      {/* 생성 진행률 */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#9179f2' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              레벨 테이블 생성 중... {generationProgress}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${generationProgress}%`,
                background: 'linear-gradient(90deg, #9179f2, #5a9cf5)',
              }}
            />
          </div>
        </div>
      )}

      {/* 생성 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !selectedEntityName}
          className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #9179f2, #7c3aed)',
            color: 'white',
          }}
        >
          {selectedEntityName ? (
            <>
              {selectedEntityName} 레벨 테이블 생성
              <span className="text-xs opacity-75 ml-1">({rowCount}행)</span>
            </>
          ) : (
            '엔티티를 선택하세요'
          )}
        </button>
      </div>

      {entityCount > 1 && (
        <button
          onClick={onGenerateAll}
          disabled={isGenerating}
          className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        >
          전체 엔티티 레벨 테이블 생성 ({entityCount}개)
        </button>
      )}
    </div>
  );
}
