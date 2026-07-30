import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Backwards-compat redirect: /carrier/team-settings → /carrier/team?tab=members
 */
export default function CarrierTeamSettingsPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/carrier/team?tab=members', { replace: true });
  }, [navigate]);
  return null;
}
