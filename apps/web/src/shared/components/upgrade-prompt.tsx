import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import type { FeatureName } from '@/services/feature-gate.service';

const FEATURE_LABELS: Record<FeatureName, { title: string; tier: string }> = {
  rate_analytics: { title: 'Rate Analytics', tier: 'Carrier Pro' },
  lane_alerts: { title: 'Lane Alerts', tier: 'Carrier Pro' },
  api_access: { title: 'API Access', tier: 'Broker Growth' },
  advanced_tracking: { title: 'Advanced Tracking', tier: 'Carrier Pro' },
  dock_scheduling: { title: 'Dock Scheduling', tier: 'Shipper' },
  factoring: { title: 'Instant Pay', tier: 'Carrier Pro' },
  predictive_sourcing: { title: 'Predictive Sourcing', tier: 'Broker Growth' },
  csv_import: { title: 'Bulk Import', tier: 'Broker Starter' },
};

interface UpgradePromptProps {
  feature: FeatureName;
  className?: string;
}

export function UpgradePrompt({ feature, className }: UpgradePromptProps) {
  const navigate = useNavigate();
  const info = FEATURE_LABELS[feature];

  return (
    <div className={`relative overflow-hidden rounded-ios-sm ${className ?? ''}`}>
      {/* Blurred preview background */}
      <div className="absolute inset-0 bg-fx-surface-2 backdrop-blur-sm opacity-60" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center py-8 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-fx-surface-3 border border-fx-border flex items-center justify-center mb-3">
          <Lock size={20} className="text-fx-text-dim" />
        </div>
        <h4 className="text-sm font-semibold text-fx-text mb-1">
          {info.title}
        </h4>
        <p className="text-xs text-fx-text-dim mb-4">
          Upgrade to {info.tier} to unlock this feature
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/profile', { state: { tab: 'subscription' } })}
        >
          Upgrade Plan
        </Button>
      </div>
    </div>
  );
}
