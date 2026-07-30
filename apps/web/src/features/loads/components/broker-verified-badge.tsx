import { BadgeCheck } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BrokerVerifiedBadgeProps {
  verified?: boolean;
  companyId?: string;
  compact?: boolean;
  className?: string;
}

export function BrokerVerifiedBadge({
  verified = true,
  companyId: _companyId,
  compact,
  className,
}: BrokerVerifiedBadgeProps) {
  if (!verified) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        'bg-blue-500/15 text-blue-400 border border-blue-500/25',
        className,
      )}
    >
      <BadgeCheck size={compact ? 10 : 12} />
      {!compact && 'Verified Broker'}
    </span>
  );
}

export default BrokerVerifiedBadge;
