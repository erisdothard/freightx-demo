import { useQuery } from '@tanstack/react-query';
import {
  getLaneSuggestions,
  getBackhaulOpportunities,
  getLanePreferences,
  type LaneSuggestion,
  type BackhaulOpportunity,
  type LanePreference,
} from '@/services/lane-suggestions.service';

export function useLaneSuggestions(companyId: string | undefined) {
  const { data, isLoading, error } = useQuery<LaneSuggestion[]>({
    queryKey: ['lane-suggestions', companyId],
    queryFn: () => (companyId ? getLaneSuggestions(companyId) : []),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return {
    suggestions: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useBackhaulOpportunities(companyId: string | undefined, currentState?: string) {
  const { data, isLoading, error } = useQuery<BackhaulOpportunity[]>({
    queryKey: ['backhaul', companyId, currentState],
    queryFn: () => (companyId ? getBackhaulOpportunities(companyId, currentState) : []),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  return {
    opportunities: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useLanePreferences(companyId: string | undefined) {
  const { data, isLoading, error } = useQuery<LanePreference[]>({
    queryKey: ['lane-preferences', companyId],
    queryFn: () => (companyId ? getLanePreferences(companyId) : []),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  return {
    preferences: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}
