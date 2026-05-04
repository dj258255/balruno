import { useMemo } from 'react';
import { useActiveUsers, type PresenceScope } from '@/hooks/useActiveUsers';
import { UserAvatar } from './UserAvatar';

interface CellPresenceBadgeProps {
  scope: PresenceScope;
  rowId: string;
  columnId: string;
  /** Position the badge inside the cell — 'top-right' is default. */
  corner?: 'top-right' | 'top-left';
  size?: number;
}

/**
 * Renders avatars of remote users currently focused on this specific cell.
 * Layered above the cell with a subtle ring matching the user color.
 *
 * Place inside a relative-positioned cell wrapper.
 */
export function CellPresenceBadge({
  scope,
  rowId,
  columnId,
  corner = 'top-right',
  size = 16,
}: CellPresenceBadgeProps) {
  const users = useActiveUsers(scope);

  const present = useMemo(
    () =>
      users.filter(
        (u) => !u.isSelf && u.cellKey?.rowId === rowId && u.cellKey?.columnId === columnId,
      ),
    [users, rowId, columnId],
  );

  if (present.length === 0) return null;

  const positionStyle = corner === 'top-right' ? { top: -6, right: -6 } : { top: -6, left: -6 };

  return (
    <span
      className="absolute z-10 flex items-center pointer-events-none"
      style={positionStyle}
      aria-hidden
    >
      {present.slice(0, 3).map((u, i) => (
        <span key={u.userId} style={{ marginLeft: i === 0 ? 0 : -size * 0.4 }}>
          <UserAvatar user={u} size={size} ringWidth={1.5} showTooltip={false} />
        </span>
      ))}
    </span>
  );
}
