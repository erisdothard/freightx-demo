import { supabase } from '@/lib/supabase';
import type { CompanyRow } from '@/lib/database.types';

export async function getCompany(id: string): Promise<CompanyRow | null> {
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CompanyRow | null;
}

export interface CompanyFilters {
  type?: CompanyRow['type'];
  verified?: boolean;
}

export async function getCompanies(filters: CompanyFilters = {}): Promise<CompanyRow[]> {
  let query = supabase.from('companies').select('*').order('name', { ascending: true });
  if (filters.type !== undefined) query = query.eq('type', filters.type);
  if (filters.verified !== undefined) query = query.eq('verified', filters.verified);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyRow[];
}

export async function updateCompany(
  id: string,
  updates: Partial<CompanyRow>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('companies').update(updates).eq('id', id);
  return { error: error?.message ?? null };
}

export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file');
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('Image must be smaller than 5MB');
  }

  // Extract file extension
  const fileExt = file.name.split('.').pop();
  const filePath = `company-logos/${companyId}-${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('company-logos').getPublicUrl(filePath);

  return publicUrl;
}
