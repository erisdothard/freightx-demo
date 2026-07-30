import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { SubscriptionTier } from '@/lib/database.types';

// eslint-disable-next-line react-refresh/only-export-components
export const TIER_LIMITS: Record<
  SubscriptionTier,
  { maxTruckPostings: number | null; canPostLoads: boolean; maxLoads: number | null }
> = {
  free: { maxTruckPostings: 2, canPostLoads: false, maxLoads: null },
  basic: { maxTruckPostings: 5, canPostLoads: false, maxLoads: null },
  pro: { maxTruckPostings: 10, canPostLoads: true, maxLoads: 100 },
  carrier_pro: { maxTruckPostings: null, canPostLoads: false, maxLoads: null },
  broker_starter: { maxTruckPostings: null, canPostLoads: true, maxLoads: 50 },
  broker_growth: { maxTruckPostings: null, canPostLoads: true, maxLoads: null },
  shipper: { maxTruckPostings: null, canPostLoads: true, maxLoads: 25 },
  enterprise: { maxTruckPostings: null, canPostLoads: true, maxLoads: null },
};

interface Props {
  tier: SubscriptionTier;
  feature: 'post_loads' | 'unlimited_trucks';
  loadsUsed?: number;
  trucksUsed?: number;
  upgradeHref?: string;
  children: ReactNode;
}

export function SubscriptionGate({
  tier,
  feature,
  loadsUsed = 0,
  trucksUsed = 0,
  upgradeHref,
  children,
}: Props) {
  const limits = TIER_LIMITS[tier];

  let blocked = false;
  let reason = '';

  if (feature === 'post_loads') {
    if (!limits.canPostLoads) {
      blocked = true;
      reason = 'Your plan does not include load posting. Upgrade to Broker or Shipper.';
    } else if (limits.maxLoads !== null && loadsUsed >= limits.maxLoads) {
      blocked = true;
      reason = `You've reached your ${limits.maxLoads}-load limit this month.`;
    }
  }

  if (feature === 'unlimited_trucks') {
    if (limits.maxTruckPostings !== null && trucksUsed >= limits.maxTruckPostings) {
      blocked = true;
      reason = `Free plan allows ${limits.maxTruckPostings} truck postings. Upgrade to Carrier Pro for unlimited.`;
    }
  }

  if (blocked) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
        <div className="w-10 h-10 rounded-full bg-fx-orange/10 flex items-center justify-center">
          <Lock size={18} className="text-fx-orange" />
        </div>
        <p className="text-sm text-fx-text-dim max-w-xs">{reason}</p>
        {upgradeHref && (
          <a
            href={upgradeHref}
            className="h-9 px-5 bg-fx-orange hover:bg-fx-orange/90 text-white text-sm font-semibold rounded-lg inline-flex items-center transition-colors"
          >
            Upgrade Plan
          </a>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
