import { type ReactNode } from 'react';
import Link from 'next/link';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Footer link (e.g., "Already have an account? Login") */
  footer?: ReactNode;
}

/**
 * Shared chrome for auth pages — centered card with brand + form slot.
 * Lives outside the main app layout so the sidebar/topbar don't render.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
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
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
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
