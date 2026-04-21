'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, TrendingUp, Settings, Table2, Sliders } from 'lucide-react';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import EmptyState from '@/components/ui/EmptyState';

import { useEntityDefinition } from './entity-definition/hooks/useEntityDefinition';
import {
  SheetSelector,
  ColumnMappingSelector,
  StatDefinitionEditor,
  EntitySelector,
  CurvePreview,
  LevelRangeSelector,
  OverrideEditor,
  PreviewTable,
  GenerationOptions,
  InterpolationTypeSelector,
  TagFilter,
  HelpPanel,
} from './entity-definition/components';

const PANEL_COLOR = '#06b6d4';

// number input spinner 숨기는 스타일
const hideSpinnerStyle = `
  .hide-spinner::-webkit-outer-spin-button,
  .hide-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .hide-spinner[type=number] {
    -moz-appearance: textfield;
  }
`;

// 섹션 구분선 — 단계 번호 + 한 줄 설명
function SectionDivider({
  icon: Icon,
  title,
  color,
  step,
  description,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  step?: string; // 예: "1/5"
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {step && (
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${color}20`, color }}
            >
              {step}
            </span>
          )}
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {title}
          </span>
        </div>
        {description && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
    </div>
  );
}

interface EntityDefinitionProps {
  onClose?: () => void;
}

export default function EntityDefinition({ onClose }: EntityDefinitionProps) {
  const t = useTranslations('entityDefinition');
  const [showHelp, setShowHelp] = useState(false);

  const {
    // 프로젝트 선택
    projects,
    selectedProjectId,
    selectProject,
    // 시트 선택
    availableSheets,
    selectedSourceSheetId,
    selectSourceSheet,
    availableColumns,
    idColumn,
    nameColumn,
    levelColumn,
    setIdColumn,
    setNameColumn,
    setLevelColumn,
    statDefinitions,
    setStatDefinitions,
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
    selectEntity,
    setLevelRange,
    addOverride,
    removeOverride,
    updateOverride,
    setOutputMode,
    setSheetNamePattern,
    exportFieldNames,
    setExportFieldNames,
    setInterpolationType,
    setTagFilter,
    generateLevelTable,
    generateAllLevelTables,
  } = useEntityDefinition();

  const statNames = selectedEntity ? Object.keys(selectedEntity.baseStats) : [];
  const hasProjects = projects.length > 0;
  const hasSheets = availableSheets.length > 0;

  return (
    <PanelShell
      title="엔티티 정의"
      subtitle="시트 → 엔티티 → 레벨 테이블 자동 생성"
      icon={Users}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-4 space-y-4 overflow-x-hidden scrollbar-slim"
      actions={
        <HelpToggle active={showHelp} onToggle={() => setShowHelp((v) => !v)} color={PANEL_COLOR} />
      }
    >
      <style>{hideSpinnerStyle}</style>

      {showHelp && <HelpPanel />}

      {/* 프로젝트 없을 때 — 가이드된 빈 상태 */}
      {!hasProjects && (
        <EmptyState
          icon={Users}
          title="프로젝트가 없습니다"
          description="왼쪽 사이드바에서 프로젝트를 먼저 만들어주세요."
          size="compact"
        />
      )}

      {hasProjects && (
        <>
          <SectionDivider
            icon={Users}
            title="소스 선택"
            color={PANEL_COLOR}
            step="1/5"
            description="엔티티 데이터가 있는 시트를 고릅니다"
          />

          <SheetSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            sheets={availableSheets}
            selectedSheetId={selectedSourceSheetId}
            onProjectSelect={selectProject}
            onSheetSelect={selectSourceSheet}
          />

          {/* 프로젝트 선택됐지만 시트 없을 때 */}
          {selectedProjectId && !hasSheets && (
            <p className="text-[11px] text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
              선택한 프로젝트에 시트가 없습니다. 왼쪽에서 시트를 만들어주세요.
            </p>
          )}
        </>
      )}

      {/* 시트가 선택된 경우에만 스탯 정의 및 엔티티 섹션 표시 */}
      {selectedSourceSheetId && (
        <>
          <SectionDivider
            icon={Table2}
            title="컬럼 매핑"
            color="#3b82f6"
            step="2/5"
            description="ID·이름·레벨 컬럼이 무엇인지 지정"
          />

          <ColumnMappingSelector
            availableColumns={availableColumns}
            idColumn={idColumn}
            nameColumn={nameColumn}
            levelColumn={levelColumn}
            onIdColumnChange={setIdColumn}
            onNameColumnChange={setNameColumn}
            onLevelColumnChange={setLevelColumn}
            exportFieldNames={exportFieldNames}
            onExportFieldNamesChange={setExportFieldNames}
          />

          <SectionDivider
            icon={Sliders}
            title="스탯 정의"
            color="#f59e0b"
            step="3/5"
            description="HP/ATK 등 스탯별 소스 컬럼과 성장 곡선 설정"
          />

          <StatDefinitionEditor
            stats={statDefinitions}
            availableColumns={availableColumns}
            onChange={setStatDefinitions}
          />

          <SectionDivider
            icon={Users}
            title={t('sectionEntity')}
            color="#5a9cf5"
            step="4/5"
            description="레벨 테이블을 만들 개체(캐릭터·몬스터) 선택"
          />

          <TagFilter
            tags={availableTags}
            selectedTag={tagFilter}
            onSelect={setTagFilter}
          />

          <EntitySelector
            entities={filteredEntities}
            selectedEntityId={selectedEntityId}
            onSelect={selectEntity}
            isColumnMapped={!!(idColumn && nameColumn)}
          />
        </>
      )}

      {/* 엔티티가 선택된 경우에만 나머지 섹션 표시 */}
      {selectedEntity && (
        <>
          <SectionDivider
            icon={TrendingUp}
            title={t('sectionGrowth')}
            color="#22c55e"
            description="선택한 엔티티의 레벨별 스탯 곡선 미리보기"
          />

          <CurvePreview
            entity={selectedEntity}
            curveData={curvePreviewData}
            overrides={editingOverrides}
          />

          <LevelRangeSelector
            levelRange={levelRange}
            onRangeChange={setLevelRange}
            maxLimit={200}
          />

          <SectionDivider
            icon={Settings}
            title={t('sectionOverride')}
            color="#f59e0b"
            description="특정 레벨의 스탯을 직접 지정해 곡선 미세 조정"
          />

          <InterpolationTypeSelector
            value={interpolationType}
            onChange={setInterpolationType}
          />

          <OverrideEditor
            entity={selectedEntity}
            overrides={editingOverrides}
            onAdd={addOverride}
            onRemove={removeOverride}
            onUpdate={updateOverride}
            maxLevel={levelRange.max}
          />

          <SectionDivider
            icon={Table2}
            title={t('sectionGenerate')}
            color="#9179f2"
            step="5/5"
            description="최종 레벨 테이블을 새 시트로 저장"
          />

          <PreviewTable
            previewData={previewData}
            statNames={statNames}
          />

          <GenerationOptions
            outputMode={outputMode}
            onOutputModeChange={setOutputMode}
            sheetNamePattern={sheetNamePattern}
            onSheetNamePatternChange={setSheetNamePattern}
            onGenerate={generateLevelTable}
            onGenerateAll={generateAllLevelTables}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            entityCount={entities.length}
            selectedEntityName={selectedEntity.name}
            rowCount={levelRange.max - levelRange.min + 1}
          />
        </>
      )}
    </PanelShell>
  );
}
