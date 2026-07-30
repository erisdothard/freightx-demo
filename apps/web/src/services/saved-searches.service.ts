import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import type { LoadFilters } from './loads.service';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: LoadFilters;
  alert_enabled: boolean;
  last_alerted_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SavedSearch[];
}

export async function createSavedSearch(params: {
  name: string;
  filters: LoadFilters;
  alertEnabled?: boolean;
}): Promise<SavedSearch> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: authData.user.id,
      name: params.name,
      filters: params.filters as unknown as Json,
      alert_enabled: params.alertEnabled ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SavedSearch;
}

export async function updateSavedSearch(
  id: string,
  updates: Partial<Pick<SavedSearch, 'name' | 'filters' | 'alert_enabled'>>,
): Promise<void> {
  const { error } = await supabase
    .from('saved_searches')
    .update({
      ...updates,
      filters: updates.filters ? (updates.filters as unknown as Json) : undefined,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
