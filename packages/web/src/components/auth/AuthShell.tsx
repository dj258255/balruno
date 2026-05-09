import { type ReactNode } from 'react';
import Link from 'next/link';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Footer link (e.g., "Already have an account? Login") */
  footer?: ReactNode;
  /** Optional control rendered to the right of the title row inside the
   *  card — used by the login page for its locale toggle. Other auth
   *  pages (callback / invite) just omit it. */
  headerAccessory?: ReactNode;
}

/**
 * Shared chrome for auth pages — centered card with brand + form slot.
 * Lives outside the main app layout so the sidebar/topbar don't render.
 */
export function AuthShell({ title, subtitle, children, footer, headerAccessory }: AuthShellProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <Link href="/" className="mb-8 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Balruno
      </Link>

      <div
        className="w-full max-w-sm rounded-xl border p-7 shadow-sm"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          {headerAccessory}
        </div>
        {subtitle && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {footer && (
        <div className="mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
