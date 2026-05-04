import { useActiveUsers, type PresenceScope } from '@/hooks/useActiveUsers';

interface RemoteCursorsProps {
  scope: PresenceScope | null;
  /** Element-relative coordinates: caller subtracts container offset before passing presence. */
}

/**
 * Renders cursor pointers for remote presence entries that include a `cursor: { x, y }`.
 * Coordinates are absolute viewport pixels; place this layer inside a `position: relative`
 * container that spans the editor / sheet surface.
 */
export function RemoteCursors({ scope }: RemoteCursorsProps) {
  const users = useActiveUsers(scope);
  const remote = users.filter((u) => !u.isSelf && u.cursor);

  if (remote.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {remote.map((u) => (
        <div
          key={u.userId}
          className="absolute transition-[transform] duration-75 ease-linear"
          style={{ transform: `translate3d(${u.cursor!.x}px, ${u.cursor!.y}px, 0)` }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 2L16 11L10 13L7 20L2 2Z"
              fill={u.color}
              stroke="white"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="ml-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md"
            style={{ background: u.color, marginTop: -4 }}
          >
            {u.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
