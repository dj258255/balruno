'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import type { EntityDefinition, CurveType, StatOverride, LevelTableRow, InterpolationType, Sheet } from '@/types';
import {
  generateLevelTableRows,
  generatePreviewData,
  generateCurvePreviewData,
  CURVE_TYPES,
  DEFAULT_GROWTH_RATES,
} from '@/lib/entityGeneration';
import { computeSheetRows } from '@/lib/formulaEngine';
import type { StatDefinition } from '../components/StatDefinitionEditor';
import type { ExportFieldNames } from '../components/ColumnMappingSelector';

export interface EntityDefinitionState {
  // 선택된 시트
  selectedSourceSheetId: string | null;
  availableSheets: Sheet[];

  // 컬럼 매핑
  idColumn: string;
  nameColumn: string;

  // 스탯 정의
  statDefinitions: StatDefinition[];

  // 선택된 엔티티
  selectedEntityId: string | null;
  selectedEntity: EntityDefinition | null;

  // 모든 엔티티 목록
  entities: EntityDefinition[];

  // 편집 중인 오버라이드
  editingOverrides: StatOverride[];

  // 레벨 범위 설정
  levelRange: { min: number; max: number };

  // 미리보기 데이터
  previewData: LevelTableRow[];
  curvePreviewData: Record<string, { level: number; value: number }[]>;

  // 생성 옵션
  outputMode: 'new-sheet' | 'current-sheet';
  sheetNamePattern: string;

  // 상태
  isGenerating: boolean;
  generationProgress: number;
}

export function useEntityDefinition() {
  const t = useTranslations('entityDefinition');
  const store = useProjectStore();

  // ===== State =====
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSourceSheetId, setSelectedSourceSheetId] = useState<string | null>(null);
  const [idColumn, setIdColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  const [levelColumn, setLevelColumn] = useState<string>('');
  const [statDefinitions, setStatDefinitions] = useState<StatDefinition[]>([
    { name: 'HP', sourceColumn: '', curveType: 'exponential', growthRate: 1.08 },
    { name: 'ATK', sourceColumn: '', curveType: 'exponential', growthRate: 1.08 },
    { name: 'DEF', sourceColumn: '', curveType: 'exponential', growthRate: 1.08 },
  ]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [editingOverrides, setEditingOverrides] = useState<StatOverride[]>([]);
  const [levelRange, setLevelRange] = useState({ min: 1, max: 50 });
  const [outputMode, setOutputMode] = useState<'new-sheet' | 'current-sheet'>('new-sheet');
  const [sheetNamePattern, setSheetNamePattern] = useState(t('patternPlaceholder'));
  const [exportFieldNames, setExportFieldNames] = useState<ExportFieldNames>({
    entityId: '',
    entityName: '',
    level: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [interpolationType, setInterpolationType] = useState<InterpolationType>('linear');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // ===== 선택된 프로젝트 (없으면 현재 프로젝트) =====
  const effectiveProjectId = selectedProjectId || store.currentProjectId;
  const currentProject = store.projects.find(p => p.id === effectiveProjectId);

  // ===== 사용 가능한 시트 목록 =====
  const availableSheets = useMemo(() => {
    return currentProject?.sheets || [];
  }, [currentProject]);

  // ===== 프로젝트 변경 핸들러 =====
  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    // 프로젝트 변경 시 시트 선택 초기화
    setSelectedSourceSheetId(null);
    setSelectedEntityId(null);
    setIdColumn('');
    setNameColumn('');
    setLevelColumn('');
  }, []);

  // ===== 선택된 소스 시트 =====
  const selectedSourceSheet = useMemo(() => {
    if (!selectedSourceSheetId) return null;
    return availableSheets.find(s => s.id === selectedSourceSheetId) || null;
  }, [selectedSourceSheetId, availableSheets]);

  // ===== 시트 컬럼 목록 =====
  const availableColumns = useMemo(() => {
    if (!selectedSourceSheet) return [];
    return selectedSourceSheet.columns.map(c => c.name);
  }, [selectedSourceSheet]);

  // ===== 시트의 계산된 값 (공통 유틸 함수 사용) =====
  const computedRows = useMemo(() => {
    if (!selectedSourceSheet) return [];
    return computeSheetRows(selectedSourceSheet, currentProject?.sheets || []);
  }, [selectedSourceSheet, currentProject?.sheets]);

  // ===== 엔티티 목록 파싱 (스탯 정의 기반) =====
  const entities = useMemo(() => {
    if (!selectedSourceSheet) return [];
    if (!idColumn || !nameColumn) return [];

    const colMap: Record<string, string> = {};
    for (const col of selectedSourceSheet.columns) {
      colMap[col.name] = col.id;
    }

    // 필수 컬럼 체크 (사용자가 선택한 컬럼)
    if (!colMap[idColumn] || !colMap[nameColumn]) return [];

    const result: EntityDefinition[] = [];

    for (let rowIndex = 0; rowIndex < selectedSourceSheet.rows.length; rowIndex++) {
      const cells = computedRows[rowIndex] || selectedSourceSheet.rows[rowIndex].cells;

      const id = String(cells[colMap[idColumn]] || '');
      const name = String(cells[colMap[nameColumn]] || '');
      if (!id || !name) continue;

      const baseStats: Record<string, number> = {};
      const growthCurves: Record<string, { curveType: CurveType; growthRate: number }> = {};

      // 스탯 정의에 따라 값 추출
      for (const stat of statDefinitions) {
        if (stat.sourceColumn && colMap[stat.sourceColumn]) {
          const value = Number(cells[colMap[stat.sourceColumn]] || 0);
          // 0 이상의 값만 포함 (음수는 제외)
          if (value >= 0) {
            baseStats[stat.name] = value;
            growthCurves[stat.name] = {
              curveType: stat.curveType,
              growthRate: stat.growthRate,
            };
          }
        }
      }

      // ID와 이름만 있으면 엔티티로 인식 (스탯이 없어도 됨)

      const maxLevel = colMap['최대레벨']
        ? Number(cells[colMap['최대레벨']] || 50)
        : 50;

      const entityType = colMap['타입']
        ? (String(cells[colMap['타입']] || 'character') as EntityDefinition['entityType'])
        : 'character';

      const tagsRaw = colMap['태그'] ? String(cells[colMap['태그']] || '') : '';
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined;

      result.push({
        id,
        name,
        entityType,
        baseStats,
        growthCurves,
        maxLevel,
        overrides: [],
        tags,
      });
    }

    return result;
  }, [selectedSourceSheet, computedRows, statDefinitions, idColumn, nameColumn]);

  // ===== 선택된 엔티티 =====
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    const entity = entities.find(e => e.id === selectedEntityId);
    if (!entity) return null;

    // 편집 중인 오버라이드 반영
    return {
      ...entity,
      overrides: editingOverrides,
      maxLevel: levelRange.max,
    };
  }, [selectedEntityId, entities, editingOverrides, levelRange.max]);

  // ===== 미리보기 데이터 =====
  const previewData = useMemo(() => {
    if (!selectedEntity) return [];
    const previewLevels = [1, 5, 10, Math.floor(levelRange.max / 2), levelRange.max];
    return generatePreviewData(selectedEntity, previewLevels);
  }, [selectedEntity, levelRange.max]);

  // ===== 곡선 미리보기 데이터 (오버라이드 반영) =====
  const curvePreviewData = useMemo(() => {
    if (!selectedEntity) return {};

    const result: Record<string, { level: number; value: number; isOverridden: boolean }[]> = {};

    for (const [statName, baseStat] of Object.entries(selectedEntity.baseStats)) {
      const curve = selectedEntity.growthCurves[statName];
      if (curve) {
        result[statName] = generateCurvePreviewData(
          baseStat,
          levelRange.max,
          curve.curveType,
          curve.growthRate,
          editingOverrides,  // 오버라이드 전달
          statName,          // 스탯명 전달
          interpolationType  // 보간 방식 전달
        );
      }
    }

    return result;
  }, [selectedEntity, levelRange.max, editingOverrides, interpolationType]);

  // ===== 사용 가능한 태그 목록 =====
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const entity of entities) {
      if (entity.tags) {
        entity.tags.forEach(tag => tagSet.add(tag));
      }
    }
    return Array.from(tagSet);
  }, [entities]);

  // ===== 필터링된 엔티티 목록 =====
  const filteredEntities = useMemo(() => {
    if (!tagFilter) return entities;
    return entities.filter(e => e.tags?.includes(tagFilter));
  }, [entities, tagFilter]);

  // ===== 시트 선택 =====
  const selectSourceSheet = useCallback((sheetId: string | null) => {
    setSelectedSourceSheetId(sheetId);
    // 시트 변경 시 초기화
    setIdColumn('');
    setNameColumn('');
    setLevelColumn('');
    setSelectedEntityId(null);
    setEditingOverrides([]);
    setTagFilter(null);
  }, []);

  // ===== 엔티티 선택 =====
  const selectEntity = useCallback((entityId: string | null) => {
    setSelectedEntityId(entityId);

    // 선택 시 해당 엔티티의 maxLevel로 범위 설정
    if (entityId) {
      const entity = entities.find(e => e.id === entityId);
      if (entity) {
        setLevelRange({ min: 1, max: entity.maxLevel });
        setEditingOverrides(entity.overrides || []);
      }
    } else {
      setEditingOverrides([]);
    }
  }, [entities]);

  // ===== 오버라이드 관리 =====
  const addOverride = useCallback((level: number) => {
    if (!selectedEntity) return;

    // 이미 해당 레벨에 오버라이드가 있으면 무시
    if (editingOverrides.some(o => o.level === level)) return;

    // 현재 레벨의 계산된 스탯을 기본값으로 사용
    const rows = generateLevelTableRows(selectedEntity);
    const row = rows.find(r => r.level === level);

    if (row) {
      setEditingOverrides([
        ...editingOverrides,
        { level, stats: { ...row.stats } }
      ].sort((a, b) => a.level - b.level));
    }
  }, [selectedEntity, editingOverrides]);

  const removeOverride = useCallback((level: number) => {
    setEditingOverrides(editingOverrides.filter(o => o.level !== level));
  }, [editingOverrides]);

  const updateOverride = useCallback((level: number, statName: string, value: number) => {
    setEditingOverrides(editingOverrides.map(o => {
      if (o.level === level) {
        return { ...o, stats: { ...o.stats, [statName]: value } };
      }
      return o;
    }));
  }, [editingOverrides]);


  // ===== 레벨 테이블 생성 =====
  const generateLevelTable = useCallback(async () => {
    if (!selectedEntity || !currentProject) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // 전체 레벨 테이블 생성 (오버라이드 반영)
      const entityWithOverrides = {
        ...selectedEntity,
        maxLevel: levelRange.max,
        overrides: editingOverrides,
      };
      const allRows = generateLevelTableRows(entityWithOverrides);

      // 시트 이름 생성
      const sheetName = sheetNamePattern.replace('{entity}', selectedEntity.name);

      // 스탯 이름 목록
      const statNames = Object.keys(selectedEntity.baseStats);

      if (outputMode === 'new-sheet') {
        // 새 시트 생성
        const sheetId = store.createSheet(currentProject.id, sheetName);
        setGenerationProgress(10);

        // store에서 최신 시트 가져오기
        let sheet = store.getSheet(currentProject.id, sheetId);
        if (sheet) {
          // 기존 컬럼 ID 가져오기
          const existingColIds = sheet.columns.map(c => c.id);

          // 새 컬럼 추가 (엔티티ID, 엔티티명, 레벨, 스탯들) - 커스텀 필드명 사용 (비어있으면 컬럼명)
          const idFieldName = exportFieldNames.entityId || idColumn || 'ID';
          const nameFieldName = exportFieldNames.entityName || nameColumn || t('fallbackName');
          const levelFieldName = exportFieldNames.level || levelColumn || t('fallbackLevel');

          store.addColumn(currentProject.id, sheetId, { name: idFieldName, type: 'general' });
          store.addColumn(currentProject.id, sheetId, { name: nameFieldName, type: 'general' });
          store.addColumn(currentProject.id, sheetId, { name: levelFieldName, type: 'general' });

          for (const statName of statNames) {
            const statDef = statDefinitions.find(s => s.name === statName);
            const fieldName = statDef?.exportName || statName;
            store.addColumn(currentProject.id, sheetId, { name: fieldName, type: 'general' });
          }

          // 기존 빈 컬럼 삭제
          for (const colId of existingColIds) {
            store.deleteColumn(currentProject.id, sheetId, colId);
          }

          setGenerationProgress(30);

          // store에서 최신 시트 다시 가져오기 (컬럼 추가 후)
          sheet = store.getSheet(currentProject.id, sheetId);
          if (sheet) {
            const colMap: Record<string, string> = {};
            for (const col of sheet.columns) {
              colMap[col.name] = col.id;
            }

            // 배치로 행 추가
            const batchSize = 50;
            for (let i = 0; i < allRows.length; i += batchSize) {
              const batch = allRows.slice(i, Math.min(i + batchSize, allRows.length));

              for (const levelRow of batch) {
                const cells: Record<string, number | string> = {};
                if (colMap[idFieldName]) cells[colMap[idFieldName]] = levelRow.entityId;
                if (colMap[nameFieldName]) cells[colMap[nameFieldName]] = levelRow.entityName;
                if (colMap[levelFieldName]) cells[colMap[levelFieldName]] = levelRow.level;

                for (const [statName, value] of Object.entries(levelRow.stats)) {
                  const statDef = statDefinitions.find(s => s.name === statName);
                  const fieldName = statDef?.exportName || statName;
                  if (colMap[fieldName]) {
                    cells[colMap[fieldName]] = value;
                  }
                }

                store.addRow(currentProject.id, sheetId, cells);
              }

              setGenerationProgress(30 + Math.floor((i / allRows.length) * 60));
            }
          }
        }

        setGenerationProgress(100);

        // 새 시트로 이동
        store.setCurrentSheet(sheetId);
      }
    } catch (error) {
      console.error('Level table generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedEntity, currentProject, levelRange.max, sheetNamePattern, outputMode, store, editingOverrides, exportFieldNames, statDefinitions, idColumn, nameColumn, levelColumn]);

  // ===== 모든 엔티티 레벨 테이블 생성 =====
  const generateAllLevelTables = useCallback(async () => {
    if (!currentProject || entities.length === 0) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];

        // 해당 엔티티의 레벨 테이블 생성
        const allRows = generateLevelTableRows(entity);
        const sheetName = sheetNamePattern.replace('{entity}', entity.name);
        const statNames = Object.keys(entity.baseStats);

        // 새 시트 생성
        const sheetId = store.createSheet(currentProject.id, sheetName);

        // store에서 최신 시트 가져오기
        let sheet = store.getSheet(currentProject.id, sheetId);
        if (sheet) {
          const existingColIds = sheet.columns.map(c => c.id);

          // 커스텀 필드명 사용 (비어있으면 컬럼명)
          const idFieldName = exportFieldNames.entityId || idColumn || 'ID';
          const nameFieldName = exportFieldNames.entityName || nameColumn || t('fallbackName');
          const levelFieldName = exportFieldNames.level || levelColumn || t('fallbackLevel');

          store.addColumn(currentProject.id, sheetId, { name: idFieldName, type: 'general' });
          store.addColumn(currentProject.id, sheetId, { name: nameFieldName, type: 'general' });
          store.addColumn(currentProject.id, sheetId, { name: levelFieldName, type: 'general' });

          for (const statName of statNames) {
            const statDef = statDefinitions.find(s => s.name === statName);
            const fieldName = statDef?.exportName || statName;
            store.addColumn(currentProject.id, sheetId, { name: fieldName, type: 'general' });
          }

          for (const colId of existingColIds) {
            store.deleteColumn(currentProject.id, sheetId, colId);
          }

          // store에서 최신 시트 다시 가져오기
          sheet = store.getSheet(currentProject.id, sheetId);
          if (sheet) {
            const colMap: Record<string, string> = {};
            for (const col of sheet.columns) {
              colMap[col.name] = col.id;
            }

            for (const levelRow of allRows) {
              const cells: Record<string, number | string> = {};
              if (colMap[idFieldName]) cells[colMap[idFieldName]] = levelRow.entityId;
              if (colMap[nameFieldName]) cells[colMap[nameFieldName]] = levelRow.entityName;
              if (colMap[levelFieldName]) cells[colMap[levelFieldName]] = levelRow.level;

              for (const [statName, value] of Object.entries(levelRow.stats)) {
                const statDef = statDefinitions.find(s => s.name === statName);
                const fieldName = statDef?.exportName || statName;
                if (colMap[fieldName]) {
                  cells[colMap[fieldName]] = value;
                }
              }

              store.addRow(currentProject.id, sheetId, cells);
            }
          }
        }

        setGenerationProgress(Math.floor(((i + 1) / entities.length) * 100));
      }
    } catch (error) {
      console.error('Bulk level-table generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [currentProject, entities, sheetNamePattern, store, exportFieldNames, statDefinitions, idColumn, nameColumn, levelColumn]);

  return {
    // 프로젝트 선택
    projects: store.projects,
    selectedProjectId: effectiveProjectId,
    selectProject,

    // 시트 선택
    availableSheets,
    selectedSourceSheetId,
    selectSourceSheet,
    availableColumns,

    // 컬럼 매핑
    idColumn,
    nameColumn,
    levelColumn,
    setIdColumn,
    setNameColumn,
    setLevelColumn,

    // 스탯 정의
    statDefinitions,
    setStatDefinitions,

    // 상태
    selectedEntityId,
    selectedEntity,
    entities,
    filteredEntities,
    editingOverrides,
    levelRange,
    previewData,
    curvePreviewData,
    outputMode,
    sheetNamePattern,
    isGenerating,
    generationProgress,
    interpolationType,
    tagFilter,
    availableTags,

    // 엔티티 선택
    selectEntity,

    // 레벨 범위
    setLevelRange,

    // 오버라이드 관리
    addOverride,
    removeOverride,
    updateOverride,

    // 출력 설정
    setOutputMode,
    setSheetNamePattern,
    exportFieldNames,
    setExportFieldNames,

    // 보간 방식
    setInterpolationType,

    // 태그 필터
    setTagFilter,

    // 생성 액션
    generateLevelTable,
    generateAllLevelTables,

    // 유틸리티
    curveTypes: CURVE_TYPES,
    defaultGrowthRates: DEFAULT_GROWTH_RATES,
  };
}
