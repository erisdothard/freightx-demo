import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getTrucks, PAGE_SIZE } from '@/services/trucks.service';
import type { TruckFilters } from '@/services/trucks.service';
import type { Truck } from '@freightx/shared';

interface UseTrucksResult {
  trucks: Truck[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export function useTrucks(filters: TruckFilters = {}): UseTrucksResult {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);

  const { page: _unusedPage, ...filtersWithoutPage } = filters;
  void _unusedPage;
  const filterKey = JSON.stringify(filtersWithoutPage);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const data = await getTrucks({ ...(JSON.parse(filterKey) as TruckFilters), page });
        setTrucks((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === PAGE_SIZE);
        pageRef.current = page;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterKey],
  );

  const refresh = useCallback(() => {
    pageRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchPage(pageRef.current + 1, true);
  }, [fetchPage, hasMore, loadingMore]);

  useEffect(() => {
    pageRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    const channel = supabase
      .channel('trucks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trucks' }, () => {
        if (pageRef.current === 0) fetchPage(0, false);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trucks' }, () => {
        if (pageRef.current === 0) fetchPage(0, false);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPage]);

  return { trucks, loading, loadingMore, error, hasMore, refresh, loadMore };
}
