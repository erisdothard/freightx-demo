import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShipperTrustProfile,
  getBrokerTrustProfile,
  submitShipperReview,
  type TrustProfile,
} from '@/services/shipper-reviews.service';

export function useTrustProfile(
  companyId: string | undefined,
  type: 'shipper' | 'broker' = 'shipper',
) {
  const { data, isLoading, error } = useQuery<TrustProfile | null>({
    queryKey: ['trust-profile', companyId, type],
    queryFn: () => {
      if (!companyId) return null;
      return type === 'broker'
        ? getBrokerTrustProfile(companyId)
        : getShipperTrustProfile(companyId);
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return {
    profile: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useSubmitShipperReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitShipperReview,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['trust-profile', variables.reviewedCompanyId],
      });
    },
  });
}
