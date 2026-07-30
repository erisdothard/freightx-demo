interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on a feature flag.
 * Currently passes through all children (feature flag system not yet implemented).
 */
export function FeatureGate({
  feature: _feature,
  children,
  fallback: _fallback,
}: FeatureGateProps) {
  // TODO: integrate with a feature flag provider (e.g. LaunchDarkly, Supabase flags)
  // For now, always render children.
  return <>{children}</>;
}

export default FeatureGate;
