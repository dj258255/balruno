import { Cloud, CloudOff, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useConnectionStore, type ChannelStatus } from '@/stores/connectionStore';
import { isBackendConfigured } from '@/lib/api/client';

interface ConnectionStatusProps {
  /** Compact mode: dot only, no label. */
  compact?: boolean;
}

const STATUS_COLOR: Record<ChannelStatus, string> = {
  idle: 'var(--text-tertiary)',
  connecting: 'var(--accent)',
  connected: '#22c55e',
  offline: '#f59e0b',
  error: '#ef4444',
};

export function ConnectionStatus({ compact = false }: ConnectionStatusProps) {
  const t = useTranslations('connection');
  const sheet = useConnectionStore((s) => s.sheet);
  const doc = useConnectionStore((s) => s.doc);

  const status: ChannelStatus = useConnectionStore((s) => s.aggregate());

  const backendConfigured = isBackendConfigured();
  const effective: ChannelStatus = backendConfigured ? status : 'idle';

  const label = backendConfigured ? labelFor(t, effective) : t('localOnly');
  const Icon = iconFor(effective, backendConfigured);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={tooltipFor(t, sheet, doc, backendConfigured)}
    >
      <Icon className={`w-3.5 h-3.5 ${effective === 'connecting' ? 'animate-spin' : ''}`} style={{ color: STATUS_COLOR[effective] }} />
      {!compact && <span style={{ color: 'var(--text-secondary)' }}>{label}</span>}
    </span>
  );
}

function iconFor(status: ChannelStatus, backendConfigured: boolean) {
  if (!backendConfigured) return CloudOff;
  if (status === 'connecting') return Loader2;
  if (status === 'connected') return Cloud;
  if (status === 'error') return AlertCircle;
  if (status === 'offline') return CloudOff;
  return Cloud;
}

function labelFor(t: ReturnType<typeof useTranslations<'connection'>>, status: ChannelStatus): string {
  switch (status) {
    case 'connecting':
      return t('connecting');
    case 'connected':
      return t('connected');
    case 'offline':
      return t('offline');
    case 'error':
      return t('error');
    case 'idle':
    default:
      return t('idle');
  }
}

function tooltipFor(
  t: ReturnType<typeof useTranslations<'connection'>>,
  sheet: { id: string | null; status: ChannelStatus },
  doc: { id: string | null; status: ChannelStatus },
  backendConfigured: boolean,
): string {
  if (!backendConfigured) return t('localOnlyHint');
  return `${t('sheet')}: ${sheet.status} · ${t('doc')}: ${doc.status}`;
}
