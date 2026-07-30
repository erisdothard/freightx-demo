import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface VerificationStatus {
  eligible: boolean;
  reason: string | null;
}

/**
 * Returns whether the current carrier is eligible to bid.
 * Calls the DB-level check_carrier_eligible() RPC and caches result for 5 min.
 */
export function useVerificationStatus(): VerificationStatus & { loading: boolean } {
  const { company } = useAuth();
  const companyId = company?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['verification-status', companyId],
    queryFn: async (): Promise<VerificationStatus> => {
      if (!companyId) return { eligible: false, reason: 'No company associated' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: eligible, error } = await (supabase as any).rpc('check_carrier_eligible', {
        p_company_id: companyId,
      });

      if (error) return { eligible: false, reason: 'Unable to verify eligibility' };

      if (eligible) return { eligible: true, reason: null };

      // Fetch details to provide specific reason
      const { data: verification } = await supabase
        .from('carrier_verifications')
        .select('status, fmcsa_status, insurance_expires_at')
        .eq('company_id', companyId)
        .maybeSingle();

      if (!verification) return { eligible: false, reason: 'Complete carrier verification to bid' };

      if (verification.status !== 'verified')
        return { eligible: false, reason: 'Carrier verification pending' };

      if (verification.fmcsa_status !== 'AUTHORIZED')
        return { eligible: false, reason: 'FMCSA authority not active' };

      if (
        !verification.insurance_expires_at ||
        new Date(verification.insurance_expires_at) <= new Date()
      )
        return { eligible: false, reason: 'Insurance expired — update to bid' };

      return { eligible: false, reason: 'Complete carrier verification to bid' };
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });

  return {
    eligible: data?.eligible ?? false,
    reason: data?.reason ?? null,
    loading: isLoading,
  };
}
