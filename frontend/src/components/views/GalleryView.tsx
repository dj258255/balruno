'use client';

/**
 * Gallery 뷰.
 * 각 행을 카드 그리드로 표시. 첫 url 컬럼 값이 있으면 이미지로 렌더(attachment 는 다음 세션).
 * 제목 = 첫 일반 컬럼, 나머지 컬럼은 메타 데이터로.
 */

import { useState, useRef } from 'react';
import { ImageIcon, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDisplayValue } from '@/components/sheet/utils';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import { storeBlob, isImageReference } from '@/lib/imageStorage';
import { useImageSrc } from '@/hooks/useImageSrc';
import { toast } from '@/components/ui/Toast';
import type { Sheet, Row, Column } from '@/types';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface GalleryViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function GalleryView({ projectId, sheet }: GalleryViewProps) {
  const t = useTranslations('views');
  const openedRowId = useRecordDetail((s) =>
    s.opened && s.opened.sheetId === sheet.id ? s.opened.rowId : null,
  );
  const openRecord = useRecordDetail((s) => s.openRecord);
  const closeRecord = useRecordDetail((s) => s.closeRecord);
  const selectRow = (rowId: string) => openRecord({ projectId, sheetId: sheet.id, rowId });
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const updateCell = useProjectStore((s) => s.updateCell);

  const handleAddRow = () => {
    const rowId = addRow(projectId, sheet.id);
    selectRow(rowId);
  };
  const titleCol = sheet.columns.find(
    (c) => c.type === 'general' || c.type === 'formula'
  );
  const urlCol = sheet.columns.find((c) => c.type === 'url');
  const metaCols = sheet.columns
    .filter((c) => c.id !== titleCol?.id && c.id !== urlCol?.id)
    .slice(0, 4);

  // 업로드: 로컬 파일 → IndexedDB blob → url 컬럼에 `indb:<id>` 저장
  const uploadImage = async (rowId: string, file: File) => {
    if (!urlCol) {
      toast.error(t('galleryUrlColFirst'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('galleryOnlyImage'));
      return;
    }
    setUploadingRowId(rowId);
    try {
      const ref = await storeBlob(file);
      updateCell(projectId, sheet.id, rowId, urlCol.id, ref);
      toast.success(t('galleryUploadOk'));
    } catch (e) {
      toast.error(t('galleryUploadFail', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setUploadingRowId(null);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
    <div className="flex-1 overflow-auto p-4">
      <div
        className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
        role="list"
        aria-label={t('galleryAria', { name: sheet.name })}
      >
        {sheet.rows.map((row) => (
          <GalleryCard
            key={row.id}
            row={row}
            sheet={sheet}
            titleCol={titleCol}
            urlCol={urlCol}
            metaCols={metaCols}
            isActive={openedRowId === row.id}
            isUploading={uploadingRowId === row.id}
            onSelect={() => selectRow(row.id)}
            onContext={(e) => setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY })}
            onUpload={(file) => uploadImage(row.id, file)}
          />
        ))}
      </div>
      {sheet.rows.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <ImageIcon className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('galleryNoRecords')}
          </p>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> {t('galleryFirstRecord')}
          </button>
        </div>
      )}
    </div>
    {/* RecordEditor 는 GlobalRecordDetail 에서 렌더 */}
    <RecordContextMenu
      state={ctxMenu}
      onClose={() => setCtxMenu(null)}
      onEdit={(rowId) => selectRow(rowId)}
      onDuplicate={(rowId) => {
        const src = sheet.rows.find((r) => r.id === rowId);
        if (src) addRow(projectId, sheet.id, { ...src.cells });
      }}
      onDelete={(rowId) => {
        deleteRow(projectId, sheet.id, rowId);
        if (openedRowId === rowId) closeRecord();
      }}
    />
    </div>
  );
}

/**
 * Gallery 카드 한 장 — useImageSrc 훅으로 indb/data/http URL 모두 해결,
 * 드래그-드롭 + 클릭 업로드로 이미지 IndexedDB 저장.
 */
function GalleryCard({
  row,
  sheet,
  titleCol,
  urlCol,
  metaCols,
  isActive,
  isUploading,
  onSelect,
  onContext,
  onUpload,
}: {
  row: Row;
  sheet: Sheet;
  titleCol: Column | undefined;
  urlCol: Column | undefined;
  metaCols: Column[];
  isActive: boolean;
  isUploading: boolean;
  onSelect: () => void;
  onContext: (e: React.MouseEvent) => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations('views');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawRef = urlCol ? row.cells[urlCol.id] : null;
  const refString = typeof rawRef === 'string' ? rawRef : null;
  const src = useImageSrc(refString);
  const hasImage = Boolean(src) && isImageReference(refString);
  const titleRaw = titleCol ? String(row.cells[titleCol.id] ?? '').trim() : '';

  return (
    <div
      role="listitem"
      aria-label={titleRaw || t('galleryRecordAria')}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(e);
      }}
      onDragOver={(e) => {
        if (urlCol) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onUpload(file);
      }}
      className="rounded-lg overflow-hidden text-left hover:ring-2 hover:ring-[var(--accent)]/40 transition-all cursor-pointer relative"
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        outline: isActive ? '2px solid var(--accent)' : 'none',
        boxShadow: dragOver ? '0 0 0 3px var(--accent)' : undefined,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="aspect-video flex items-center justify-center relative group"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        {hasImage && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
        )}
        {isUploading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-medium"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
          >
            {t('galleryUploading')}
          </div>
        )}
        {urlCol && !isUploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            title={t('galleryUploadTooltip')}
            aria-label={t('galleryUploadAria')}
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-3">
        {titleCol && (
          <div
            className="text-sm font-semibold mb-1 truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {formatDisplayValue(
              row.cells[titleCol.id] ?? '',
              titleCol,
              { sheets: [sheet], currentSheet: sheet },
              row,
            ) || '—'}
          </div>
        )}
        {metaCols.map((c) => {
          const v = formatDisplayValue(
            row.cells[c.id] ?? '',
            c,
            { sheets: [sheet], currentSheet: sheet },
            row,
          );
          if (!v) return null;
          return (
            <div key={c.id} className="flex gap-1 text-xs">
              <span style={{ color: 'var(--text-tertiary)' }}>{c.name}:</span>
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                {v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
