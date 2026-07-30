import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import type { VerificationStatus } from '@/lib/database.types';

interface Props {
  status: VerificationStatus;
  size?: 'sm' | 'md';
}

const CONFIG = {
  verified: {
    icon: ShieldCheck,
    label: 'Verified',
    className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  },
  failed: {
    icon: ShieldAlert,
    label: 'Failed',
    className: 'text-red-400 bg-red-400/10 border-red-400/30',
  },
  expired: {
    icon: ShieldAlert,
    label: 'Expired',
    className: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',
  },
} satisfies Record<
  VerificationStatus,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    className: string;
  }
>;

export function VerifiedBadge({ status, size = 'sm' }: Props) {
  const { icon: Icon, label, className } = CONFIG[status];
  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${textSize} ${className}`}
    >
      <Icon size={iconSize} className="shrink-0" />
      {label}
    </span>
  );
}
