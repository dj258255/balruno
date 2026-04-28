'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { availableFunctions } from '@/lib/formulaEngine';
import type { Column, Sheet } from '@/types';

interface AutocompleteItem {
  type: 'function' | 'column' | 'sheet' | 'sheetVar';
  name: string;
  description: string;
  value: string; // 선택 시 삽입될 값
}

interface FormulaAutocompleteProps {
  value: string;
  onSelect: (text: string) => void;
  columns: Column[];
  sheets?: Sheet[];  // 다른 시트들 (시트 참조 자동완성용)
  currentSheetId?: string;  // 현재 시트 ID (자기 자신 제외용)
  visible?: boolean;  // 표시 여부
}

export interface FormulaAutocompleteRef {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  hasItems: () => boolean;
}

const FormulaAutocomplete = forwardRef<FormulaAutocompleteRef, FormulaAutocompleteProps>(({
  value,
  onSelect,
  columns,
  sheets = [],
  currentSheetId,
  visible = true,
}, ref) => {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const formulaText = value.startsWith('=') ? value.slice(1) : '';

  // 시트명. 패턴 감지 (예: "글로벌설정." 또는 "Settings.")
  const sheetRefMatch = formulaText.match(/([가-힣a-zA-Z_][가-힣a-zA-Z0-9_]*)\.([가-힣a-zA-Z0-9_]*)$/);
  const isSheetRefMode = sheetRefMatch !== null;
  const sheetName = sheetRefMatch ? sheetRefMatch[1] : '';
  const varPrefix = sheetRefMatch ? sheetRefMatch[2].toUpperCase() : '';

  // 일반 단어 추출 (시트 참조 모드가 아닐 때)
  const lastWord = isSheetRefMode
    ? ''
    : (formulaText.split(/[\s()+\-*/,]/).pop()?.toUpperCase() || '');

  // 매칭되는 아이템들 계산
  const items: AutocompleteItem[] = [];

  if (isSheetRefMode) {
    // 시트 참조 모드: 해당 시트의 변수들 표시
    const targetSheet = sheets.find(s => s.name === sheetName);
    if (targetSheet) {
      // 세로형 설정 시트인지 확인
      const varNameCol = targetSheet.columns.find(c =>
        c.name === '변수명' || c.name === 'name' || c.name === 'Name' || c.name === 'ID' || c.name === 'id'
      );
      const valueCol = targetSheet.columns.find(c =>
        c.name === '값' || c.name === 'value' || c.name === 'Value'
      );

      if (varNameCol && valueCol) {
        // 세로형 설정 시트: 변수명 컬럼의 값들을 제안
        targetSheet.rows.forEach((row) => {
          const varName = row.cells[varNameCol.id];
          const varValue = row.cells[valueCol.id];
          if (typeof varName === 'string' && varName) {
            if (!varPrefix || varName.toUpperCase().startsWith(varPrefix)) {
              items.push({
                type: 'sheetVar',
                name: varName,
                description: `= ${varValue ?? t('formula.valueEmpty')}`,
                value: value.slice(0, value.length - (sheetRefMatch[2]?.length || 0)) + varName,
              });
            }
          }
        });
      } else {
        // 가로형 데이터 시트: 컬럼명들을 제안
        targetSheet.columns.forEach((col) => {
          if (!varPrefix || col.name.toUpperCase().startsWith(varPrefix)) {
            const firstRowValue = targetSheet.rows[0]?.cells[col.id];
            items.push({
              type: 'sheetVar',
              name: col.name,
              description: `= ${firstRowValue ?? t('formula.valueEmpty')}`,
              value: value.slice(0, value.length - (sheetRefMatch[2]?.length || 0)) + col.name,
            });
          }
        });
      }
    }
  } else if (lastWord && lastWord.length >= 1) {
    // 일반 모드: 함수, 컬럼, 시트 매칭

    // 함수 매칭
    const matchingFunctions = availableFunctions.filter((f) =>
      f.name.toUpperCase().startsWith(lastWord)
    );
    matchingFunctions.slice(0, 5).forEach((func) => {
      items.push({
        type: 'function',
        name: func.name,
        description: func.description,
        value: value.slice(0, value.length - lastWord.length) + func.name + '(',
      });
    });

    // 컬럼 매칭
    const matchingColumns = columns.filter((c) =>
      c.name.toUpperCase().startsWith(lastWord)
    );
    matchingColumns.slice(0, 5).forEach((col) => {
      items.push({
        type: 'column',
        name: col.name,
        description: col.type === 'formula' ? t('formula.formulaType') : t('formula.generalType'),
        value: value.slice(0, value.length - lastWord.length) + col.name,
      });
    });

    // 시트 매칭 (다른 시트 참조용)
    const otherSheets = sheets.filter(s => s.id !== currentSheetId);
    const matchingSheets = otherSheets.filter((s) =>
      s.name.toUpperCase().startsWith(lastWord)
    );
    matchingSheets.slice(0, 3).forEach((sheet) => {
      items.push({
        type: 'sheet',
        name: sheet.name,
        description: t('formula.sheetRef'),
        value: value.slice(0, value.length - lastWord.length) + sheet.name + '.',
      });
    });

    // 이전행/PREV 매칭
    if ('이전행'.startsWith(lastWord.toLowerCase()) || 'PREV'.startsWith(lastWord)) {
      items.push({
        type: 'sheet',
        name: '이전행',
        description: t('formula.prevRowRef'),
        value: value.slice(0, value.length - lastWord.length) + '이전행.',
      });
    }
  }

  // 선택 인덱스 범위 제한
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  // value 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIndex(0);
  }, [value]);

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (!containerRef.current) return;
    const selectedElement = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // 키보드 이벤트 핸들러 (부모에서 호출)
  const handleKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (items.length === 0) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      case 'Enter':
      case 'Tab':
        if (items[selectedIndex]) {
          e.preventDefault();
          onSelect(items[selectedIndex].value);
          return true;
        }
        return false;
      case 'Escape':
        return false; // Escape는 부모가 처리하도록
      default:
        return false;
    }
  }, [items, selectedIndex, onSelect]);

  // ref를 통해 키보드 핸들러 노출 (visible/items와 무관하게 항상 ref 유지)
  useImperativeHandle(ref, () => ({
    handleKeyDown,
    hasItems: () => items.length > 0,
  }), [handleKeyDown, items.length]);

  // visible이 false이거나 아이템이 없으면 렌더링 안 함
  // 주의: useImperativeHandle은 위에서 먼저 호출되어야 ref가 유지됨
  if (!visible || items.length === 0) return null;

  // 타입별 분리
  const functionItems = items.filter((item) => item.type === 'function');
  const columnItems = items.filter((item) => item.type === 'column');
  const sheetItems = items.filter((item) => item.type === 'sheet');
  const sheetVarItems = items.filter((item) => item.type === 'sheetVar');

  // 전체 인덱스 계산을 위한 함수
  const getGlobalIndex = (type: AutocompleteItem['type'], localIndex: number) => {
    if (type === 'function') return localIndex;
    if (type === 'column') return functionItems.length + localIndex;
    if (type === 'sheet') return functionItems.length + columnItems.length + localIndex;
    return functionItems.length + columnItems.length + sheetItems.length + localIndex;
  };

  return (
    <div
      ref={containerRef}
      data-autocomplete="true"
      className="absolute top-full left-0 mt-1 border rounded-lg shadow-lg z-50 w-72 max-h-48 overflow-y-auto"
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
    >
      {functionItems.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
            {t('formula.functions')}
          </div>
          {functionItems.map((item, localIndex) => {
            const globalIndex = getGlobalIndex('function', localIndex);
            const isSelected = globalIndex === selectedIndex;
            return (
              <button
                key={item.name}
                data-index={globalIndex}
                onClick={() => onSelect(item.value)}
                className="w-full text-left px-3 py-2 flex items-start gap-2 transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  background: isSelected ? 'var(--primary-blue-light)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--primary-blue)' : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(globalIndex)}
              >
                <code className="font-semibold text-sm" style={{ color: 'var(--primary-blue)' }}>{item.name}</code>
                <span className="text-xs flex-1" style={{ color: 'var(--text-tertiary)' }}>{item.description}</span>
              </button>
            );
          })}
        </div>
      )}
      {columnItems.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
            {t('formula.columnRef')}
          </div>
          {columnItems.map((item, localIndex) => {
            const globalIndex = getGlobalIndex('column', localIndex);
            const isSelected = globalIndex === selectedIndex;
            return (
              <button
                key={item.name}
                data-index={globalIndex}
                onClick={() => onSelect(item.value)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  background: isSelected ? 'var(--primary-green-light)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--primary-green)' : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(globalIndex)}
              >
                <span className="font-medium text-sm" style={{ color: 'var(--primary-green)' }}>{item.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  ({item.description})
                </span>
              </button>
            );
          })}
        </div>
      )}
      {sheetItems.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
            {t('formula.sheetRef')}
          </div>
          {sheetItems.map((item, localIndex) => {
            const globalIndex = getGlobalIndex('sheet', localIndex);
            const isSelected = globalIndex === selectedIndex;
            return (
              <button
                key={item.name}
                data-index={globalIndex}
                onClick={() => onSelect(item.value)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  background: isSelected ? 'var(--primary-purple-light)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--primary-purple)' : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(globalIndex)}
              >
                <span className="font-medium text-sm" style={{ color: 'var(--primary-purple)' }}>{item.name}.</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {sheetVarItems.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
            {sheetName ? t('formula.sheetVarsLabel', { sheet: sheetName }) : t('formula.sheetVars')}
          </div>
          {sheetVarItems.map((item, localIndex) => {
            const globalIndex = getGlobalIndex('sheetVar', localIndex);
            const isSelected = globalIndex === selectedIndex;
            return (
              <button
                key={item.name}
                data-index={globalIndex}
                onClick={() => onSelect(item.value)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  background: isSelected ? 'var(--primary-teal-light)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--primary-teal)' : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(globalIndex)}
              >
                <span className="font-medium text-sm" style={{ color: 'var(--primary-teal)' }}>{item.name}</span>
                <span className="text-xs flex-1 text-right font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

FormulaAutocomplete.displayName = 'FormulaAutocomplete';

export default FormulaAutocomplete;
