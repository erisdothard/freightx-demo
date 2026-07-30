import { cn } from '@/shared/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  subtitle,
  action,
  className,
}: EmptyStateProps) {
  const text = description ?? subtitle;
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-fx-surface-2 border border-fx-border mb-4 text-fx-text-dim">
        {icon}
      </div>

      <h3 className="text-base font-bold text-fx-text mb-1">{title}</h3>
      {text && <p className="text-sm text-fx-text-muted max-w-xs">{text}</p>}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
