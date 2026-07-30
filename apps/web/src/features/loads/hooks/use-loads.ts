import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLoadsPage } from '@/services/loads.service';
import type { LoadFilters } from '@/services/loads.service';
import type { Load } from '@freightx/shared';
import { realtimeSubscribe } from '@/lib/realtime-manager';

interface UseLoadsResult {
  loads: Load[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number | null;
  refresh: () => void;
  loadMore: () => void;
}

export function useLoads(filters: LoadFilters = {}): UseLoadsResult {
  const queryClient = useQueryClient();
  const [pageNum, setPageNum] = useState(0);
  const [allLoads, setAllLoads] = useState<Load[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);

  // Stable filter key (exclude page)
  const { page: _unusedPage, ...filtersWithoutPage } = filters;
  void _unusedPage;
  const filterKey = JSON.stringify(filtersWithoutPage);

  const { data, isLoading, error } = useQuery({
    queryKey: ['loads', filterKey],
    queryFn: () => getLoadsPage({ ...(JSON.parse(filterKey) as LoadFilters), page: 0 }),
    staleTime: 30_000,
  });

  // Sync first-page results into local accumulator state
  useEffect(() => {
    if (data) {
      setAllLoads(data.loads);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPageNum(0);
      pageRef.current = 0;
    }
  }, [data]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const result = await getLoadsPage({
        ...(JSON.parse(filterKey) as LoadFilters),
        page: nextPage,
      });
      setAllLoads((prev) => [...prev, ...result.loads]);
      setHasMore(result.hasMore);
      setTotal(result.total);
      setPageNum(nextPage);
      pageRef.current = nextPage;
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, filterKey]);

  const refresh = useCallback(() => {
    pageRef.current = 0;
    setPageNum(0);
    void queryClient.invalidateQueries({ queryKey: ['loads', filterKey] });
  }, [queryClient, filterKey]);

  // Realtime — deduplicated via realtimeManager, triggers React Query invalidation
  useEffect(() => {
    const unsub1 = realtimeSubscribe({ table: 'loads', event: 'INSERT' }, () => {
      if (pageRef.current === 0) {
        void queryClient.invalidateQueries({ queryKey: ['loads', filterKey] });
      }
    });
    const unsub2 = realtimeSubscribe({ table: 'loads', event: 'UPDATE' }, (payload) => {
      // Optimistic removal: if load is no longer biddable, remove it instantly
      const newStatus = (payload.new as Record<string, unknown>)?.status as string | undefined;
      if (newStatus && ['awarded', 'dispatched', 'cancelled'].includes(newStatus)) {
        const removedId = (payload.new as Record<string, unknown>)?.id as string | undefined;
        if (removedId) {
          setAllLoads((prev) => prev.filter((l) => l.id !== removedId));
        }
      }
      if (pageRef.current === 0) {
        void queryClient.invalidateQueries({ queryKey: ['loads', filterKey] });
      }
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [filterKey, queryClient]);

  // Suppress unused variable warnings
  void pageNum;

  return {
    loads: allLoads,
    loading: isLoading,
    loadingMore,
    error: error ? (error instanceof Error ? error.message : 'Failed to load data') : null,
    hasMore,
    total,
    refresh,
    loadMore,
  };
}
