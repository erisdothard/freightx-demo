import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/database.types';

const ROLE_ROUTES: Record<string, string> = {
  carrier: '/carrier',
  broker: '/broker',
  shipper: '/shipper',
  driver: '/driver',
};

/**
 * Entry point for the public demo: /demo, or /demo/:role for a specific one.
 *
 * Enters demo mode and lands directly on the dashboard so a shared link never
 * shows a login screen. Unknown roles fall back to carrier rather than 404,
 * since this URL is handed out publicly and a typo shouldn't dead-end.
 */
export default function DemoPage() {
  const { role } = useParams<{ role?: string }>();
  const navigate = useNavigate();
  const { enterDemoMode } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; only enter demo mode once.
    if (started.current) return;
    started.current = true;

    const requested = role?.toLowerCase() ?? '';
    const resolved = requested in ROLE_ROUTES ? requested : 'carrier';

    enterDemoMode(resolved as UserRole);
    navigate(ROLE_ROUTES[resolved], { replace: true });
  }, [role, enterDemoMode, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fx-bg">
      <p className="text-sm text-fx-text-muted">Loading demo…</p>
    </div>
  );
}
