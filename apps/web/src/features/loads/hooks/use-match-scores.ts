import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLoads } from '@/services/loads.service';
import { getCarrierPreferences } from '../lib/preferences';
import { rankLoads, getTopMatches } from '../lib/match-score';
import type { ScoredLoad, CarrierPreferences } from '../lib/match-score';

interface UseMatchScoresResult {
  scoredLoads: ScoredLoad[]; // all posted loads, sorted by score
  topMatches: ScoredLoad[]; // loads scoring >= 60
  preferences: CarrierPreferences | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMatchScores(): UseMatchScoresResult {
  const { user } = useAuth();
  const [scoredLoads, setScoredLoads] = useState<ScoredLoad[]>([]);
  const [topMatches, setTopMatches] = useState<ScoredLoad[]>([]);
  const [preferences, setPreferences] = useState<CarrierPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // DEV TEST: swap in test prefs to verify scoring without DB migration
      // Remove this block and uncomment getCarrierPreferences once migration runs
      // const TEST_PREFS: CarrierPreferences = {
      //   userId: user.id,
      //   preferredEquipment: ['van', 'reefer'],
      //   preferredOriginStates: ['TX', 'CA'],
      //   preferredDestStates: ['IL', 'OH', 'PA'],
      //   minRatePerMile: 2.50,
      //   homeCity: 'Dallas',
      //   homeState: 'TX',
      // };
      const [loads, prefs] = await Promise.all([
        getLoads({ status: 'posted' }),
        getCarrierPreferences(user.id),
      ]);
      const ranked = rankLoads(loads, prefs);
      setScoredLoads(ranked);
      setTopMatches(getTopMatches(loads, prefs));
      setPreferences(prefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { scoredLoads, topMatches, preferences, loading, error, refresh: fetch };
}
