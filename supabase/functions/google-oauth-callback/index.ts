/**
 * google-oauth-callback Edge Function
 *
 * Handles the OAuth 2.0 callback from Google after the driver authorizes
 * FreightX to manage their calendar. Exchanges the auth code for tokens
 * and stores them in the calendar_integrations table.
 *
 * Flow:
 * 1. Driver clicks "Connect Google Calendar" in settings
 * 2. Redirected to Google OAuth consent screen
 * 3. Google redirects back here with ?code=... &state=...
 * 4. We exchange the code for access + refresh tokens
 * 5. Store tokens in calendar_integrations
 * 6. Redirect driver back to FreightX settings page
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // contains user_id + redirect_url
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[google-oauth-callback] OAuth error:', error);
      return redirectWithError('Google authorization was denied.');
    }

    if (!code || !state) {
      return redirectWithError('Missing authorization code or state.');
    }

    // Decode state — { user_id, redirect_url }
    let stateData: { user_id: string; redirect_url: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError('Invalid state parameter.');
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[google-oauth-callback] Missing Google OAuth env vars');
      return redirectWithError('Server configuration error.');
    }

    // Exchange auth code for tokens
    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text();
      console.error('[google-oauth-callback] Token exchange failed:', errBody);
      return redirectWithError('Failed to exchange authorization code.');
    }

    const tokens = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    if (!tokens.access_token) {
      return redirectWithError('No access token received from Google.');
    }

    // Fetch the user's primary calendar ID
    const calendarResp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let calendarId = 'primary';
    if (calendarResp.ok) {
      const cal = (await calendarResp.json()) as { id?: string };
      calendarId = cal.id ?? 'primary';
    }

    // Store in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertErr } = await supabase.from('calendar_integrations').upsert(
      {
        user_id: stateData.user_id,
        provider: 'google',
        calendar_id: calendarId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? '',
        token_expires_at: expiresAt,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );

    if (upsertErr) {
      console.error('[google-oauth-callback] DB upsert failed:', upsertErr.message);
      return redirectWithError('Failed to save calendar connection.');
    }

    // Redirect back to FreightX settings with success
    const redirectUrl = new URL(stateData.redirect_url);
    redirectUrl.searchParams.set('calendar_connected', 'true');
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    console.error('[google-oauth-callback] Unhandled error:', err);
    return redirectWithError('An unexpected error occurred.');
  }
});

function redirectWithError(message: string): Response {
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
  const url = new URL('/settings', appUrl);
  url.searchParams.set('calendar_error', message);
  return Response.redirect(url.toString(), 302);
}
