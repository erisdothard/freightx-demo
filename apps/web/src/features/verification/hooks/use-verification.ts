import { useState, useEffect } from 'react';
import { getVerification } from '@/services/verification.service';
import type { CarrierVerificationRow } from '@/lib/database.types';

export function useVerification(companyId: string | null) {
  const [verification, setVerification] = useState<CarrierVerificationRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getVerification(companyId).then(
      (data) => {
        setVerification(data);
        setLoading(false);
      },
      (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error');
        setLoading(false);
      },
    );
  }, [companyId]);

  return { verification, loading, error, setVerification };
}
