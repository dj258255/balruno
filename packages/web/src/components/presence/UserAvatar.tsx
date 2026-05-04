import { type PresenceUser } from '@/stores/presenceStore';

interface UserAvatarProps {
  user: PresenceUser;
  size?: number;
  ringWidth?: number;
  showTooltip?: boolean;
}

export function UserAvatar({ user, size = 24, ringWidth = 2, showTooltip = true }: UserAvatarProps) {
  const initial = (user.displayName || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      title={showTooltip ? user.displayName : undefined}
      className="inline-flex items-center justify-center rounded-full font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: user.color,
        color: '#fff',
        fontSize: Math.round(size * 0.45),
        boxShadow: `0 0 0 ${ringWidth}px var(--bg-primary)`,
        border: user.isSelf ? `1px solid rgba(0,0,0,0.15)` : 'none',
      }}
    >
      {initial}
    </span>
  );
}
