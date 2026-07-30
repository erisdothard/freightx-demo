import { cn } from '@/shared/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'orange' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles = {
  orange: 'bg-fx-orange/15 text-fx-orange border border-fx-orange/30',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green: 'bg-green-500/15 text-green-400 border border-green-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  red: 'bg-red-500/15 text-red-400 border border-red-500/30',
  gray: 'bg-fx-surface-2 text-fx-text-muted border border-fx-border',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
};

export function Badge({ children, variant = 'gray', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg font-semibold tracking-wide',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
