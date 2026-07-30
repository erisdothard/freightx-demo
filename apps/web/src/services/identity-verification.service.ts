import { supabase } from '@/lib/supabase';

export interface IdentityRiskProfile {
  user_id: string;
  risk_level: 'low' | 'medium' | 'high';
  is_voip: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  risk_factors: string[];
  last_checked: string;
}

export async function getIdentityRiskProfile(userId: string): Promise<IdentityRiskProfile | null> {
  const { data, error } = await supabase.rpc('get_identity_risk_profile', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as IdentityRiskProfile) ?? null;
}

export async function verifyPhone(phone: string): Promise<{ verified: boolean; is_voip: boolean }> {
  // Phone verification RPC — may need edge function deployment
  const { data, error } = await supabase.rpc('verify_phone_number' as any, {
    p_phone: phone,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { verified: boolean; is_voip: boolean };
}
