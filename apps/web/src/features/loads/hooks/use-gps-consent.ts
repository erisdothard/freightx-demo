import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const GPS_CONSENT_TEXT =
  'I consent to FreightX collecting and sharing my live GPS location (latitude, longitude, speed, heading) with my carrier and dispatcher while I am on active loads. I understand I can revoke this consent at any time from my profile settings.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useGpsConsent() {
  const { user } = useAuth();
  const [hasConsented, setHasConsented] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check server-side consent on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    db.from('gps_consent')
      .select('granted')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { granted: boolean } | null }) => {
        setHasConsented(data?.granted === true);
        setLoading(false);
      });
  }, [user]);

  const grantConsent = useCallback(async () => {
    const { error } = await db.rpc('grant_gps_consent', {
      p_consent_text: GPS_CONSENT_TEXT,
      p_user_agent: navigator.userAgent,
    });
    if (error) {
      console.error('[gps-consent] Grant failed:', error);
      return;
    }
    setHasConsented(true);
  }, []);

  const revokeConsent = useCallback(async () => {
    const { error } = await db.rpc('revoke_gps_consent');
    if (error) {
      console.error('[gps-consent] Revoke failed:', error);
      return;
    }
    setHasConsented(false);
  }, []);

  return { hasConsented, grantConsent, revokeConsent, loading };
}
