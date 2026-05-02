'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, TrendingUp, Settings, Table2, Sliders, Check } from 'lucide-react';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';
import EmptyState from '@/components/ui/EmptyState';

import { useEntityDefinition } from './entity-definition/hooks/useEntityDefinition';
import SheetSelector from './SheetSelector';
import {
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
  complete,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  step?: string; // 예: "1/5"
  description?: string;
  /** 이 step 이 완료됐는지 — 완료 시 체크마크 + 색상 가득 (Progressive Disclosure 피드백) */
  complete?: boolean;
}) {
  const tStep = useTranslations('entityDefinition');
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
        style={{
          background: complete ? color : `${color}15`,
          transition: 'background 0.2s ease',
        }}
      >
        {complete ? (
          <Check className="w-4 h-4" style={{ color: 'white' }} strokeWidth={3} />
        ) : (
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {step && (
            <span
              className="text-caption font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                background: complete ? color : `${color}20`,
                color: complete ? 'white' : color,
              }}
            >
              {step}
            </span>
          )}
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: complete ? color : 'var(--text-tertiary)' }}
          >
            {title}
          </span>
          {complete && (
            <span className="text-caption" style={{ color }}>
              {tStep('stepDone')}
            </span>
          )}
        </div>
        {description && (
          <p className="text-caption mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="flex-1 h-px" style={{ background: complete ? color : 'var(--border-primary)', opacity: complete ? 0.3 : 1 }} />
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
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={Users}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-4 space-y-4 overflow-x-hidden scrollbar-slim"
      actions={
        <HelpToggle active={showHelp} onToggle={() => setShowHelp((v) => !v)} color={PANEL_COLOR} />
      }
    >
      <style>{hideSpinnerStyle}</style>

      <ToolPanelHint toolId="entityDefinition" title={t('hintTitle')} accentColor="#06b6d4">
        <p>{t.rich('hintP1', { strong: (chunks) => <strong>{chunks}</strong> })}</p>
        <p>{t('hintP2')}</p>
      </ToolPanelHint>

      {showHelp && <HelpPanel />}

      {/* 프로젝트 없을 때 — 가이드된 빈 상태 */}
      {!hasProjects && (
        <EmptyState
          icon={Users}
          title={t('noProjectTitle')}
          description={t('noProjectDesc')}
          size="compact"
        />
      )}

      {hasProjects && (
        <>
          <SectionDivider
            icon={Users}
            title={t('stepSourceTitle')}
            color={PANEL_COLOR}
            step="1/5"
            description={t('stepSourceDesc')}
            complete={!!selectedSourceSheetId}
          />

          <SheetSelector
            showProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={selectProject}
            selectedSheetId={selectedSourceSheetId}
            onSheetChange={(id) => selectSourceSheet(id || null)}
            label={t('sheetLabel')}
            color={PANEL_COLOR}
          />

          {/* 프로젝트 선택됐지만 시트 없을 때 */}
          {selectedProjectId && !hasSheets && (
            <p className="text-caption text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
              {t('noSheetInProject')}
            </p>
          )}
        </>
      )}

      {/* 시트가 선택된 경우에만 스탯 정의 및 엔티티 섹션 표시 */}
      {selectedSourceSheetId && (
        <>
          <SectionDivider
            icon={Table2}
            title={t('stepMappingTitle')}
            color="#3b82f6"
            step="2/5"
            description={t('stepMappingDesc')}
            complete={!!idColumn && !!nameColumn && !!levelColumn}
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
            title={t('stepStatsTitle')}
            color="#f59e0b"
            step="3/5"
            description={t('stepStatsDesc')}
            complete={statDefinitions.length > 0}
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
            description={t('stepEntityDesc')}
            complete={!!selectedEntityId}
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
            description={t('stepPreviewDesc')}
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
            description={t('stepFineTuneDesc')}
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
            description={t('stepExportDesc')}
            complete={previewData.length > 0}
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
