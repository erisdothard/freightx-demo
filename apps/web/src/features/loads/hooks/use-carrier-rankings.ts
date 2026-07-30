import { useQuery } from '@tanstack/react-query';
import { rankCarriersForLoad, type CarrierScore } from '@/services/carrier-sourcing.service';

export function useCarrierRankings(loadId: string | undefined) {
  const { data, isLoading, error } = useQuery<CarrierScore[]>({
    queryKey: ['carrier-rankings', loadId],
    queryFn: () => (loadId ? rankCarriersForLoad(loadId) : []),
    enabled: !!loadId,
    staleTime: 60_000,
  });

  return {
    carriers: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}
