import { type InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, id, ...rest }: FormFieldProps) {
  const inputId = id ?? rest.name ?? Math.random().toString(36).slice(2);
  return (
    <label htmlFor={inputId} className="block mb-3 text-sm">
      <span className="mb-1.5 inline-block font-medium" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      <input
        id={inputId}
        {...rest}
        className="w-full px-3 py-2 rounded-md border outline-none focus:ring-2"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          borderColor: error ? 'var(--danger)' : 'var(--border-primary)',
        }}
      />
      {error && (
        <span className="mt-1 inline-block text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </label>
  );
}
