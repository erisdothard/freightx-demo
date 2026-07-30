import { supabase } from '@/lib/supabase';
import type { CarrierPreferences } from './match-score';

interface PreferencesRow {
  user_id: string;
  preferred_equipment: string[];
  preferred_origin_states: string[];
  preferred_dest_states: string[];
  min_rate_per_mile: number;
  home_city: string;
  home_state: string;
}

function rowToPrefs(row: PreferencesRow): CarrierPreferences {
  return {
    userId: row.user_id,
    preferredEquipment: (row.preferred_equipment ?? []) as CarrierPreferences['preferredEquipment'],
    preferredOriginStates: row.preferred_origin_states ?? [],
    preferredDestStates: row.preferred_dest_states ?? [],
    minRatePerMile: row.min_rate_per_mile ?? 0,
    homeCity: row.home_city ?? '',
    homeState: row.home_state ?? '',
  };
}

export const DEFAULT_PREFS: Omit<CarrierPreferences, 'userId'> = {
  preferredEquipment: [],
  preferredOriginStates: [],
  preferredDestStates: [],
  minRatePerMile: 0,
  homeCity: '',
  homeState: '',
};

export async function getCarrierPreferences(userId: string): Promise<CarrierPreferences> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('carrier_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Row doesn't exist yet — return defaults
    return { userId, ...DEFAULT_PREFS };
  }

  return rowToPrefs(data as PreferencesRow);
}

export async function saveCarrierPreferences(prefs: CarrierPreferences): Promise<void> {
  const row: PreferencesRow = {
    user_id: prefs.userId,
    preferred_equipment: prefs.preferredEquipment,
    preferred_origin_states: prefs.preferredOriginStates,
    preferred_dest_states: prefs.preferredDestStates,
    min_rate_per_mile: prefs.minRatePerMile,
    home_city: prefs.homeCity,
    home_state: prefs.homeState,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('carrier_preferences')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw error;
}
