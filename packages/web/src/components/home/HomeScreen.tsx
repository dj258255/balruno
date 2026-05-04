/**
 * Home 페이지 — Stage 1+2+3 통합.
 *
 * Stage 1: 오늘의 작업 대시보드 (고정 위젯)
 * Stage 2: 편집 모드 (위젯 추가/제거/순서)
 * Stage 3: 다중 Interface 탭 (통합/디자이너/PM + 커스텀)
 *
 * 리서치 기반 설계:
 *   - Linear My Issues Focus 그룹 (개인 작업 우선)
 *   - Notion Home + My Tasks widget
 *   - Airtable Interface Designer (같은 데이터, 다른 인터페이스)
 *   - Canva empty state 40→75% 활성화
 */

import { useState } from 'react';
import { Settings, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTodaysWork } from '@/hooks/useTodaysWork';
import { useHomeLayout } from '@/stores/homeLayoutStore';
import { WIDGET_REGISTRY, type WidgetId } from './widgetRegistry';
import HomeEmptyState from './HomeEmptyState';
import CurrentUserBadge from './CurrentUserBadge';
import { GettingStartedChecklist } from './GettingStartedChecklist';

export default function HomeScreen() {
  const t = useTranslations();
  const work = useTodaysWork();
  const layout = useHomeLayout();
  const [editMode, setEditMode] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCreateInterface, setShowCreateInterface] = useState(false);
  const [newInterfaceName, setNewInterfaceName] = useState('');

  if (work.projectCount === 0) {
    return <HomeEmptyState />;
  }

  if (!layout.hydrated) {
    return <div className="flex-1" style={{ background: 'var(--bg-primary)' }} />;
  }

  const activeIface = layout.activeInterface;
  const widgets = activeIface.widgetIds
    .map((id) => WIDGET_REGISTRY[id])
    .filter(Boolean);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Interface 탭 스위처 (Stage 3) */}
      <div
        className="flex items-center px-6 pt-4 gap-1 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-end gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {layout.interfaces.map((iface) => {
            const isActive = iface.id === activeIface.id;
            return (
              <button
                key={iface.id}
                onClick={() => layout.setActive(iface.id)}
                className="relative px-3 py-2 text-sm transition-colors whitespace-nowrap"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {iface.name}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px]"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                {editMode && layout.interfaces.length > 1 && isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(t('homeScreen.deleteIfaceConfirm', { name: iface.name }))) {
                        layout.deleteInterface(iface.id);
                      }
                    }}
                    className="ml-2 inline-flex items-center p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                    aria-label={t('homeScreen.deleteIfaceAria')}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setShowCreateInterface(true)}
            className="px-2 py-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-tertiary)' }}
            title={t('homeScreen.createIfaceTitle')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setEditMode((v) => !v)}
          className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: editMode ? 'var(--accent-light)' : 'transparent',
            color: editMode ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <Settings className="w-3.5 h-3.5" />
          {editMode ? t('homeScreen.editEnd') : t('homeScreen.editLabel')}
        </button>
      </div>

      {/* 본문 — 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-slim">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* 인사말 */}
          <header className="space-y-2 mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('homeScreen.greeting', { user: work.currentUser })}
              </h1>
              <CurrentUserBadge />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {editMode ? t('homeScreen.editModeHint') : t('homeScreen.viewHint', { name: activeIface.name })}
            </p>
          </header>

          {/* 신규 유저 시작 가이드 — 5 단계 완료 또는 dismiss 시 자동 숨김 */}
          <GettingStartedChecklist />

          {/* 위젯 그리드 */}
          {widgets.length === 0 ? (
            <div
              className="glass-card p-8 text-center"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                {t('homeScreen.noWidgetsInIface')}
              </p>
              <button
                onClick={() => {
                  setEditMode(true);
                  setShowCatalog(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {t('homeScreen.addWidget')}
              </button>
            </div>
          ) : (
            <WidgetGrid
              widgets={widgets}
              work={work}
              editMode={editMode}
              onRemove={layout.removeWidget}
              onMove={layout.moveWidget}
            />
          )}

          {/* 편집 모드: 위젯 추가 CTA */}
          {editMode && layout.availableWidgets.length > 0 && (
            <button
              onClick={() => setShowCatalog(true)}
              className="w-full glass-card p-4 flex items-center justify-center gap-2 text-sm hover:shadow-md transition-all"
              style={{
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              <Plus className="w-4 h-4" />
              {t('homeScreen.addWidgetHeader', { n: layout.availableWidgets.length })}
            </button>
          )}
        </div>
      </div>

      {/* 위젯 카탈로그 모달 */}
      {showCatalog && (
        <WidgetCatalogModal
          availableIds={layout.availableWidgets}
          onAdd={(id) => {
            layout.addWidget(id);
            setShowCatalog(false);
          }}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {/* 새 Interface 만들기 모달 */}
      {showCreateInterface && (
        <CreateInterfaceModal
          value={newInterfaceName}
          onChange={setNewInterfaceName}
          onCreate={() => {
            if (newInterfaceName.trim()) {
              layout.createInterface(newInterfaceName);
              setNewInterfaceName('');
              setShowCreateInterface(false);
            }
          }}
          onClose={() => {
            setNewInterfaceName('');
            setShowCreateInterface(false);
          }}
        />
      )}
    </div>
  );
}

function WidgetGrid({
  widgets,
  work,
  editMode,
  onRemove,
  onMove,
}: {
  widgets: { id: WidgetId; size: 'full' | 'half' | 'third'; Component: React.FC<{ work: ReturnType<typeof useTodaysWork> }> }[];
  work: ReturnType<typeof useTodaysWork>;
  editMode: boolean;
  onRemove: (id: WidgetId) => void;
  onMove: (id: WidgetId, dir: 'up' | 'down') => void;
}) {
  // full 은 혼자 한 줄, half 는 2개씩 묶어 행
  // 간단화: full 은 하나씩, half/third 는 grid 2 열로 배치
  const rows: typeof widgets[] = [];
  let currentRow: typeof widgets = [];

  for (const w of widgets) {
    if (w.size === 'full') {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
      }
      rows.push([w]);
    } else {
      currentRow.push(w);
      if (currentRow.length === 2) {
        rows.push(currentRow);
        currentRow = [];
      }
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return (
    <div className="space-y-4">
      {widgets.map((w, i) => {
        const isFullRow = w.size === 'full';
        const sameRowIdx = widgets.slice(0, i).filter((x) => x.size !== 'full').length;

        // 행 시작: full 이거나 half/third 의 첫 번째
        const isRowStart = isFullRow || sameRowIdx % 2 === 0;
        if (!isRowStart && !editMode) return null; // already rendered as part of previous

        // full width row
        if (isFullRow) {
          return (
            <WidgetWrapper
              key={w.id}
              widgetId={w.id}
              editMode={editMode}
              isFirst={i === 0}
              isLast={i === widgets.length - 1}
              onRemove={onRemove}
              onMove={onMove}
            >
              <w.Component work={work} />
            </WidgetWrapper>
          );
        }

        // half/third — pair with next if not editMode (편집 모드엔 개별 표시)
        if (editMode) {
          return (
            <WidgetWrapper
              key={w.id}
              widgetId={w.id}
              editMode={editMode}
              isFirst={i === 0}
              isLast={i === widgets.length - 1}
              onRemove={onRemove}
              onMove={onMove}
            >
              <w.Component work={work} />
            </WidgetWrapper>
          );
        }

        // non-edit: group into 2-col grid
        const nextW = widgets[i + 1];
        const pairable = nextW && nextW.size !== 'full';
        return (
          <div key={w.id} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <w.Component work={work} />
            {pairable && <nextW.Component work={work} />}
          </div>
        );
      }).filter(Boolean)}
    </div>
  );
}

function WidgetWrapper({
  widgetId,
  editMode,
  isFirst,
  isLast,
  onRemove,
  onMove,
  children,
}: {
  widgetId: WidgetId;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: (id: WidgetId) => void;
  onMove: (id: WidgetId, dir: 'up' | 'down') => void;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  if (!editMode) return <>{children}</>;

  const meta = WIDGET_REGISTRY[widgetId];
  return (
    <div className="relative group">
      <div
        className="absolute top-2 right-2 z-10 flex gap-1 bg-[var(--bg-primary)] rounded-lg shadow-md p-1"
        style={{ border: '1px solid var(--border-primary)' }}
      >
        <button
          onClick={() => onMove(widgetId, 'up')}
          disabled={isFirst}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
          title={t('homeScreen.moveUp')}
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          onClick={() => onMove(widgetId, 'down')}
          disabled={isLast}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
          title={t('homeScreen.moveDown')}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            if (window.confirm(t('homeScreen.removeWidgetConfirm', { name: t(meta.nameKey as 'widgetRegistry.todayName') }))) {
              onRemove(widgetId);
            }
          }}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
          style={{ color: '#ef4444' }}
          title={t('homeScreen.remove')}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div style={{ outline: '2px dashed var(--border-primary)', borderRadius: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function WidgetCatalogModal({
  availableIds,
  onAdd,
  onClose,
}: {
  availableIds: WidgetId[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('homeScreen.addWidgetTitle')}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availableIds.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              {t('homeScreen.allWidgetsAdded')}
            </p>
          ) : (
            availableIds.map((id) => {
              const meta = WIDGET_REGISTRY[id];
              const Icon = meta.icon;
              return (
                <button
                  key={id}
                  onClick={() => onAdd(id)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t(meta.nameKey as 'widgetRegistry.todayName')}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {t(meta.descKey as 'widgetRegistry.todayDesc')}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CreateInterfaceModal({
  value,
  onChange,
  onCreate,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('homeScreen.createIfaceHeader')}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('homeScreen.createIfaceDesc')}
          </p>
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) onCreate();
              if (e.key === 'Escape') onClose();
            }}
            placeholder={t('homeScreen.placeholderIfaceName')}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent outline-none"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('homeScreen.cancelBtn')}
            </button>
            <button
              onClick={onCreate}
              disabled={!value.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {t('homeScreen.createBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
