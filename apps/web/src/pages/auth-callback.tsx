import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IOSStatusBar } from '@/shared/components/ios-status-bar';
import { supabase } from '@/lib/supabase';

const ROLE_ROUTES: Record<string, string> = {
  carrier: '/carrier',
  broker: '/broker',
  shipper: '/shipper',
  driver: '/driver',
  admin: '/admin',
};

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate('/login', { replace: true });
        return;
      }

      // Fetch user profile to determine role-based redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      const route = profile?.role ? (ROLE_ROUTES[profile.role] ?? '/carrier') : '/onboarding';
      navigate(route, { replace: true });
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5">
      <IOSStatusBar />
      <span className="w-8 h-8 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
      <p className="text-sm text-fx-text-muted mt-4">Signing you in…</p>
    </div>
  );
}
