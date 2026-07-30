import { cn } from '@/shared/lib/utils';

export function RivePulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-3 w-3', className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fx-orange opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-fx-orange" />
    </span>
  );
}

export default RivePulse;
