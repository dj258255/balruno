/**
 * Active-collaborators chrome shown at the right of the SheetHeader
 * (Figma/Notion/Google Docs convention).
 *
 * Two halves, both fed from the server-canonical presenceStore via
 * usePresence(projectId):
 *
 *   1. Inline label — "{name}님이 보고 있어요" (1 peer) or
 *      "{name}님 외 {N}명이 보고 있어요" (2+ peers). Hidden when
 *      0 peers so the chrome stays quiet during solo work. Hides
 *      on narrow viewports (< sm) to keep the header tidy.
 *
 *   2. Avatar stack — overlapping circles, peer first then "self"
 *      anchored on the right with a green presence dot. Up to 4
 *      peer chips before collapsing into "+N".
 */

import { useTranslations } from 'next-intl';
import { usePresence } from '@/hooks/usePresence';

interface PresenceIndicatorProps {
  projectId: string | null;
  /** Hide the inline name label, leaving only the avatar stack (e.g. for tight layouts). */
  hideLabel?: boolean;
}

export default function PresenceIndicator({
  projectId,
  hideLabel = false,
}: PresenceIndicatorProps) {
  const tApp = useTranslations('app');
  const tPresence = useTranslations('presence');
  const { peers, myName, myColor } = usePresence(projectId);

  if (!projectId) return null;

  const initials = (name: string) =>
    name
      .split(/[-\s]/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const peerCount = peers.length;
  const firstPeer = peers[0];
  const labelText =
    peerCount === 0
      ? null
      : peerCount === 1
        ? tPresence('singleViewer', { name: firstPeer!.name })
        : tPresence('multipleViewers', { name: firstPeer!.name, others: peerCount - 1 });

  return (
    <div className="flex items-center gap-2">
      {!hideLabel && labelText && (
        <span
          className="hidden sm:inline-block text-xs font-medium whitespace-nowrap"
          style={{ color: 'var(--text-secondary)' }}
          aria-live="polite"
        >
          {labelText}
        </span>
      )}
      <div className="flex items-center -space-x-1.5">
        {peers.slice(0, 4).map((p) => (
          <div
            key={p.id}
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold text-white shadow-sm"
            style={{
              background: p.color,
              borderColor: 'var(--bg-primary)',
            }}
            title={p.name}
          >
            {initials(p.name)}
          </div>
        ))}
        {peerCount > 4 && (
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold shadow-sm"
            style={{
              borderColor: 'var(--bg-primary)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
            title={tPresence('overflowTooltip', { count: peerCount - 4 })}
          >
            +{peerCount - 4}
          </div>
        )}
        {/* Self chip — rightmost, with a green presence dot */}
        <div
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold text-white shadow-sm relative"
          style={{
            background: myColor,
            borderColor: 'var(--bg-primary)',
          }}
          title={`${myName} (${tApp('meSuffix')})`}
        >
          {initials(myName)}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: '#10b981', borderColor: 'var(--bg-primary)' }}
            aria-label={tPresence('selfOnline')}
          />
        </div>
      </div>
    </div>
  );
}
