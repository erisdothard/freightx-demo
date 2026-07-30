import { useEffect } from 'react';
import { Building2, Package } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function ViewSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const isCarrierView = location.pathname.startsWith('/carrier');

  // Persist active portal so shared pages (messages, profile) can use the right nav
  useEffect(() => {
    if (profile?.role !== 'broker') return;
    localStorage.setItem('fx_portal', isCarrierView ? 'carrier' : 'broker');
  }, [isCarrierView, profile?.role]);

  // Only show for brokers (hybrid broker+carrier users)
  if (profile?.role !== 'broker') return null;

  return (
    <div className="flex items-center gap-1 bg-fx-surface border border-fx-border rounded-xl p-1">
      <button
        onClick={() => navigate('/broker')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
          !isCarrierView
            ? 'bg-fx-orange text-white'
            : 'text-fx-text-dim hover:text-fx-text hover:bg-fx-surface-2',
        )}
      >
        <Package size={14} />
        <span>Broker</span>
      </button>
      <button
        onClick={() => navigate('/carrier')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
          isCarrierView
            ? 'bg-fx-orange text-white'
            : 'text-fx-text-dim hover:text-fx-text hover:bg-fx-surface-2',
        )}
      >
        <Building2 size={14} />
        <span>Carrier</span>
      </button>
    </div>
  );
}
