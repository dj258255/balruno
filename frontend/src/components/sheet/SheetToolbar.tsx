'use client';

import { useCallback, useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  RotateCcw,
  ChevronDown,
  History,
  StickyNote,
  X,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { useSheetUIStore, DEFAULT_CELL_STYLE } from '@/stores/sheetUIStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { CellStyle } from '@/types';

// 폰트 사이즈 옵션 (x-spreadsheet 패턴)
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36];

// 텍스트 회전 옵션
const TEXT_ROTATIONS = [
  { value: 0, label: '0°' },
  { value: 45, label: '45°' },
  { value: 90, label: '90°' },
  { value: -45, label: '-45°' },
  { value: -90, label: '-90°' },
];

// 툴팁 컴포넌트
interface TooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
}

function Tooltip({ children, label, shortcut }: TooltipProps) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 위치를 렌더링 시 계산
  const getPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.bottom + 6 };
    }
    return { x: 0, y: 0 };
  };

  const position = show ? getPosition() : { x: 0, y: 0 };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      className="relative inline-flex"
    >
      {children}
      {show && (
        <div
          className="fixed z-[100] px-2.5 py-1.5 rounded-lg shadow-lg text-xs whitespace-nowrap pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
            transform: 'translateX(-50%)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* 위쪽 화살표 */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45"
            style={{
              background: 'var(--bg-primary)',
              borderLeft: '1px solid var(--border-primary)',
              borderTop: '1px solid var(--border-primary)',
            }}
          />
          <div className="relative flex items-center gap-2">
            <span className="font-medium">{label}</span>
            {shortcut && (
              <span
                className="px-1.5 py-0.5 rounded text-caption font-medium"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
              >
                {shortcut}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SheetToolbarProps {
  onStyleChange?: (style: Partial<CellStyle>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAddMemo?: () => void;
  disabled?: boolean;
}

export default function SheetToolbar({
  onStyleChange,
  onUndo,
  onRedo,
  onAddMemo,
  disabled = false,
}: SheetToolbarProps) {
  const t = useTranslations();
  const {
    zoomLevel,
    setZoom,
    zoomIn,
    zoomOut,
    currentCellStyle,
    updateCurrentCellStyle,
  } = useSheetUIStore();
  const { canUndo, canRedo, getHistory, deleteEntry, clear } = useHistoryStore();
  const { past, future } = getHistory();

  // 히스토리 드롭다운 상태
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const [historyDropdownPos, setHistoryDropdownPos] = useState({ top: 0, left: 0 });

  // 회전 드롭다운 상태
  const [showRotation, setShowRotation] = useState(false);
  const rotationRef = useRef<HTMLDivElement>(null);
  const rotationButtonRef = useRef<HTMLButtonElement>(null);
  const [rotationDropdownPos, setRotationDropdownPos] = useState({ top: 0, left: 0 });

  // Portal 마운트 상태
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Portal로 렌더링된 드롭다운이 클릭 타겟의 부모인지 확인
      const historyDropdown = document.querySelector('[data-dropdown="history"]');
      const rotationDropdown = document.querySelector('[data-dropdown="rotation"]');

      if (showHistory && historyRef.current && !historyRef.current.contains(target) &&
          (!historyDropdown || !historyDropdown.contains(target))) {
        setShowHistory(false);
      }
      if (showRotation && rotationRef.current && !rotationRef.current.contains(target) &&
          (!rotationDropdown || !rotationDropdown.contains(target))) {
        setShowRotation(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory, showRotation]);

  // 스타일 토글 핸들러 (x-spreadsheet ToggleItem 패턴)
  const handleToggleStyle = useCallback(
    (key: keyof CellStyle) => {
      const newValue = !currentCellStyle[key];
      updateCurrentCellStyle({ [key]: newValue });
      onStyleChange?.({ [key]: newValue });
    },
    [currentCellStyle, updateCurrentCellStyle, onStyleChange]
  );

  // 폰트 사이즈 변경
  const handleFontSizeChange = useCallback(
    (size: number) => {
      updateCurrentCellStyle({ fontSize: size });
      onStyleChange?.({ fontSize: size });
    },
    [updateCurrentCellStyle, onStyleChange]
  );

  // 폰트 사이즈 증감
  const handleFontSizeStep = useCallback(
    (delta: number) => {
      const currentSize = currentCellStyle.fontSize || DEFAULT_CELL_STYLE.fontSize || 14;
      const currentIndex = FONT_SIZES.findIndex((s) => s >= currentSize);
      const newIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, currentIndex + delta));
      handleFontSizeChange(FONT_SIZES[newIndex]);
    },
    [currentCellStyle.fontSize, handleFontSizeChange]
  );

  // 정렬 변경
  const handleAlignChange = useCallback(
    (hAlign: CellStyle['hAlign']) => {
      updateCurrentCellStyle({ hAlign });
      onStyleChange?.({ hAlign });
    },
    [updateCurrentCellStyle, onStyleChange]
  );

  // 세로 정렬 변경
  const handleVAlignChange = useCallback(
    (vAlign: CellStyle['vAlign']) => {
      updateCurrentCellStyle({ vAlign });
      onStyleChange?.({ vAlign });
    },
    [updateCurrentCellStyle, onStyleChange]
  );

  // 텍스트 회전 변경
  const handleRotationChange = useCallback(
    (rotation: number) => {
      updateCurrentCellStyle({ textRotation: rotation });
      onStyleChange?.({ textRotation: rotation });
    },
    [updateCurrentCellStyle, onStyleChange]
  );

  // Undo/Redo 핸들러
  const handleUndo = useCallback(() => {
    onUndo?.();
  }, [onUndo]);

  const handleRedo = useCallback(() => {
    onRedo?.();
  }, [onRedo]);

  // 줌 퍼센트 표시
  const zoomPercent = Math.round(zoomLevel * 100);

  // 버튼 스타일 - 모바일에서 더 큰 터치 타겟
  const buttonClass = `p-2 sm:p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;
  const activeClass = `bg-[var(--primary-blue-light)]`;
  const hoverClass = `hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]`;

  // 구분선 컴포넌트 - 모바일에서 숨김
  const Divider = () => (
    <div className="hidden sm:block w-px h-6 mx-1" style={{ background: 'var(--border-primary)' }} />
  );

  return (
    <div
      className="flex items-center gap-1 sm:gap-0.5 px-2 sm:px-2 py-2 sm:py-1.5 border-b overflow-x-auto scrollbar-none"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Undo/Redo (x-spreadsheet 패턴) */}
      <Tooltip label={t('toolbar.undo')} shortcut="Ctrl+Z">
        <button
          onClick={handleUndo}
          disabled={disabled || !canUndo()}
          className={`${buttonClass} ${hoverClass}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          <Undo2 className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.redo')} shortcut="Ctrl+Y">
        <button
          onClick={handleRedo}
          disabled={disabled || !canRedo()}
          className={`${buttonClass} ${hoverClass}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          <Redo2 className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      {/* 히스토리 드롭다운 */}
      <div className="relative" ref={historyRef}>
        <Tooltip label={t('toolbar.history')}>
          <button
            ref={historyButtonRef}
            onClick={() => {
              if (historyButtonRef.current) {
                const rect = historyButtonRef.current.getBoundingClientRect();
                setHistoryDropdownPos({ top: rect.bottom + 4, left: rect.left });
              }
              setShowHistory(!showHistory);
            }}
            disabled={disabled || (past.length === 0 && future.length === 0)}
            className={`${buttonClass} ${hoverClass} flex items-center gap-0.5`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <History className="w-5 h-5 sm:w-4 sm:h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
        </Tooltip>

        {showHistory && (past.length > 0 || future.length > 0) && isMounted && createPortal(
          <div
            data-dropdown="history"
            className="fixed min-w-[220px] rounded-lg shadow-lg border z-[1100] overflow-hidden"
            style={{
              top: historyDropdownPos.top,
              left: historyDropdownPos.left,
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            <div className="max-h-[280px] overflow-y-auto scrollbar-visible">
              {/* Undo 히스토리 */}
              {past.length > 0 && (
                <div className="p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div
                    className="text-xs font-medium mb-1 px-2"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('toolbar.undoHistory')} ({past.length})
                  </div>
                  {[...past].reverse().slice(0, 10).map((item, index) => {
                    const actualIndex = past.length - 1 - index;
                    const isCurrentState = actualIndex === past.length - 1;
                    return (
                      <div
                        key={`undo-${index}`}
                        className="px-2 py-1.5 text-xs rounded hover:bg-[var(--bg-hover)] cursor-default flex items-center gap-2 group"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Undo2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                        <span className="truncate flex-1">
                          {t.has(item.label) ? t(item.label) : item.label} - {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        {!isCurrentState && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry('past', actualIndex);
                            }}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-opacity"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Redo 히스토리 */}
              {future.length > 0 && (
                <div className="p-2">
                  <div
                    className="text-xs font-medium mb-1 px-2"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('toolbar.redoHistory')} ({future.length})
                  </div>
                  {[...future].slice(0, 10).map((item, index) => (
                    <div
                      key={`redo-${index}`}
                      className="px-2 py-1.5 text-xs rounded hover:bg-[var(--bg-hover)] cursor-default flex items-center gap-2 group"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Redo2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="truncate flex-1">
                        {t.has(item.label) ? t(item.label) : item.label} - {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEntry('future', index);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-opacity"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 히스토리 없음 */}
              {past.length === 0 && future.length === 0 && (
                <div className="p-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {t('toolbar.noHistory')}
                </div>
              )}
            </div>

            {/* 전체 삭제 버튼 */}
            {(past.length > 1 || future.length > 0) && (
              <div
                className="border-t px-3 py-1.5"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <button
                  className="w-full text-xs py-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ color: 'var(--status-error)' }}
                  onClick={() => {
                    clear();
                    setShowHistory(false);
                  }}
                >
                  {t('toolbar.clearHistory')}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
      </div>

      <Divider />

      {/* 폰트 사이즈 (x-spreadsheet FontSize 패턴) */}
      <div className="flex items-center gap-0.5">
        <Tooltip label={t('toolbar.decreaseFontSize')}>
          <button
            onClick={() => handleFontSizeStep(-1)}
            disabled={disabled}
            className={`${buttonClass} ${hoverClass}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Minus className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </Tooltip>
        <Tooltip label={t('toolbar.fontSize')}>
          <CustomSelect
            value={String(currentCellStyle.fontSize || DEFAULT_CELL_STYLE.fontSize)}
            onChange={(v) => handleFontSizeChange(Number(v))}
            disabled={disabled}
            options={FONT_SIZES.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            size="sm"
          />
        </Tooltip>
        <Tooltip label={t('toolbar.increaseFontSize')}>
          <button
            onClick={() => handleFontSizeStep(1)}
            disabled={disabled}
            className={`${buttonClass} ${hoverClass}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </Tooltip>
      </div>

      <Divider />

      {/* 텍스트 스타일 (x-spreadsheet Bold/Italic/Underline/Strike 패턴) */}
      <Tooltip label={t('toolbar.bold')} shortcut="Ctrl+B">
        <button
          onClick={() => handleToggleStyle('bold')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.bold ? activeClass : ''}`}
          style={{ color: currentCellStyle.bold ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <Bold className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.italic')} shortcut="Ctrl+I">
        <button
          onClick={() => handleToggleStyle('italic')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.italic ? activeClass : ''}`}
          style={{ color: currentCellStyle.italic ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <Italic className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.underline')} shortcut="Ctrl+U">
        <button
          onClick={() => handleToggleStyle('underline')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.underline ? activeClass : ''}`}
          style={{ color: currentCellStyle.underline ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <Underline className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.strikethrough')}>
        <button
          onClick={() => handleToggleStyle('strikethrough')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.strikethrough ? activeClass : ''}`}
          style={{ color: currentCellStyle.strikethrough ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <Strikethrough className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      <Divider />

      {/* 가로 정렬 (x-spreadsheet Align 패턴) */}
      <Tooltip label={t('toolbar.alignLeft')}>
        <button
          onClick={() => handleAlignChange('left')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.hAlign === 'left' ? activeClass : ''}`}
          style={{ color: currentCellStyle.hAlign === 'left' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignLeft className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.alignCenter')}>
        <button
          onClick={() => handleAlignChange('center')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.hAlign === 'center' ? activeClass : ''}`}
          style={{ color: currentCellStyle.hAlign === 'center' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignCenter className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.alignRight')}>
        <button
          onClick={() => handleAlignChange('right')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.hAlign === 'right' ? activeClass : ''}`}
          style={{ color: currentCellStyle.hAlign === 'right' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignRight className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      <Divider />

      {/* 세로 정렬 (x-spreadsheet Valign 패턴) */}
      <Tooltip label={t('toolbar.alignTop')}>
        <button
          onClick={() => handleVAlignChange('top')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.vAlign === 'top' ? activeClass : ''}`}
          style={{ color: currentCellStyle.vAlign === 'top' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignVerticalJustifyStart className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.alignMiddle')}>
        <button
          onClick={() => handleVAlignChange('middle')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.vAlign === 'middle' ? activeClass : ''}`}
          style={{ color: currentCellStyle.vAlign === 'middle' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignVerticalJustifyCenter className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>
      <Tooltip label={t('toolbar.alignBottom')}>
        <button
          onClick={() => handleVAlignChange('bottom')}
          disabled={disabled}
          className={`${buttonClass} ${hoverClass} ${currentCellStyle.vAlign === 'bottom' ? activeClass : ''}`}
          style={{ color: currentCellStyle.vAlign === 'bottom' ? 'var(--primary-blue)' : 'var(--text-secondary)' }}
        >
          <AlignVerticalJustifyEnd className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      <Divider />

      {/* 텍스트 회전 */}
      <div className="relative" ref={rotationRef}>
        <Tooltip label={t('toolbar.textRotation')}>
          <button
            ref={rotationButtonRef}
            onClick={() => {
              if (rotationButtonRef.current) {
                const rect = rotationButtonRef.current.getBoundingClientRect();
                setRotationDropdownPos({ top: rect.bottom + 4, left: rect.left });
              }
              setShowRotation(!showRotation);
            }}
            disabled={disabled}
            className={`${buttonClass} ${hoverClass} flex items-center gap-1 px-2`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="text-xs font-medium" style={{ minWidth: '24px' }}>
              {currentCellStyle.textRotation || 0}°
            </span>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {showRotation && isMounted && createPortal(
          <div
            data-dropdown="rotation"
            className="fixed py-1 rounded-lg shadow-lg z-[1100] min-w-[80px]"
            style={{
              top: rotationDropdownPos.top,
              left: rotationDropdownPos.left,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            {TEXT_ROTATIONS.map((rot) => (
              <button
                key={rot.value}
                onClick={() => {
                  handleRotationChange(rot.value);
                  setShowRotation(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: currentCellStyle.textRotation === rot.value ? 'var(--primary-blue)' : 'var(--text-primary)',
                  fontWeight: currentCellStyle.textRotation === rot.value ? 600 : 400,
                }}
              >
                {rot.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      <Divider />

      {/* 메모 버튼 */}
      <Tooltip label={t('common.memo')}>
        <button
          onClick={onAddMemo}
          className={`${buttonClass} ${hoverClass} flex items-center gap-1`}
          style={{
            background: 'var(--warning-light, rgba(251, 191, 36, 0.15))',
            color: 'var(--warning, #f59e0b)',
            border: '1px solid var(--warning, #f59e0b)',
          }}
        >
          <StickyNote className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      {/* 스페이서 */}
      <div className="flex-1" />

      {/* 줌 컨트롤 (Luckysheet zoomRatio 패턴) */}
      <div className="flex items-center gap-1">
        <Tooltip label={t('toolbar.zoomOut')}>
          <button
            onClick={zoomOut}
            disabled={zoomLevel <= 0.5}
            className={`${buttonClass} ${hoverClass}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Minus className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </Tooltip>
        <Tooltip label={t('toolbar.zoom')}>
          <CustomSelect
            value={String(zoomLevel)}
            onChange={(v) => setZoom(Number(v))}
            options={[
              { value: '0.5', label: '50%' },
              { value: '0.75', label: '75%' },
              { value: '1', label: '100%' },
              { value: '1.25', label: '125%' },
              { value: '1.5', label: '150%' },
              { value: '1.75', label: '175%' },
              { value: '2', label: '200%' },
            ]}
            size="sm"
          />
        </Tooltip>
        <Tooltip label={t('toolbar.zoomIn')}>
          <button
            onClick={zoomIn}
            disabled={zoomLevel >= 2.0}
            className={`${buttonClass} ${hoverClass}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
