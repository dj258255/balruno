import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes } from 'react';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function SubmitButton({ children, loading, disabled, ...rest }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      {...rest}
      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md font-medium transition-colors disabled:opacity-60"
      style={{ background: 'var(--accent)', color: '#fff' }}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
