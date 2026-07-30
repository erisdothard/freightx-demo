import { forwardRef } from 'react';
import { cn } from '@/shared/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, iconRight, type = 'text', ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-fx-text-muted mb-1.5">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-12 bg-fx-surface border border-fx-border rounded-xl text-fx-text placeholder:text-fx-text-dim',
            'focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 transition-all duration-200',
            'text-sm font-medium',
            icon ? 'pl-10' : 'pl-4',
            iconRight ? 'pr-10' : 'pr-4',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
            className,
          )}
          {...props}
        />
        {iconRight && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fx-text-muted">
            {iconRight}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';

export { Input };
