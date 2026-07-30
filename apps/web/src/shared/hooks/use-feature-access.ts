import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { checkFeatureAccess, type FeatureName } from '@/services/feature-gate.service';

export function useFeatureAccess(feature: FeatureName) {
  const { company } = useAuth();
  const companyId = company?.id;

  const { data: hasAccess = false, isLoading } = useQuery({
    queryKey: ['feature-access', companyId, feature],
    queryFn: () => checkFeatureAccess(companyId!, feature),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 30 * 60 * 1000,
  });

  return { hasAccess, isLoading };
}
