import { supabase } from '@/lib/supabase';
import { rowToTruck } from '@/lib/mappers';
import type { TruckRow, EquipmentType, TruckStatus } from '@/lib/database.types';
import type { Truck } from '@freightx/shared';
import { PostTruckInputSchema } from '@/lib/schemas/trucks.schema';

export const PAGE_SIZE = 25;

export interface TruckFilters {
  equipment?: EquipmentType | 'all';
  status?: TruckStatus | 'all';
  postedBy?: string;
  page?: number; // 0-indexed
}

export async function getTrucks(filters: TruckFilters = {}): Promise<Truck[]> {
  const page = filters.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('trucks')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.equipment && filters.equipment !== 'all') {
    query = query.eq('equipment', filters.equipment);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToTruck);
}

export async function createTruck(truck: Omit<TruckRow, 'id' | 'created_at'>): Promise<Truck> {
  PostTruckInputSchema.parse(truck);
  const { data, error } = await supabase.from('trucks').insert(truck).select().single();
  if (error) throw error;
  return rowToTruck(data);
}

export async function updateTruck(id: string, updates: Partial<TruckRow>): Promise<Truck> {
  const { data, error } = await supabase
    .from('trucks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToTruck(data);
}

export async function deleteTruck(id: string): Promise<void> {
  const { error } = await supabase.from('trucks').delete().eq('id', id);
  if (error) throw error;
}
