'use client';

/**
 * SettingsHub — the single Notion-style settings surface.
 *
 * One centered portal modal with a left nav rail (account / notifications /
 * workspace-general / members) and a right content pane. The pane bodies are
 * the exact same components that used to render as three separate modals
 * (WorkspaceSettingsClient / AccountSettingsClient /
 * NotificationSettingsClient) plus the member management content — each
 * mounted in `embedded` mode so they skip their own portal/overlay shells
 * and only render content. All fetching/saving stays inside the bodies;
 * the hub owns nothing but section selection and the frame.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Settings, User, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useWorkspaceListStore } from '@/stores/workspaceListStore';
import { MemberManagementBody } from '@/components/workspace/MemberManagementModal';
import WorkspaceSettingsClient from './WorkspaceSettingsClient';
import AccountSettingsClient from './AccountSettingsClient';
import NotificationSettingsClient from './NotificationSettingsClient';

export type SettingsSection = 'account' | 'notifications' | 'workspace' | 'members';

interface SettingsHubProps {
  workspaceSlug: string;
  workspaceId: string;
  initialSection?: SettingsSection;
  onClose: () => void;
}

interface NavItem {
  section: SettingsSection;
  labelKey: 'account' | 'notifications' | 'general' | 'members';
  icon: typeof Settings;
}

interface NavGroup {
  heading: ReactNode;
  items: NavItem[];
}

export default function SettingsHub({
  workspaceSlug,
  workspaceId,
  initialSection = 'workspace',
  onClose,
}: SettingsHubProps) {
  const t = useTranslations('settingsHub');
  const [section, setSection] = useState<SettingsSection>(initialSection);

  const workspaceName = useWorkspaceListStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.name,
  );

  // Esc-to-close — the legacy per-section modals only offered the X
  // button + backdrop click; the hub adds the keyboard path too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups: NavGroup[] = [
    {
      heading: t('groupAccount'),
      items: [
        { section: 'account', labelKey: 'account', icon: User },
        { section: 'notifications', labelKey: 'notifications', icon: Bell },
      ],
    },
    {
      heading: t('groupWorkspace', { name: workspaceName ?? workspaceSlug }),
      items: [
        { section: 'workspace', labelKey: 'general', icon: Settings },
        { section: 'members', labelKey: 'members', icon: Users },
      ],
    },
  ];

  // Portal to document.body so the sidebar's translateX-bearing wrapper
  // doesn't capture the fixed-position overlay as its containing block —
  // same reasoning as the legacy settings shells this hub replaces.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl border shadow-xl flex overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          height: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left nav rail */}
        <nav
          className="w-56 shrink-0 border-r overflow-y-auto py-3"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-secondary)',
          }}
        >
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : undefined}>
              <div
                className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider truncate"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {group.heading}
              </div>
              {group.items.map((item) => {
                const active = section === item.section;
                const Icon = item.icon;
                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => setSection(item.section)}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-sm text-left transition-colors"
                    style={{
                      color: 'var(--text-primary)',
                      background: active ? 'var(--bg-tertiary)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Right content pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="flex items-center justify-end p-2 border-b"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)]"
              aria-label="close"
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {section === 'account' && <AccountSettingsClient embedded />}
            {section === 'notifications' && <NotificationSettingsClient embedded />}
            {section === 'workspace' && (
              <WorkspaceSettingsClient embedded workspaceSlug={workspaceSlug} />
            )}
            {section === 'members' && (
              <div className="space-y-4">
                <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('members')}
                </h1>
                <MemberManagementBody workspaceId={workspaceId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
