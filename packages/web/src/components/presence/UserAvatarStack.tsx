import { useActiveUsers, type PresenceScope } from '@/hooks/useActiveUsers';
import { UserAvatar } from './UserAvatar';

interface UserAvatarStackProps {
  scope: PresenceScope | null;
  /** Maximum avatars to render before collapsing into "+N". */
  max?: number;
  size?: number;
}

export function UserAvatarStack({ scope, max = 4, size = 28 }: UserAvatarStackProps) {
  const users = useActiveUsers(scope);

  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center" aria-label={`${users.length} active users`}>
      {visible.map((u, i) => (
        <span
          key={u.userId}
          style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}
          className="transition-transform hover:translate-y-[-1px]"
        >
          <UserAvatar user={u} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{
            marginLeft: -size * 0.35,
            width: size,
            height: size,
            fontSize: Math.round(size * 0.42),
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            boxShadow: `0 0 0 2px var(--bg-primary)`,
          }}
          className="inline-flex items-center justify-center rounded-full font-semibold"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
