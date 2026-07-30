import { supabase } from '@/lib/supabase';

export interface ApiKey {
  id: string;
  company_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit_rpm: number;
  ip_whitelist: string[] | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiKeyUsageStat {
  date: string;
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
}

export async function generateApiKey(params: {
  companyId: string;
  name: string;
  scopes: string[];
  rateLimitRpm?: number;
  ipWhitelist?: string[];
}): Promise<{ key: ApiKey; plaintext_key: string }> {
  const { data, error } = await supabase.rpc('generate_api_key', {
    p_company_id: params.companyId,
    p_name: params.name,
    p_scopes: params.scopes,
    p_rate_limit_rpm: params.rateLimitRpm ?? 60,
    p_ip_whitelist: params.ipWhitelist ?? null,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { key: ApiKey; plaintext_key: string };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_api_key', {
    p_key_id: keyId,
  });
  if (error) throw new Error(error.message);
}

export async function getApiKeys(companyId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('company_id', companyId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiKey[];
}

export async function getApiUsageStats(companyId: string, days = 30): Promise<ApiKeyUsageStat[]> {
  const { data, error } = await supabase.rpc('get_api_usage_stats', {
    p_company_id: companyId,
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ApiKeyUsageStat[];
}
