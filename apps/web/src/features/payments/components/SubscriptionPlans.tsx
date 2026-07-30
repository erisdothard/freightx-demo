import { Check, Zap } from 'lucide-react';
import { useState } from 'react';
import { redirectToCheckout } from '@/services/stripe.service';
import type { SubscriptionTier } from '@/lib/database.types';

interface Plan {
  tier: SubscriptionTier;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0/mo',
    description: 'Get started — view loads, post up to 2 trucks.',
    features: ['View load board', 'Bid on loads', '2 truck postings/mo'],
  },
  {
    tier: 'carrier_pro',
    name: 'Carrier Pro',
    price: '$49/mo',
    description: 'Unlimited trucks. Scale your fleet.',
    features: [
      'Everything in Free',
      'Unlimited truck postings',
      'Verified badge',
      'Priority support',
    ],
    highlight: true,
  },
  {
    tier: 'broker_starter',
    name: 'Broker Starter',
    price: '$149/mo',
    description: 'Post loads and move freight.',
    features: [
      '50 loads/month',
      'Full bid management',
      'Rate confirmations',
      'Invoice & Quick Pay',
    ],
  },
  {
    tier: 'broker_growth',
    name: 'Broker Growth',
    price: '$349/mo',
    description: 'Unlimited loads. Unlimited growth.',
    features: ['Unlimited loads', 'All Starter features', 'Analytics dashboard', 'Custom branding'],
    highlight: true,
  },
  {
    tier: 'shipper',
    name: 'Driver',
    price: '$199/mo',
    description: '25 loads/month. Direct to carrier.',
    features: ['25 loads/month', 'Direct carrier booking', 'Load tracking', 'Document management'],
  },
];

interface Props {
  companyId: string;
  currentTier: SubscriptionTier;
}

export function SubscriptionPlans({ companyId, currentTier }: Props) {
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    setLoading(tier);
    setError(null);
    try {
      await redirectToCheckout(tier, companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-fx-orange" />
        <h3 className="text-sm font-semibold text-fx-text-main uppercase tracking-wider">
          Subscription Plans
        </h3>
      </div>

      <div className="grid gap-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          return (
            <div
              key={plan.tier}
              className={`bg-zinc-900 border rounded-xl p-4 space-y-3 ${
                plan.highlight
                  ? 'border-fx-orange/40'
                  : isCurrent
                    ? 'border-emerald-500/40'
                    : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fx-text-main">{plan.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-medium">
                        Current
                      </span>
                    )}
                    {plan.highlight && !isCurrent && (
                      <span className="text-[10px] bg-fx-orange/15 text-fx-orange border border-fx-orange/30 rounded-full px-2 py-0.5 font-medium">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-fx-text-dim mt-0.5">{plan.description}</p>
                </div>
                <span className="text-sm font-bold text-fx-text-main whitespace-nowrap">
                  {plan.price}
                </span>
              </div>

              <ul className="space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-fx-text-dim">
                    <Check size={11} className="text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && plan.tier !== 'free' && (
                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={loading === plan.tier}
                  className={`h-9 w-full text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 ${
                    plan.highlight
                      ? 'bg-fx-orange hover:bg-fx-orange/90 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-fx-text-main border border-zinc-700'
                  }`}
                >
                  {loading === plan.tier ? 'Redirecting…' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
