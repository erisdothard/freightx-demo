import { supabase } from '@/lib/supabase';

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: string;
  calendar_id: string | null;
  enabled: boolean;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the current user's calendar integration status.
 * Does NOT return tokens — only connection metadata.
 */
export async function getCalendarIntegration(): Promise<CalendarIntegration | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('calendar_integrations')
    .select('id, user_id, provider, calendar_id, enabled, token_expires_at, created_at, updated_at')
    .eq('user_id', authData.user.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as CalendarIntegration;
}

/**
 * Initiates the Google OAuth flow by opening a popup to Google's consent screen.
 * The state parameter encodes the user_id so the callback can associate tokens.
 */
export function initiateGoogleOAuth(redirectUrl: string): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

  // Get current user synchronously from the session cache
  const session = supabase.auth.getSession();
  void session.then(({ data }) => {
    const userId = data.session?.user?.id;
    if (!userId) {
      console.error('[calendar] No authenticated user for OAuth');
      return;
    }

    const state = btoa(JSON.stringify({ user_id: userId, redirect_url: redirectUrl }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  });
}

/**
 * Disconnect the calendar integration (removes from DB).
 */
export async function disconnectCalendar(): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('calendar_integrations')
    .delete()
    .eq('user_id', authData.user.id)
    .eq('provider', 'google');

  if (error) throw new Error(error.message);
}

/**
 * Toggle calendar sync enabled/disabled.
 */
export async function toggleCalendarSync(enabled: boolean): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('calendar_integrations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('user_id', authData.user.id)
    .eq('provider', 'google');

  if (error) throw new Error(error.message);
}

/**
 * Manually trigger calendar sync for a specific load.
 */
export async function syncLoadToCalendar(loadId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const resp = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      load_id: loadId,
      driver_id: authData.user.id,
    }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Calendar sync failed');
  }
}
