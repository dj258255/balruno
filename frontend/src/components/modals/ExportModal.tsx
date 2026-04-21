'use client';

import { useState } from 'react';
import { X, Download, Code, FileCode, Copy, Check, FileJson, FileType, FileText, Database, FolderOpen, Square, CheckSquare, ChevronRight, Maximize2, Minimize2, Settings2, ChevronDown } from 'lucide-react';
import type { Sheet } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { exportForGameEngine, EXPORT_FORMATS, type ExportFormat } from '@/lib/gameEngineExport';
import { exportToJSON, exportSheetToCSV } from '@/lib/storage';
import { downloadFile } from '@/lib/utils';
import { isEngineExportable, resolveSheetKind } from '@/lib/sheetKind';
import { SheetKindBadge } from '@/components/sheet/SheetKindBadge';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 토큰 배경색 제거
function removeTokenBackgrounds(style: Record<string, React.CSSProperties>): Record<string, React.CSSProperties> {
  const newStyle: Record<string, React.CSSProperties> = {};
  for (const [key, value] of Object.entries(style)) {
    newStyle[key] = { ...value, background: 'transparent', backgroundColor: 'transparent' };
  }
  return newStyle;
}

interface ExportModalProps {
  onClose: () => void;
}

// 파일 확장자에서 언어 추출
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'cs': return 'csharp';
    case 'cpp':
    case 'h': return 'cpp';
    case 'json': return 'json';
    case 'gd': return 'gdscript';
    case 'tres': return 'ini';
    case 'csv': return 'csv';
    default: return 'text';
  }
}

// 파일 아이콘 컴포넌트
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson className="w-4 h-4" />;
  if (ext === 'csv') return <FileText className="w-4 h-4" />;
  if (ext === 'cs' || ext === 'cpp' || ext === 'h' || ext === 'gd') return <FileCode className="w-4 h-4" />;
  return <FileType className="w-4 h-4" />;
}

// Export 타입
type ExportType = 'json' | 'csv' | ExportFormat;

// 형식 정보
const FORMAT_INFO: { id: ExportType; name: string; category: string; description: string; icon: 'database' | 'file' | 'code'; color: string }[] = [
  { id: 'json', name: 'JSON', category: '기본', description: '프로젝트 백업/복원', icon: 'database', color: '#3b82f6' },
  { id: 'csv', name: 'CSV', category: '기본', description: '스프레드시트 호환', icon: 'file', color: '#22c55e' },
  { id: 'unity_scriptable', name: 'ScriptableObject', category: 'Unity', description: 'SO 클래스 + JSON', icon: 'code', color: '#000000' },
  { id: 'unity_json', name: 'JSON Only', category: 'Unity', description: 'JsonUtility 호환', icon: 'code', color: '#000000' },
  { id: 'unreal_datatable', name: 'DataTable', category: 'Unreal', description: '구조체 + CSV', icon: 'code', color: '#0E1128' },
  { id: 'unreal_struct', name: 'Struct Only', category: 'Unreal', description: 'USTRUCT 헤더', icon: 'code', color: '#0E1128' },
  { id: 'godot_resource', name: 'Resource', category: 'Godot', description: 'Resource + JSON', icon: 'code', color: '#478CBF' },
];

export default function ExportModal({ onClose }: ExportModalProps) {
  useEscapeKey(onClose);
  const t = useTranslations();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { projects, currentProjectId, currentSheetId, updateSheet } = useProjectStore();

  // 상태
  const [selectedFormat, setSelectedFormat] = useState<ExportType | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>(currentSheetId ? [currentSheetId] : []);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(currentProjectId);
  const [classNames, setClassNames] = useState<Record<string, string>>({});  // sheetId -> className
  const [excludedColumns, setExcludedColumns] = useState<Record<string, Set<string>>>({});  // sheetId -> excluded columnIds
  const [previewFiles, setPreviewFiles] = useState<{ filename: string; content: string; type: string }[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState<string | null>(null);  // 컬럼 설정 표시할 시트 ID
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isCodeFullscreen, setIsCodeFullscreen] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const sheets = selectedProject?.sheets || [];
  const selectedSheets = sheets.filter(s => selectedSheetIds.includes(s.id));

  // 게임 엔진 포맷인지 — 엔진 포맷은 game-data 시트만 export 가능
  const isEngineFormat = (format: ExportType | null): boolean =>
    !!format && format !== 'json' && format !== 'csv';

  // 현재 선택된 포맷 기준으로 이 시트를 export 할 수 있는지
  const isSheetExportableForFormat = (sheet: Sheet): boolean => {
    if (!isEngineFormat(selectedFormat)) return true;
    return isEngineExportable(sheet);
  };

  // 형식 선택 — 엔진 포맷 전환 시 비게임데이터 시트 자동 제거
  const handleSelectFormat = (format: ExportType) => {
    setSelectedFormat(format);
    setPreviewFiles([]);
    setExpandedFile(null);
    setIsGenerated(false);

    if (isEngineFormat(format)) {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (project) {
        const still = selectedSheetIds.filter((id) => {
          const s = project.sheets.find((sh) => sh.id === id);
          return s ? isEngineExportable(s) : false;
        });
        if (still.length !== selectedSheetIds.length) setSelectedSheetIds(still);
      }
    }
  };

  // 프로젝트 확장/축소 토글
  const handleProjectToggle = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
    } else {
      setExpandedProjectId(projectId);
      setSelectedProjectId(projectId);
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const eligible = project.sheets.filter((s) => isSheetExportableForFormat(s));
        setSelectedSheetIds(eligible.map((s) => s.id));
      }
    }
    setPreviewFiles([]);
    setIsGenerated(false);
  };

  // 시트 선택 토글 — export 불가 시트는 클릭 차단
  const handleSheetToggle = (sheetId: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const sheet = project?.sheets.find((s) => s.id === sheetId);
    if (sheet && !isSheetExportableForFormat(sheet)) return;

    if (selectedProjectId !== projectId) {
      setSelectedProjectId(projectId);
      setExpandedProjectId(projectId);
      setSelectedSheetIds([sheetId]);
    } else {
      setSelectedSheetIds(prev =>
        prev.includes(sheetId)
          ? prev.filter(id => id !== sheetId)
          : [...prev, sheetId]
      );
    }
    setPreviewFiles([]);
    setIsGenerated(false);
  };

  // 전체 선택/해제 — 엔진 포맷이면 exportable 만 대상
  const handleSelectAllSheets = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const eligible = project.sheets.filter((s) => isSheetExportableForFormat(s));

    if (selectedProjectId !== projectId) {
      setSelectedProjectId(projectId);
      setExpandedProjectId(projectId);
      setSelectedSheetIds(eligible.map(s => s.id));
    } else {
      const allSelected = eligible.length > 0 && eligible.every(s => selectedSheetIds.includes(s.id));
      setSelectedSheetIds(allSelected ? [] : eligible.map(s => s.id));
    }
    setPreviewFiles([]);
    setIsGenerated(false);
  };

  // 컬럼 제외 토글
  const handleColumnToggle = (sheetId: string, columnId: string) => {
    setExcludedColumns(prev => {
      const current = prev[sheetId] || new Set();
      const newSet = new Set(current);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
      } else {
        newSet.add(columnId);
      }
      return { ...prev, [sheetId]: newSet };
    });
    setPreviewFiles([]);
    setIsGenerated(false);
  };

  // 컬럼 전체 선택/해제
  const handleSelectAllColumns = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const excluded = excludedColumns[sheetId] || new Set();
    const allExcluded = sheet.columns.every(col => excluded.has(col.id));

    if (allExcluded) {
      // 전체 선택 (제외 해제)
      setExcludedColumns(prev => ({ ...prev, [sheetId]: new Set() }));
    } else {
      // 전체 제외
      setExcludedColumns(prev => ({
        ...prev,
        [sheetId]: new Set(sheet.columns.map(c => c.id))
      }));
    }
    setPreviewFiles([]);
    setIsGenerated(false);
  };

  // 시트 데이터에서 제외된 컬럼 필터링
  const getFilteredSheet = (sheet: Sheet): Sheet => {
    const excluded = excludedColumns[sheet.id] || new Set();
    if (excluded.size === 0) return sheet;

    return {
      ...sheet,
      columns: sheet.columns.filter(col => !excluded.has(col.id)),
      rows: sheet.rows.map(row => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).filter(([colId]) => !excluded.has(colId))
        )
      }))
    };
  };

  // 클래스명 변경 (시트별) - 바로 시트에 저장
  const handleClassNameChange = (sheetId: string, value: string) => {
    setClassNames(prev => ({ ...prev, [sheetId]: value }));
    setPreviewFiles([]);
    setIsGenerated(false);

    // 시트에 바로 저장
    const project = projects.find(p => p.sheets.some(s => s.id === sheetId));
    if (project) {
      updateSheet(project.id, sheetId, { exportClassName: value.trim() || undefined });
    }
  };

  // 시트의 클래스명 가져오기 (입력값 > 저장된 값 > 기본값)
  const getClassName = (sheet: { id: string; name: string; exportClassName?: string }) => {
    if (classNames[sheet.id]) return classNames[sheet.id];
    if (sheet.exportClassName) return sheet.exportClassName;
    // 기본값: 영문/숫자만 추출
    return sheet.name.replace(/[^a-zA-Z0-9]/g, '') || 'Data';
  };

  // C# 유효한 클래스명인지 검사
  const isValidClassName = (name: string) => {
    if (!name) return false;
    // 첫 글자는 영문 또는 언더스코어, 나머지는 영문/숫자/언더스코어
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  // 내보내기 파일 생성
  const handleGenerate = () => {
    if (!selectedFormat) return;

    const files: { filename: string; content: string; type: string }[] = [];

    if (selectedFormat === 'json') {
      if (selectedProjectId && selectedSheetIds.length > 0) {
        // 선택된 시트만
        const projectToExport = { ...selectedProject!, sheets: selectedSheets };
        const json = JSON.stringify([projectToExport], null, 2);
        const filename = `${selectedProject!.name}-${new Date().toISOString().slice(0, 10)}.json`;
        files.push({ filename, content: json, type: 'application/json' });
      } else if (selectedProjectId) {
        // 프로젝트 전체
        const json = JSON.stringify([selectedProject!], null, 2);
        const filename = `${selectedProject!.name}-${new Date().toISOString().slice(0, 10)}.json`;
        files.push({ filename, content: json, type: 'application/json' });
      } else {
        // 모든 프로젝트
        const json = exportToJSON(projects);
        const filename = `balruno-${new Date().toISOString().slice(0, 10)}.json`;
        files.push({ filename, content: json, type: 'application/json' });
      }
    } else if (selectedFormat === 'csv') {
      for (const sheet of selectedSheets) {
        const filteredSheet = getFilteredSheet(sheet);
        const csv = exportSheetToCSV(filteredSheet);
        const projectName = selectedProject?.name || 'project';
        const filename = `${projectName}-${sheet.name}.csv`;
        files.push({ filename, content: csv, type: 'text/csv' });
      }
    } else {
      for (const sheet of selectedSheets) {
        const filteredSheet = getFilteredSheet(sheet);
        const sheetClassName = getClassName(sheet);
        const exportedFiles = exportForGameEngine(filteredSheet, selectedFormat as ExportFormat, {
          className: sheetClassName,
          project: selectedProject
        });
        files.push(...exportedFiles);
      }
    }

    setPreviewFiles(files);
    if (files.length > 0) setExpandedFile(files[0].filename);
    setIsGenerated(true);
  };

  // 파일 다운로드
  const handleDownload = (file: { filename: string; content: string; type: string }) => {
    downloadFile(file.content, file.filename, file.type);
  };

  // 모든 파일 다운로드
  const handleDownloadAll = () => {
    for (const file of previewFiles) {
      downloadFile(file.content, file.filename, file.type);
    }
  };

  // 복사
  const handleCopy = async (filename: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(filename);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedFile(filename);
      setTimeout(() => setCopiedFile(null), 2000);
    }
  };

  // 생성 가능 여부
  const canGenerate = () => {
    if (!selectedFormat) return false;
    if (selectedFormat === 'json') return true; // JSON은 항상 가능 (전체 또는 선택)
    return selectedSheetIds.length > 0;
  };

  // 선택된 형식 정보
  const selectedFormatInfo = FORMAT_INFO.find(f => f.id === selectedFormat);

  // 게임 엔진 형식인지
  const isGameEngineFormat = selectedFormat && !['json', 'csv'].includes(selectedFormat);

  // 카테고리별 그룹화
  const formatsByCategory = FORMAT_INFO.reduce((acc, fmt) => {
    if (!acc[fmt.category]) acc[fmt.category] = [];
    acc[fmt.category].push(fmt);
    return acc;
  }, {} as Record<string, typeof FORMAT_INFO>);

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
              style={{ background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)' }}
            >
              <Download className="w-5 h-5" style={{ color: '#6366f1' }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('common.export')}
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
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--primary-blue)', color: 'white' }}>1</div>
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
                              onClick={() => handleSelectFormat(fmt.id)}
                              className="px-3 py-2 rounded-lg text-left transition-all"
                              style={{
                                background: isSelected ? 'var(--primary-blue)' : 'var(--bg-primary)',
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

              {/* Step 2: 데이터 선택 */}
              {selectedFormat && (
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--primary-blue)', color: 'white' }}>2</div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('export.selectData')}</span>
                  </div>

                  {/* JSON 전체 내보내기 옵션 */}
                  {selectedFormat === 'json' && (
                    <button
                      onClick={() => {
                        setSelectedProjectId(null);
                        setSelectedSheetIds([]);
                        setExpandedProjectId(null);
                        setPreviewFiles([]);
                        setIsGenerated(false);
                      }}
                      className="w-full mb-2 px-3 py-2 rounded-lg text-left transition-all flex items-center gap-2"
                      style={{
                        background: !selectedProjectId ? 'var(--primary-blue)' : 'var(--bg-primary)',
                        border: `1px solid ${!selectedProjectId ? 'transparent' : 'var(--border-primary)'}`,
                      }}
                    >
                      <Database className="w-4 h-4" style={{ color: !selectedProjectId ? 'white' : 'var(--text-tertiary)' }} />
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: !selectedProjectId ? 'white' : 'var(--text-primary)' }}>
                          {t('export.allProjects')}
                        </div>
                        <div className="text-xs" style={{ color: !selectedProjectId ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                          {projects.length}개 프로젝트 전체
                        </div>
                      </div>
                      {!selectedProjectId && <Check className="w-4 h-4 text-white" />}
                    </button>
                  )}

                  {/* 프로젝트/시트 목록 */}
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {projects.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sidebar.noProjects')}
                        </div>
                      ) : (
                        projects.map(project => {
                          const isExpanded = expandedProjectId === project.id;
                          const projectSheets = project.sheets || [];
                          const selectedCount = projectSheets.filter(s => selectedSheetIds.includes(s.id)).length;
                          const allSelected = selectedCount === projectSheets.length && projectSheets.length > 0;

                          return (
                            <div key={project.id}>
                              <div
                                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                                style={{ background: isExpanded ? 'var(--bg-hover)' : 'transparent' }}
                              >
                                {/* 전체선택 체크박스 */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectAllSheets(project.id); }}
                                  className="shrink-0"
                                >
                                  {allSelected ? (
                                    <CheckSquare className="w-4 h-4" style={{ color: 'var(--primary-blue)' }} />
                                  ) : selectedCount > 0 && selectedProjectId === project.id ? (
                                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{ borderColor: 'var(--primary-blue)', background: 'var(--primary-blue)' }}>
                                      <div className="w-2 h-0.5 bg-white rounded" />
                                    </div>
                                  ) : (
                                    <Square className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                  )}
                                </button>

                                {/* 프로젝트 정보 */}
                                <button
                                  onClick={() => handleProjectToggle(project.id)}
                                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                                >
                                  <ChevronRight
                                    className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    style={{ color: 'var(--text-tertiary)' }}
                                  />
                                  <FolderOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                                  <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</span>
                                  <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                                    {projectSheets.length}
                                  </span>
                                </button>
                              </div>

                              {/* 시트 목록 */}
                              {isExpanded && projectSheets.length > 0 && (
                                <div style={{ background: 'var(--bg-secondary)' }}>
                                  {projectSheets.map(sheet => {
                                    const isSheetSelected = selectedSheetIds.includes(sheet.id) && selectedProjectId === project.id;
                                    const excluded = excludedColumns[sheet.id] || new Set();
                                    const excludedCount = excluded.size;
                                    const isColumnSettingsOpen = showColumnSettings === sheet.id;
                                    const isDisabled = !isSheetExportableForFormat(sheet);
                                    const kindMeta = resolveSheetKind(sheet);
                                    return (
                                      <div key={sheet.id}>
                                        <div
                                          className="w-full pl-12 pr-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] transition-colors"
                                          style={{
                                            color: isDisabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            opacity: isDisabled ? 0.5 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'default',
                                          }}
                                          title={isDisabled ? `${kindMeta.label} 시트는 게임 엔진 포맷으로 export 할 수 없습니다 — JSON 으로만 백업 가능` : undefined}
                                        >
                                          <button
                                            onClick={() => handleSheetToggle(sheet.id, project.id)}
                                            disabled={isDisabled}
                                            className="shrink-0 disabled:cursor-not-allowed"
                                          >
                                            {isSheetSelected ? (
                                              <CheckSquare className="w-4 h-4" style={{ color: 'var(--primary-blue)' }} />
                                            ) : (
                                              <Square className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                            )}
                                          </button>
                                          <span
                                            className="flex-1 truncate"
                                            style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                                            onClick={() => !isDisabled && handleSheetToggle(sheet.id, project.id)}
                                          >
                                            {sheet.name}
                                          </span>
                                          <SheetKindBadge sheet={sheet} showDefault size="xs" />
                                          {/* 컬럼 설정 버튼 */}
                                          {isSheetSelected && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setShowColumnSettings(isColumnSettingsOpen ? null : sheet.id);
                                              }}
                                              className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                                              title={t('export.columnSettings')}
                                            >
                                              <Settings2 className="w-3.5 h-3.5" style={{
                                                color: excludedCount > 0 ? 'var(--warning)' : 'var(--text-tertiary)'
                                              }} />
                                            </button>
                                          )}
                                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {excludedCount > 0 ? (
                                              <span style={{ color: 'var(--warning)' }}>
                                                {sheet.columns.length - excludedCount}/{sheet.columns.length}
                                              </span>
                                            ) : (
                                              `${sheet.rows.length}×${sheet.columns.length}`
                                            )}
                                          </span>
                                        </div>
                                        {/* 컬럼 설정 패널 */}
                                        {isColumnSettingsOpen && (
                                          <div
                                            className="pl-16 pr-3 py-2 space-y-1"
                                            style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-primary)' }}
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                {t('export.selectColumns')}
                                              </span>
                                              <button
                                                onClick={() => handleSelectAllColumns(sheet.id)}
                                                className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-hover)]"
                                                style={{ color: 'var(--text-tertiary)' }}
                                              >
                                                {excluded.size === sheet.columns.length ? t('common.selectAll') : t('common.deselectAll')}
                                              </button>
                                            </div>
                                            <div className="max-h-32 overflow-y-auto space-y-0.5">
                                              {sheet.columns.map(col => {
                                                const isExcluded = excluded.has(col.id);
                                                return (
                                                  <button
                                                    key={col.id}
                                                    onClick={() => handleColumnToggle(sheet.id, col.id)}
                                                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[var(--bg-hover)] transition-colors"
                                                    style={{ color: isExcluded ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                                                  >
                                                    {isExcluded ? (
                                                      <Square className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                                                    ) : (
                                                      <CheckSquare className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--primary-blue)' }} />
                                                    )}
                                                    <span className={`truncate ${isExcluded ? 'line-through' : ''}`}>{col.name}</span>
                                                    <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
                                                      {col.type}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 선택 요약 */}
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {selectedFormat === 'json' && !selectedProjectId ? (
                      `${projects.length}개 프로젝트 전체`
                    ) : selectedSheetIds.length > 0 ? (
                      `${selectedSheetIds.length}개 시트 선택됨`
                    ) : (
                      '시트를 선택하세요'
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: 클래스명 설정 (게임 엔진만) */}
              {isGameEngineFormat && selectedSheetIds.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--primary-blue)', color: 'white' }}>3</div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('export.options')}</span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {t('gameEngineExport.className')} (C#/GDScript)
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedSheets.map(sheet => {
                        const currentClassName = getClassName(sheet);
                        const isValid = isValidClassName(currentClassName);
                        return (
                          <div key={sheet.id} className="flex items-center gap-2">
                            <span
                              className="text-xs truncate w-24 shrink-0"
                              style={{ color: 'var(--text-secondary)' }}
                              title={sheet.name}
                            >
                              {sheet.name}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                            <input
                              type="text"
                              value={classNames[sheet.id] ?? (sheet.exportClassName || '')}
                              onChange={(e) => handleClassNameChange(sheet.id, e.target.value)}
                              placeholder={sheet.name.replace(/[^a-zA-Z0-9]/g, '') || 'ClassName'}
                              className="flex-1 px-2 py-1.5 rounded text-sm focus:outline-none min-w-0"
                              style={{
                                background: 'var(--bg-primary)',
                                border: `1px solid ${isValid ? 'var(--border-primary)' : 'var(--error)'}`,
                                color: 'var(--text-primary)'
                              }}
                            />
                            {!isValid && (
                              <span className="text-xs shrink-0" style={{ color: 'var(--error)' }}>!</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {t('gameEngineExport.classNameHint')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 생성하기 버튼 */}
            <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#6366f1', color: 'white' }}
              >
                <Code className="w-4 h-4" />
                {t('export.generate')}
              </button>
            </div>
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {isGenerated && previewFiles.length > 0 ? (
              <>
                {/* 미리보기 헤더 */}
                <div
                  className="px-5 py-3 border-b flex items-center justify-between shrink-0"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('gameEngineExport.filesGenerated', { count: previewFiles.length })}
                    </span>
                  </div>
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: '#4f46e5', color: 'white' }}
                  >
                    <Download className="w-4 h-4" />
                    {t('gameEngineExport.downloadAll')}
                  </button>
                </div>

                {/* 파일 탭 */}
                <div
                  className="flex border-b overflow-x-auto shrink-0"
                  style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
                >
                  {previewFiles.map(file => {
                    const isExpanded = expandedFile === file.filename;
                    return (
                      <button
                        key={file.filename}
                        onClick={() => setExpandedFile(file.filename)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
                        style={{
                          borderColor: isExpanded ? 'var(--primary-blue)' : 'transparent',
                          color: isExpanded ? 'var(--primary-blue)' : 'var(--text-secondary)',
                          background: isExpanded ? 'var(--bg-primary)' : 'transparent'
                        }}
                      >
                        <FileIcon filename={file.filename} />
                        {file.filename}
                      </button>
                    );
                  })}
                </div>

                {/* 코드 미리보기 */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  {previewFiles.map(file => {
                    if (expandedFile !== file.filename) return null;
                    return (
                      <div key={file.filename} className="flex-1 flex flex-col overflow-hidden">
                        {/* 파일 액션 바 */}
                        <div
                          className="flex items-center justify-end gap-1 px-4 py-2 border-b shrink-0"
                          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
                        >
                          <button
                            onClick={() => handleCopy(file.filename, file.content)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ color: copiedFile === file.filename ? 'var(--success)' : 'var(--text-secondary)' }}
                          >
                            {copiedFile === file.filename ? (
                              <><Check className="w-3.5 h-3.5" />Copied!</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" />{t('gameEngineExport.copy')}</>
                            )}
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t('gameEngineExport.download')}
                          </button>
                          <button
                            onClick={() => setIsCodeFullscreen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ color: 'var(--text-secondary)' }}
                            title={t('common.fullscreen')}
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 코드 영역 */}
                        <div
                          className="flex-1 overflow-auto"
                          style={{ background: isDark ? '#1e1e2e' : '#fafafa' }}
                        >
                          <SyntaxHighlighter
                            language={getLanguageFromFilename(file.filename)}
                            style={removeTokenBackgrounds(isDark ? oneDark : oneLight)}
                            customStyle={{
                              margin: 0,
                              padding: '1rem 1.25rem',
                              fontSize: '13px',
                              background: 'transparent',
                              minHeight: '100%',
                            }}
                            showLineNumbers
                            lineNumberStyle={{
                              minWidth: '3em',
                              paddingRight: '1em',
                              color: isDark ? '#6c7086' : '#9ca3af',
                              userSelect: 'none',
                            }}
                          >
                            {file.content}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* 빈 상태 */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <Download className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-base font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('export.selectFormatPrompt')}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {t('export.selectFormatDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 코드 전체화면 모달 */}
      {isCodeFullscreen && expandedFile && (
        <div className="fixed inset-0 z-[1200] flex flex-col" style={{ background: isDark ? '#1e1e2e' : '#fafafa' }}>
          {/* 전체화면 헤더 */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
          >
            <div className="flex items-center gap-3">
              <FileIcon filename={expandedFile} />
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{expandedFile}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const file = previewFiles.find(f => f.filename === expandedFile);
                  if (file) handleCopy(file.filename, file.content);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: copiedFile === expandedFile ? 'var(--success)' : 'var(--text-secondary)' }}
              >
                {copiedFile === expandedFile ? (
                  <><Check className="w-4 h-4" />Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" />{t('gameEngineExport.copy')}</>
                )}
              </button>
              <button
                onClick={() => {
                  const file = previewFiles.find(f => f.filename === expandedFile);
                  if (file) handleDownload(file);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Download className="w-4 h-4" />
                {t('gameEngineExport.download')}
              </button>
              <button
                onClick={() => setIsCodeFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Minimize2 className="w-4 h-4" />
                {t('common.close')}
              </button>
            </div>
          </div>
          {/* 전체화면 코드 */}
          <div className="flex-1 overflow-auto">
            {previewFiles.filter(f => f.filename === expandedFile).map(file => (
              <SyntaxHighlighter
                key={file.filename}
                language={getLanguageFromFilename(file.filename)}
                style={removeTokenBackgrounds(isDark ? oneDark : oneLight)}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem 2rem',
                  fontSize: '14px',
                  background: 'transparent',
                  minHeight: '100%',
                }}
                showLineNumbers
                lineNumberStyle={{
                  minWidth: '4em',
                  paddingRight: '1.5em',
                  color: isDark ? '#6c7086' : '#9ca3af',
                  userSelect: 'none',
                }}
              >
                {file.content}
              </SyntaxHighlighter>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
