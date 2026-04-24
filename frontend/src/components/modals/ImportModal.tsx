'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { X, Upload, FileJson, AlertCircle, CheckCircle, Loader2, FolderOpen, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { importFromJSON, importSheetFromCSV } from '@/lib/storage';
import { importFromGameEngine, detectFormat, type ImportFormat, type ImportResult } from '@/lib/gameEngineImport';
import { detectImbalances, type ImbalanceIssue } from '@/lib/imbalanceDetector';
import type { Sheet, Column, Row, CellValue } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';

interface ImportModalProps {
  onClose: () => void;
}

// Import 타입
type ImportType = 'json' | 'csv' | ImportFormat;

// 형식 정보
const FORMAT_INFO: { id: ImportType; name: string; category: string; description: string; accept: string }[] = [
  { id: 'json', name: 'JSON', category: '기본', description: '프로젝트 백업 복원', accept: '.json' },
  { id: 'csv', name: 'CSV', category: '기본', description: '스프레드시트 가져오기', accept: '.csv' },
  { id: 'unity_json', name: 'Unity JSON', category: 'Unity', description: 'ScriptableObject JSON', accept: '.json' },
  { id: 'unity_cs', name: 'Unity C#', category: 'Unity', description: 'C# 클래스 필드 파싱', accept: '.cs' },
  { id: 'unreal_csv', name: 'DataTable CSV', category: 'Unreal', description: 'DataTable CSV 형식', accept: '.csv' },
  { id: 'unreal_h', name: 'Unreal Header', category: 'Unreal', description: 'UPROPERTY 필드 파싱', accept: '.h' },
  { id: 'godot_gd', name: 'GDScript', category: 'Godot', description: 'GDScript 변수 파싱', accept: '.gd' },
];

export default function ImportModal({ onClose }: ImportModalProps) {
  useEscapeKey(onClose);
  const t = useTranslations();
  const tImport = useTranslations('gameEngineImport');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    projects,
    currentProjectId,
    createSheet,
    addColumn,
    addRow,
    updateCell,
  } = useProjectStore();
  const setProjects = useProjectStore((state) => state.loadProjects);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 상태
  const [selectedFormat, setSelectedFormat] = useState<ImportType | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(currentProjectId);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [jsonPreview, setJsonPreview] = useState<{ projectCount: number; content: string } | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ columns: { name: string }[]; rows: { cells: Record<string, unknown> }[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // 파일 읽기
  const readFile = useCallback((file: File, format: ImportType | null) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      setImportError(null);

      const baseName = file.name.replace(/\.(json|csv|cs|gd|h)$/i, '');
      setSheetName(baseName);

      if (format === 'json') {
        try {
          const parsed = JSON.parse(content);
          const projectCount = Array.isArray(parsed) ? parsed.length : 1;
          setJsonPreview({ projectCount, content: JSON.stringify(parsed, null, 2).slice(0, 2000) });
          setPreviewResult(null);
          setCsvPreview(null);
        } catch {
          setImportError(t('project.importFailed'));
        }
      } else if (format === 'csv') {
        try {
          const result = importSheetFromCSV(content);
          setCsvPreview(result);
          setPreviewResult(null);
          setJsonPreview(null);
        } catch {
          setImportError(t('project.importFailed'));
        }
      } else if (format) {
        const result = importFromGameEngine(content, format as ImportFormat);
        setPreviewResult(result);
        setJsonPreview(null);
        setCsvPreview(null);
      } else {
        const detectedFormat = detectFormat(file.name, content);
        if (detectedFormat) {
          setSelectedFormat(detectedFormat);
          const result = importFromGameEngine(content, detectedFormat);
          setPreviewResult(result);
        }
      }
    };
    reader.readAsText(file);
    setFile(file);
  }, [t]);

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      readFile(droppedFile, selectedFormat);
    }
  }, [readFile, selectedFormat]);

  // 파일 선택
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      readFile(selectedFile, selectedFormat);
    }
  }, [readFile, selectedFormat]);

  // 형식 변경
  const handleFormatChange = (format: ImportType) => {
    setSelectedFormat(format);
    setPreviewResult(null);
    setJsonPreview(null);
    setCsvPreview(null);
    setImportError(null);
    setFile(null);
    setFileContent('');
    setImportSuccess(false);
  };

  // 프로젝트 선택 (다시 클릭하면 선택 해제)
  const handleProjectSelect = (projectId: string) => {
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setExpandedProjectId(null);
    } else {
      setSelectedProjectId(projectId);
      setExpandedProjectId(projectId);
    }
  };

  // Import 실행
  const handleImport = async () => {
    setIsImporting(true);
    setImportError(null);

    try {
      if (selectedFormat === 'json') {
        const imported = importFromJSON(fileContent);
        setProjects([...projects, ...imported]);
        setImportSuccess(true);
        setTimeout(() => onClose(), 1500);
      } else if (selectedFormat === 'csv') {
        if (!selectedProjectId || !csvPreview) {
          setImportError(t('sidebar.selectProjectFirst'));
          return;
        }

        const defaultSheetName = file?.name.replace(/\.(json|csv|cs|gd|h)$/i, '') || 'Imported';
        const sheetId = createSheet(selectedProjectId, sheetName.trim() || defaultSheetName);
        const columnIdMap = new Map<string, string>();

        csvPreview.columns.forEach((col, idx) => {
          const colId = addColumn(selectedProjectId, sheetId, {
            name: col.name,
            type: 'general',
            width: col.name.length > 10 ? 150 : 100,
          });
          columnIdMap.set(`col_${idx}`, colId);
        });

        for (const rowData of csvPreview.rows) {
          const rowId = addRow(selectedProjectId, sheetId);
          for (const [tempId, value] of Object.entries(rowData.cells)) {
            const colId = columnIdMap.get(tempId);
            if (colId && value !== undefined) {
              updateCell(selectedProjectId, sheetId, rowId, colId, value as string | number | null);
            }
          }
        }

        setImportSuccess(true);
        setTimeout(() => onClose(), 1500);
      } else if (previewResult?.success) {
        if (!selectedProjectId) {
          setImportError(t('sidebar.selectProjectFirst'));
          return;
        }

        const defaultSheetName = file?.name.replace(/\.(json|csv|cs|gd|h)$/i, '') || 'Imported';
        const sheetId = createSheet(selectedProjectId, sheetName.trim() || defaultSheetName);
        const columnIdMap = new Map<number, string>();

        previewResult.columns.forEach((col, idx) => {
          const colId = addColumn(selectedProjectId, sheetId, {
            name: col.name,
            type: col.type,
            width: col.width,
          });
          columnIdMap.set(idx, colId);
        });

        for (const rowData of previewResult.rows) {
          const rowId = addRow(selectedProjectId, sheetId);
          previewResult.columns.forEach((col, idx) => {
            const colId = columnIdMap.get(idx);
            if (colId) {
              const cellKeys = Object.keys(rowData.cells);
              const cellValue = rowData.cells[cellKeys[idx]];
              if (cellValue !== undefined && cellValue !== null) {
                updateCell(selectedProjectId, sheetId, rowId, colId, cellValue);
              }
            }
          });
        }

        setImportSuccess(true);
        setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportError(t('project.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  // 파일 accept
  const getAcceptTypes = () => {
    const formatInfo = FORMAT_INFO.find(f => f.id === selectedFormat);
    return formatInfo?.accept || '.json,.csv,.cs,.gd,.h';
  };

  // 프로젝트 필요 여부
  const needsProject = selectedFormat !== 'json' && selectedFormat !== null;

  // Import 가능 여부
  const canImport = () => {
    if (!file) return false;
    if (selectedFormat === 'json') return !!jsonPreview;
    if (selectedFormat === 'csv') return !!csvPreview && !!selectedProjectId;
    return previewResult?.success && !!selectedProjectId;
  };

  // 카테고리별 그룹화
  const formatsByCategory = FORMAT_INFO.reduce((acc, fmt) => {
    if (!acc[fmt.category]) acc[fmt.category] = [];
    acc[fmt.category].push(fmt);
    return acc;
  }, {} as Record<string, typeof FORMAT_INFO>);

  // Import 자동 진단 — preview 단계 시트로 변환 후 imbalanceDetector 실행
  const diagnosticIssues: ImbalanceIssue[] | null = useMemo(() => {
    const now = Date.now();
    let tempSheet: Sheet | null = null;

    if (csvPreview && csvPreview.columns.length > 0) {
      const columns: Column[] = csvPreview.columns.map((col, i) => ({
        id: `col_${i}`,
        name: col.name,
        type: 'general',
      }));
      const rows: Row[] = csvPreview.rows.map((r, i) => ({
        id: `row_${i}`,
        cells: r.cells as Record<string, CellValue>,
      }));
      tempSheet = { id: 'preview', name: 'preview', columns, rows, createdAt: now, updatedAt: now };
    } else if (previewResult?.success && previewResult.columns.length > 0) {
      const columns: Column[] = previewResult.columns.map((col, i) => ({
        id: `col_${i}`,
        name: col.name,
        type: col.type,
      }));
      const rows: Row[] = previewResult.rows.map((r, i) => {
        const cellKeys = Object.keys(r.cells);
        const cells: Record<string, CellValue> = {};
        previewResult.columns.forEach((_, colIdx) => {
          const value = r.cells[cellKeys[colIdx]];
          if (value !== undefined) cells[`col_${colIdx}`] = value as CellValue;
        });
        return { id: `row_${i}`, cells };
      });
      tempSheet = { id: 'preview', name: 'preview', columns, rows, createdAt: now, updatedAt: now };
    }

    if (!tempSheet || tempSheet.rows.length < 3) return null;

    try {
      return detectImbalances(tempSheet);
    } catch {
      return null;
    }
  }, [csvPreview, previewResult]);

  const diagnosticSummary = useMemo(() => {
    if (!diagnosticIssues) return null;
    return {
      critical: diagnosticIssues.filter((i) => i.severity === 'critical').length,
      warning: diagnosticIssues.filter((i) => i.severity === 'warning').length,
      info: diagnosticIssues.filter((i) => i.severity === 'info').length,
      top: diagnosticIssues.slice(0, 3),
    };
  }, [diagnosticIssues]);

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-4">
      <div
        className="w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col animate-scaleIn rounded-2xl shadow-2xl"
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
              style={{ background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' }}
            >
              <Upload className="w-5 h-5" style={{ color: '#10b981' }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('common.import')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 왼쪽 패널 */}
          <div
            className="w-80 flex-shrink-0 border-r flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
          >
            <div className="flex-1 overflow-y-auto">
              {/* Step 1: 형식 선택 */}
              <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#10b981', color: 'white' }}>1</div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('export.selectFormat')}</span>
                </div>

                <div className="space-y-3">
                  {Object.entries(formatsByCategory).map(([category, formats]) => (
                    <div key={category}>
                      <div className="text-xs font-medium mb-1.5 px-1" style={{ color: 'var(--text-tertiary)' }}>
                        {category}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {formats.map(fmt => {
                          const isSelected = selectedFormat === fmt.id;
                          return (
                            <button
                              key={fmt.id}
                              onClick={() => handleFormatChange(fmt.id)}
                              className="px-3 py-2 rounded-lg text-left transition-all"
                              style={{
                                background: isSelected ? '#10b981' : 'var(--bg-primary)',
                                border: `1px solid ${isSelected ? 'transparent' : 'var(--border-primary)'}`,
                              }}
                            >
                              <div className="text-sm font-medium" style={{ color: isSelected ? 'white' : 'var(--text-primary)' }}>
                                {fmt.name}
                              </div>
                              <div className="text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                                {fmt.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2: 프로젝트 선택 (JSON 제외) */}
              {needsProject && (
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#10b981', color: 'white' }}>2</div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('import.selectProject')}</span>
                  </div>

                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}
                  >
                    <div className="max-h-40 overflow-y-auto">
                      {projects.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sidebar.noProjects')}
                        </div>
                      ) : (
                        projects.map(project => {
                          const isSelected = selectedProjectId === project.id;
                          return (
                            <button
                              key={project.id}
                              onClick={() => handleProjectSelect(project.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
                              style={{ background: isSelected ? 'var(--bg-hover)' : 'transparent' }}
                            >
                              {isSelected ? (
                                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} />
                              ) : (
                                <FolderOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                              )}
                              <span className="text-sm truncate flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
                                {project.name}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {project.sheets?.length || 0}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 시트 이름 (선택사항) */}
                  {selectedProjectId && (
                    <div className="mt-3">
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        {tImport('newSheetName')} <span style={{ color: 'var(--text-quaternary)' }}>({t('common.optional')})</span>
                      </label>
                      <input
                        type="text"
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                        placeholder={file ? file.name.replace(/\.(json|csv|cs|gd|h)$/i, '') : t('import.useFileName')}
                        className="w-full input-base focus:outline-none"
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: 파일 업로드 */}
              {selectedFormat && (needsProject ? selectedProjectId : true) && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#10b981', color: 'white' }}>
                      {needsProject ? '3' : '2'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('import.uploadFile')}</span>
                  </div>

                  <div
                    className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer`}
                    style={{
                      borderColor: dragOver ? '#10b981' : 'var(--border-primary)',
                      background: dragOver ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-primary)'
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAcceptTypes()}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileJson className="w-5 h-5" style={{ color: '#10b981' }} />
                        <div className="text-left">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {file.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {tImport('clickToSelectOther')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 mx-auto" style={{ color: 'var(--text-tertiary)' }} />
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {tImport('dragOrClick')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {getAcceptTypes()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 가져오기 버튼 */}
            <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
              <button
                onClick={handleImport}
                disabled={!canImport() || isImporting || importSuccess}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#10b981', color: 'white' }}
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{tImport('importing')}</>
                ) : importSuccess ? (
                  <><CheckCircle className="w-4 h-4" />{tImport('importComplete')}</>
                ) : (
                  <><Upload className="w-4 h-4" />{t('common.import')}</>
                )}
              </button>
            </div>
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {(jsonPreview || csvPreview || previewResult || importError) ? (
              <div className="flex-1 overflow-auto p-5">
                {importError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                    <AlertCircle className="w-5 h-5" style={{ color: 'var(--error)' }} />
                    <span className="text-sm" style={{ color: 'var(--error)' }}>{importError}</span>
                  </div>
                )}

                {/* 자동 진단 카드 — 이슈 있으면 요약 표시 */}
                {diagnosticSummary && (diagnosticSummary.critical + diagnosticSummary.warning + diagnosticSummary.info > 0) && (
                  <div
                    className="mb-4 p-4 rounded-xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4" style={{ color: '#f59e0b' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {t('import.autoDiagnostic')}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-3 text-xs">
                      {diagnosticSummary.critical > 0 && (
                        <span
                          className="px-2 py-1 rounded font-medium"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
                        >
                          {t('import.diagCritical', { count: diagnosticSummary.critical })}
                        </span>
                      )}
                      {diagnosticSummary.warning > 0 && (
                        <span
                          className="px-2 py-1 rounded font-medium"
                          style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}
                        >
                          {t('import.diagWarning', { count: diagnosticSummary.warning })}
                        </span>
                      )}
                      {diagnosticSummary.info > 0 && (
                        <span
                          className="px-2 py-1 rounded font-medium"
                          style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                        >
                          {t('import.diagInfo', { count: diagnosticSummary.info })}
                        </span>
                      )}
                    </div>
                    <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                      {diagnosticSummary.top.map((issue) => (
                        <li key={issue.id}>• {issue.title}</li>
                      ))}
                    </ul>
                    <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                      {t('import.diagDetailHint')}
                    </div>
                  </div>
                )}
                {diagnosticSummary && diagnosticSummary.critical + diagnosticSummary.warning + diagnosticSummary.info === 0 && (
                  <div
                    className="mb-4 flex items-center gap-2 text-xs p-2 rounded"
                    style={{ color: '#10b981' }}
                  >
                    <CheckCircle className="w-4 h-4" /> {t('import.noIssuesDetected')}
                  </div>
                )}

                {/* JSON 미리보기 */}
                {jsonPreview && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('project.importSuccess', { count: jsonPreview.projectCount })}
                      </span>
                    </div>
                    <pre
                      className="p-4 rounded-xl text-xs overflow-auto max-h-96"
                      style={{ background: isDark ? '#1e1e2e' : '#f5f5f5', color: 'var(--text-secondary)' }}
                    >
                      {jsonPreview.content}
                      {jsonPreview.content.length >= 2000 && '...'}
                    </pre>
                  </div>
                )}

                {/* CSV 미리보기 */}
                {csvPreview && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {tImport('detected', { columns: csvPreview.columns.length, rows: csvPreview.rows.length })}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-primary)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--bg-tertiary)' }}>
                            {csvPreview.columns.map((col, i) => (
                              <th
                                key={i}
                                className="px-3 py-2 text-left font-medium whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}
                              >
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.slice(0, 10).map((row, rowIdx) => (
                            <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                              {csvPreview.columns.map((_, colIdx) => {
                                const value = row.cells[`col_${colIdx}`];
                                return (
                                  <td key={colIdx} className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                    {value !== null && value !== undefined ? String(value) : ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvPreview.rows.length > 10 && (
                      <div className="text-xs text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
                        +{csvPreview.rows.length - 10}개 행 더 있음
                      </div>
                    )}
                  </div>
                )}

                {/* 게임 엔진 미리보기 */}
                {previewResult && (
                  <div>
                    {previewResult.success ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {tImport('detected', { columns: previewResult.columns.length, rows: previewResult.rows.length })}
                          </span>
                        </div>
                        {previewResult.warnings?.map((warning, i) => (
                          <div key={i} className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                            <span className="text-xs" style={{ color: 'var(--warning)' }}>{warning}</span>
                          </div>
                        ))}
                        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-primary)' }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: 'var(--bg-tertiary)' }}>
                                {previewResult.columns.map((col, i) => (
                                  <th
                                    key={i}
                                    className="px-3 py-2 text-left font-medium whitespace-nowrap"
                                    style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}
                                  >
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewResult.rows.slice(0, 10).map((row, rowIdx) => (
                                <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                  {previewResult.columns.map((col, colIdx) => {
                                    const cellKeys = Object.keys(row.cells);
                                    const value = row.cells[cellKeys[colIdx]];
                                    return (
                                      <td key={colIdx} className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                        {value !== null && value !== undefined ? String(value) : ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {previewResult.rows.length > 10 && (
                          <div className="text-xs text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
                            +{previewResult.rows.length - 10}개 행 더 있음
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" style={{ color: 'var(--error)' }} />
                        <span className="text-sm" style={{ color: 'var(--error)' }}>{previewResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* 빈 상태 */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <Upload className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-base font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('import.selectFormatPrompt')}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {t('import.selectFormatDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
