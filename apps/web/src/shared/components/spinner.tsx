import { cn } from '@/shared/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-2',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'rounded-full border-fx-border border-t-fx-orange animate-spin inline-block',
        SIZE_CLASSES[size],
        className,
      )}
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-dvh bg-fx-bg flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
