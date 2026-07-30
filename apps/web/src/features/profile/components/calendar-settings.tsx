import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Link2Off, RefreshCw } from 'lucide-react';
import {
  getCalendarIntegration,
  initiateGoogleOAuth,
  disconnectCalendar,
  toggleCalendarSync,
} from '@/services/calendar.service';

/**
 * Calendar Settings — driver profile settings component.
 * Shows "Connect Google Calendar" button or connected status with toggle.
 */
export function CalendarSettings() {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [justConnected, setJustConnected] = useState(false);

  const { data: integration, isLoading } = useQuery({
    queryKey: ['calendar-integration'],
    queryFn: getCalendarIntegration,
    staleTime: 60_000,
  });

  // Check URL params for post-OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      setJustConnected(true);
      void queryClient.invalidateQueries({ queryKey: ['calendar-integration'] });
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_connected');
      window.history.replaceState({}, '', url.toString());
    }
    const calError = params.get('calendar_error');
    if (calError) {
      console.warn('[calendar] OAuth error:', calError);
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [queryClient]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectCalendar();
      void queryClient.invalidateQueries({ queryKey: ['calendar-integration'] });
    } catch {
      // silently ignore
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleToggle() {
    if (!integration) return;
    setToggling(true);
    try {
      await toggleCalendarSync(!integration.enabled);
      void queryClient.invalidateQueries({ queryKey: ['calendar-integration'] });
    } catch {
      // silently ignore
    } finally {
      setToggling(false);
    }
  }

  function handleConnect() {
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    initiateGoogleOAuth(redirectUrl);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-fx-surface-2 border border-fx-border p-4 animate-pulse">
        <div className="h-5 bg-fx-surface rounded w-40" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-fx-surface-2 border border-fx-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={16} className="text-fx-orange" />
        <p className="text-sm font-bold text-fx-text">Google Calendar Sync</p>
      </div>

      {integration ? (
        <>
          {/* Connected state */}
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
              <Check size={10} />
              Connected
            </span>
            {integration.calendar_id && integration.calendar_id !== 'primary' && (
              <span className="text-[11px] text-fx-text-dim truncate max-w-[180px]">
                {integration.calendar_id}
              </span>
            )}
          </div>

          {justConnected && (
            <p className="text-[11px] text-emerald-400 mb-3">
              Calendar connected. New load assignments will auto-sync.
            </p>
          )}

          <p className="text-[11px] text-fx-text-dim mb-4">
            When you&apos;re assigned to a load, a calendar event is automatically created with
            pickup/delivery details.
          </p>

          {/* Enable/disable toggle + disconnect */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-semibold bg-fx-surface border border-fx-border transition-colors hover:border-fx-text-dim"
            >
              <RefreshCw size={12} className={toggling ? 'animate-spin' : ''} />
              {integration.enabled ? 'Pause Sync' : 'Resume Sync'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 transition-colors hover:bg-red-400/20"
            >
              <Link2Off size={12} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>

          {!integration.enabled && (
            <p className="text-[10px] text-amber-400 mt-2">
              Sync is paused. New assignments won&apos;t create calendar events.
            </p>
          )}
        </>
      ) : (
        <>
          {/* Not connected state */}
          <p className="text-[11px] text-fx-text-dim mb-4">
            Connect your Google Calendar to automatically create events when you&apos;re assigned to
            loads. Events include pickup/delivery addresses, rate, and equipment details.
          </p>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-bold text-white bg-fx-surface border border-fx-border transition-colors hover:border-fx-orange"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} className="shrink-0">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Connect Google Calendar
          </button>
        </>
      )}
    </div>
  );
}
