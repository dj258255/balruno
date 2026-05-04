import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { X, GripHorizontal, Palette, Minus, Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { Sticker } from '@/types';

// 스티커 색상 옵션
const STICKER_COLORS = [
  { nameKey: 'sheet.stickerColorYellow', value: '#fef08a' },
  { nameKey: 'sheet.stickerColorPink', value: '#fbcfe8' },
  { nameKey: 'sheet.stickerColorBlue', value: '#bfdbfe' },
  { nameKey: 'sheet.stickerColorGreen', value: '#bbf7d0' },
  { nameKey: 'sheet.stickerColorPurple', value: '#ddd6fe' },
  { nameKey: 'sheet.stickerColorOrange', value: '#fed7aa' },
  { nameKey: 'sheet.stickerColorSky', value: '#a5f3fc' },
  { nameKey: 'sheet.stickerColorGray', value: '#e5e7eb' },
];

// 텍스트 크기 옵션
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];
const DEFAULT_FONT_SIZE = 14;

// 색상 어둡게 만들기
function darkenColor(hex: string, percent: number = 20): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return `rgb(${R}, ${G}, ${B})`;
}

interface StickerItemProps {
  sticker: Sticker;
  projectId: string;
  sheetId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function StickerItem({ sticker, projectId, sheetId, containerRef }: StickerItemProps) {
  const t = useTranslations();
  const { updateSticker, deleteSticker } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [text, setText] = useState(sticker.text);
  const stickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  // 텍스트 편집 모드 진입 시 포커스
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // 드래그 시작
  const handleDragStart = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = stickerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    setIsDragging(true);
  };

  // 리사이즈 시작
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    resizeStart.current = {
      width: sticker.width,
      height: sticker.height,
      mouseX: e.clientX,
      mouseY: e.clientY
    };
    setIsResizing(true);
  };

  // 드래그 중
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newX = ((e.clientX - containerRect.left - dragOffset.current.x) / containerRect.width) * 100;
      const newY = ((e.clientY - containerRect.top - dragOffset.current.y) / containerRect.height) * 100;

      updateSticker(projectId, sheetId, sticker.id, {
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, projectId, sheetId, sticker.id, updateSticker, containerRef]);

  // 리사이즈 중
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.current.mouseX;
      const deltaY = e.clientY - resizeStart.current.mouseY;

      const newWidth = Math.max(150, resizeStart.current.width + deltaX);
      const newHeight = Math.max(100, resizeStart.current.height + deltaY);

      updateSticker(projectId, sheetId, sticker.id, {
        width: newWidth,
        height: newHeight
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, projectId, sheetId, sticker.id, updateSticker]);

  // 텍스트 저장
  const handleSaveText = () => {
    updateSticker(projectId, sheetId, sticker.id, { text });
    setIsEditing(false);
  };

  // 색상 변경
  const handleColorChange = (color: string) => {
    updateSticker(projectId, sheetId, sticker.id, { color });
    setShowColorPicker(false);
  };

  // 폰트 크기 조절
  const currentFontSize = sticker.fontSize || DEFAULT_FONT_SIZE;

  // 현재 폰트 크기에 가장 가까운 인덱스 찾기 (배열에 없는 값도 처리)
  const findClosestIndex = (size: number): number => {
    const exactIndex = FONT_SIZES.indexOf(size);
    if (exactIndex !== -1) return exactIndex;

    // 배열에 없는 값이면 가장 가까운 인덱스 찾기
    for (let i = 0; i < FONT_SIZES.length; i++) {
      if (FONT_SIZES[i] >= size) return i;
    }
    return FONT_SIZES.length - 1;
  };

  const currentIndex = findClosestIndex(currentFontSize);

  const handleFontSizeDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = Math.max(0, currentIndex - 1);
    updateSticker(projectId, sheetId, sticker.id, { fontSize: FONT_SIZES[newIndex] });
  };

  const handleFontSizeIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = Math.min(FONT_SIZES.length - 1, currentIndex + 1);
    updateSticker(projectId, sheetId, sticker.id, { fontSize: FONT_SIZES[newIndex] });
  };

  // 삭제
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSticker(projectId, sheetId, sticker.id);
  };

  return (
    <div
      ref={stickerRef}
      className="absolute"
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: sticker.width,
        minHeight: sticker.height,
        zIndex: isDragging || isResizing ? 40 : 20,
        // 그림자를 외부 wrapper에 적용
        filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.06))',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !showColorPicker && setIsHovered(false)}
    >
      <div
        className="rounded-lg overflow-hidden flex flex-col h-full"
        style={{
          background: sticker.color,
          border: `1px solid ${darkenColor(sticker.color, 25)}`,
          minHeight: sticker.height,
        }}
      >
        {/* 헤더 바 (드래그 핸들 + 버튼들) - 호버 시에만 표시 */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center px-2 py-1.5 cursor-grab select-none transition-all z-10"
          style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '8px 8px 0 0',
            justifyContent: 'flex-start',
            minHeight: '32px',
            opacity: isHovered || isDragging ? 1 : 0,
            pointerEvents: isHovered || isDragging ? 'auto' : 'none',
          }}
          onMouseDown={handleDragStart}
        >
          {/* 드래그 아이콘 */}
          <GripHorizontal className="w-4 h-4 text-gray-600" />

          {/* 오른쪽: 텍스트 크기 + 색상 + 닫기 버튼 */}
          <div className="absolute right-1.5 flex items-center gap-0.5">
            {/* 텍스트 크기 조절 */}
            <div className="flex items-center gap-0.5 mr-1 px-1 rounded" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <button
                onClick={handleFontSizeDecrease}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
                title={t('sheet.stickerFontSmall')}
                disabled={currentIndex === 0}
              >
                <Minus className="w-2.5 h-2.5 text-gray-600" />
              </button>
              <span className="text-caption font-medium text-gray-600 min-w-[18px] text-center">
                {currentFontSize}
              </span>
              <button
                onClick={handleFontSizeIncrease}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
                title={t('sheet.stickerFontLarge')}
                disabled={currentIndex === FONT_SIZES.length - 1}
              >
                <Plus className="w-2.5 h-2.5 text-gray-600" />
              </button>
            </div>

            {/* 색상 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
              title={t('sheet.stickerColorChange')}
            >
              <Palette className="w-3 h-3 text-gray-600" />
            </button>

            {/* 닫기 버튼 */}
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
              title={t('sheet.stickerDelete')}
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 색상 선택기 */}
        {showColorPicker && (
          <div
            className="absolute left-0 top-7 mt-1 p-2 rounded-lg shadow-lg z-50 grid grid-cols-4 gap-1"
            style={{ background: 'white', border: '1px solid #ddd' }}
          >
            {STICKER_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleColorChange(c.value);
                }}
                className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                style={{
                  background: c.value,
                  borderColor: sticker.color === c.value ? '#333' : 'transparent'
                }}
                title={t(c.nameKey as 'sheet.stickerColorYellow')}
              />
            ))}
          </div>
        )}

        {/* 내용 - 전체 영역 클릭 가능 */}
        <div
          className="flex-1 px-3 py-2 cursor-text"
          style={{ minHeight: sticker.height - 10 }}
          onClick={() => !isEditing && setIsEditing(true)}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleSaveText}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setText(sticker.text);
                  setIsEditing(false);
                }
              }}
              className="w-full bg-transparent resize-none outline-none"
              style={{ color: '#333', height: sticker.height - 24, fontSize: `${currentFontSize}px` }}
              placeholder={t('sheet.stickerMemoPlaceholder')}
            />
          ) : (
            <div
              className="whitespace-pre-wrap break-words h-full"
              style={{ color: sticker.text ? '#333' : '#999', fontSize: `${currentFontSize}px` }}
            >
              {sticker.text || t('sheet.stickerClickToInput')}
            </div>
          )}
        </div>

        {/* 리사이즈 핸들 (우하단) - 호버 시에만 표시 */}
        <div
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize transition-all"
          onMouseDown={handleResizeStart}
          style={{
            opacity: isHovered || isResizing ? 1 : 0,
            pointerEvents: isHovered || isResizing ? 'auto' : 'none',
          }}
        >
          {/* 대각선 줄무늬 - 내부에 위치 */}
          <svg width="16" height="16" viewBox="0 0 16 16">
            <line x1="14" y1="6" x2="6" y2="14" stroke={darkenColor(sticker.color, 30)} strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="10" x2="10" y2="14" stroke={darkenColor(sticker.color, 30)} strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="14" y2="14" stroke={darkenColor(sticker.color, 30)} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

interface StickerLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function StickerLayer({ containerRef }: StickerLayerProps) {
  const t = useTranslations();
  const { projects, currentProjectId, currentSheetId } = useProjectStore();

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentSheet = currentProject?.sheets.find(s => s.id === currentSheetId);
  const stickers = currentSheet?.stickers || [];

  if (!currentProjectId || !currentSheetId) return null;

  return (
    <>
      {/* 스티커들 */}
      {stickers.map((sticker) => (
        <StickerItem
          key={sticker.id}
          sticker={sticker}
          projectId={currentProjectId}
          sheetId={currentSheetId}
          containerRef={containerRef}
        />
      ))}
    </>
  );
}
