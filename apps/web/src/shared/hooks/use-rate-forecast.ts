import { useQuery } from '@tanstack/react-query';
import { forecastLaneRate, type RateForecast } from '@/services/rate-forecast.service';

export function useRateForecast(params: {
  originState: string | undefined;
  destState: string | undefined;
  equipment: string | undefined;
}) {
  const enabled = !!(params.originState && params.destState && params.equipment);

  const { data, isLoading } = useQuery<RateForecast>({
    queryKey: ['rate-forecast', params.originState, params.destState, params.equipment],
    queryFn: () =>
      forecastLaneRate({
        originState: params.originState!,
        destState: params.destState!,
        equipment: params.equipment!,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return { forecast: data ?? null, isLoading: enabled && isLoading };
}
