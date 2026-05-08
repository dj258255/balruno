import { useTranslations } from 'next-intl';

interface LevelRangeSelectorProps {
  levelRange: { min: number; max: number };
  onRangeChange: (range: { min: number; max: number }) => void;
  maxLimit?: number;
}

// 슬라이더 스타일 - 라이트/다크 모드 대응
const sliderStyles = `
  .level-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    outline: none;
    cursor: pointer;
    margin: 0;
  }

  .level-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--primary-purple);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    margin-top: -6px;
  }

  .level-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
  }

  .level-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--primary-purple);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .level-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
  }

  .level-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
  }
`;

export default function LevelRangeSelector({
  levelRange,
  onRangeChange,
  maxLimit = 200,
}: LevelRangeSelectorProps) {
  const t = useTranslations('entityDefinition');
  // 슬라이더 진행률 계산
  const progress = ((levelRange.max - 10) / (maxLimit - 10)) * 100;

  return (
    <div className="space-y-3">
      <style>{sliderStyles}</style>

      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('levelRange')}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
            {t('startLevel')}
          </label>
          <input
            type="number"
            value={levelRange.min}
            onChange={(e) => {
              const min = Math.max(1, Math.min(parseInt(e.target.value) || 1, levelRange.max - 1));
              onRangeChange({ ...levelRange, min });
            }}
            min={1}
            max={levelRange.max - 1}
            className="w-full input-base hide-spinner"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div className="text-sm pt-5" style={{ color: 'var(--text-tertiary)' }}>
          ~
        </div>

        <div className="flex-1">
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
            {t('maxLevel')}
          </label>
          <input
            type="number"
            value={levelRange.max}
            onChange={(e) => {
              const max = Math.max(levelRange.min + 1, Math.min(parseInt(e.target.value) || 1, maxLimit));
              onRangeChange({ ...levelRange, max });
            }}
            min={levelRange.min + 1}
            max={maxLimit}
            className="w-full input-base hide-spinner"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* 슬라이더 - 커스텀 스타일 */}
      <div className="pt-1">
        <div className="relative">
          <input
            type="range"
            value={levelRange.max}
            onChange={(e) => {
              const max = Math.max(levelRange.min + 1, parseInt(e.target.value));
              onRangeChange({ ...levelRange, max });
            }}
            min={10}
            max={maxLimit}
            className="level-slider"
            style={{
              background: `linear-gradient(to right, var(--primary-purple) 0%, var(--primary-purple) ${progress}%, var(--bg-tertiary) ${progress}%, var(--bg-tertiary) 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          <span>10</span>
          <span style={{ color: 'var(--primary-purple)', fontWeight: 500 }}>
            {t('totalRows', { count: levelRange.max - levelRange.min + 1 })}
          </span>
          <span>{maxLimit}</span>
        </div>
      </div>

      {/* 프리셋 버튼 */}
      <div className="flex gap-2">
        {[50, 100, 150, 200].map((preset) => {
          const isActive = levelRange.max === preset;
          return (
            <button
              key={preset}
              onClick={() => onRangeChange({ min: 1, max: preset })}
              className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all border"
              style={{
                background: isActive ? 'var(--primary-purple)' : 'var(--bg-tertiary)',
                borderColor: isActive ? 'var(--primary-purple)' : 'var(--border-primary)',
                color: isActive ? 'white' : 'var(--text-primary)',
              }}
            >
              {t('rangeBtn', { max: preset })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
