import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDriverHosStatus,
  logDutyTransition,
  getDutyLog,
  getViolations,
  type HosStatus,
  type DutyLogEntry,
  type HosViolation,
  type DutyStatus,
} from '@/services/hos.service';

export function useHosStatus(driverId: string | undefined) {
  const { data, isLoading, error } = useQuery<HosStatus | null>({
    queryKey: ['hos-status', driverId],
    queryFn: () => (driverId ? getDriverHosStatus(driverId) : null),
    enabled: !!driverId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return {
    status: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useDutyTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      driverId: string;
      newStatus: DutyStatus;
      locationLat?: number;
      locationLng?: number;
      locationDescription?: string;
      odometer?: number;
      notes?: string;
    }) => logDutyTransition(params),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['hos-status', variables.driverId] });
      void queryClient.invalidateQueries({ queryKey: ['duty-log', variables.driverId] });
    },
  });
}

export function useDutyLog(driverId: string | undefined, date?: string) {
  const { data, isLoading, error } = useQuery<DutyLogEntry[]>({
    queryKey: ['duty-log', driverId, date],
    queryFn: () => (driverId ? getDutyLog(driverId, date) : []),
    enabled: !!driverId,
    staleTime: 30_000,
  });

  return { log: data ?? [], loading: isLoading, error: error ? (error as Error).message : null };
}

export function useViolations(driverId: string | undefined) {
  const { data, isLoading, error } = useQuery<HosViolation[]>({
    queryKey: ['hos-violations', driverId],
    queryFn: () => (driverId ? getViolations(driverId) : []),
    enabled: !!driverId,
    staleTime: 60_000,
  });

  return {
    violations: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}
