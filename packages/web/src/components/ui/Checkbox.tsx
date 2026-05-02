'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 체크 상태 */
  checked?: boolean;
  /** 일부 선택 상태 (전체 선택용) */
  indeterminate?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 컬러 */
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const iconSizeClasses = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
};

const colorClasses = {
  primary: {
    checked: 'bg-[var(--primary-blue)] border-[var(--primary-blue)]',
    unchecked: 'border-[var(--border-secondary)] hover:border-[var(--primary-blue)]',
  },
  success: {
    checked: 'bg-[#3db88a] border-[#3db88a]',
    unchecked: 'border-[var(--border-secondary)] hover:border-[#3db88a]',
  },
  warning: {
    checked: 'bg-[#f5a524] border-[#f5a524]',
    unchecked: 'border-[var(--border-secondary)] hover:border-[#f5a524]',
  },
  danger: {
    checked: 'bg-[#e86161] border-[#e86161]',
    unchecked: 'border-[var(--border-secondary)] hover:border-[#e86161]',
  },
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked = false,
      indeterminate = false,
      size = 'sm',
      color = 'primary',
      disabled = false,
      className,
      onChange,
      ...props
    },
    ref
  ) => {
    const isChecked = checked || indeterminate;

    return (
      <label
        className={cn(
          'relative inline-flex items-center justify-center cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {/* 숨겨진 실제 input */}
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
          {...props}
        />

        {/* 커스텀 체크박스 UI */}
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-[4px] border-2 transition-all duration-150',
            sizeClasses[size],
            isChecked ? colorClasses[color].checked : colorClasses[color].unchecked,
            isChecked && 'shadow-sm',
            !disabled && !isChecked && 'bg-[var(--bg-primary)]',
            className
          )}
        >
          {/* 체크 아이콘 */}
          {isChecked && (
            <span className="flex items-center justify-center text-white animate-in zoom-in-50 duration-150">
              {indeterminate ? (
                <Minus className={iconSizeClasses[size]} strokeWidth={3} />
              ) : (
                <Check className={iconSizeClasses[size]} strokeWidth={3} />
              )}
            </span>
          )}
        </span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
