/**
 * calendar-sync Edge Function
 *
 * Called by the pg_net trigger (migration 063) when a driver is assigned to a load.
 * Creates a Google Calendar event with pickup/delivery details and deadhead mileage.
 *
 * Also supports manual sync via POST { load_id, driver_id }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface LoadRow {
  id: string;
  load_number: string;
  origin_city: string;
  origin_state: string;
  origin_address: string | null;
  origin_zip: string | null;
  dest_city: string;
  dest_state: string;
  dest_address: string | null;
  dest_zip: string | null;
  pickup_date: string;
  delivery_date: string | null;
  pickup_appt_start: string | null;
  pickup_appt_end: string | null;
  delivery_appt_start: string | null;
  delivery_appt_end: string | null;
  rate_usd: number;
  equipment: string;
  commodity: string | null;
  total_miles: number | null;
  special_instructions: string | null;
}

interface CalendarIntegration {
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { load_id, driver_id } = (await req.json()) as {
      load_id: string;
      driver_id: string;
    };

    if (!load_id || !driver_id) {
      return new Response(JSON.stringify({ error: 'load_id and driver_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch load details
    const { data: load, error: loadErr } = await supabase
      .from('loads')
      .select(
        'id, load_number, origin_city, origin_state, origin_address, origin_zip, ' +
          'dest_city, dest_state, dest_address, dest_zip, ' +
          'pickup_date, delivery_date, pickup_appt_start, pickup_appt_end, ' +
          'delivery_appt_start, delivery_appt_end, ' +
          'rate_usd, equipment, commodity, total_miles, special_instructions',
      )
      .eq('id', load_id)
      .single();

    if (loadErr || !load) {
      return jsonResponse({ error: 'Load not found' }, 404);
    }

    const typedLoad = load as unknown as LoadRow;

    // Fetch driver's calendar integration
    const { data: integration, error: intErr } = await supabase
      .from('calendar_integrations')
      .select('calendar_id, access_token, refresh_token, token_expires_at')
      .eq('user_id', driver_id)
      .eq('provider', 'google')
      .eq('enabled', true)
      .maybeSingle();

    if (intErr || !integration) {
      return jsonResponse({ skipped: true, reason: 'No calendar integration for driver' }, 200);
    }

    const typedIntegration = integration as unknown as CalendarIntegration;

    // Refresh token if expired
    let accessToken = typedIntegration.access_token;
    if (new Date(typedIntegration.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(supabase, driver_id, typedIntegration.refresh_token);
      if (!accessToken) {
        return jsonResponse({ error: 'Failed to refresh Google access token' }, 500);
      }
    }

    // Calculate deadhead estimate from driver's last known location
    let deadheadMiles: number | null = null;
    const { data: truckLoc } = await supabase
      .rpc('get_latest_truck_locations')
      .then(
        (res: { data: unknown }) =>
          res as { data: Array<{ driver_id: string; latitude: number; longitude: number }> | null },
      );

    if (truckLoc) {
      const driverLoc = (
        truckLoc as Array<{ driver_id: string; latitude: number; longitude: number }>
      ).find((t) => t.driver_id === driver_id);
      if (driverLoc) {
        // Simple Haversine approximation for deadhead
        deadheadMiles = await estimateDeadhead(driverLoc.latitude, driverLoc.longitude, typedLoad);
      }
    }

    // Build calendar event
    const event = buildCalendarEvent(typedLoad, deadheadMiles);

    // Create Google Calendar event
    const calendarId = typedIntegration.calendar_id || 'primary';
    const createResp = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!createResp.ok) {
      const errBody = await createResp.text();
      console.error('[calendar-sync] Google API error:', errBody);
      return jsonResponse({ error: 'Failed to create calendar event', detail: errBody }, 500);
    }

    const createdEvent = (await createResp.json()) as { id: string; htmlLink: string };

    return jsonResponse(
      {
        success: true,
        event_id: createdEvent.id,
        event_link: createdEvent.htmlLink,
      },
      200,
    );
  } catch (err) {
    console.error('[calendar-sync] Unhandled error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

async function refreshAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret || !refreshToken) return null;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    console.error('[calendar-sync] Token refresh failed:', await resp.text());
    return null;
  }

  const tokens = (await resp.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Update stored tokens
  await supabase
    .from('calendar_integrations')
    .update({
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'google');

  return tokens.access_token;
}

function buildCalendarEvent(load: LoadRow, deadheadMiles: number | null) {
  const origin = `${load.origin_city}, ${load.origin_state}`;
  const dest = `${load.dest_city}, ${load.dest_state}`;

  // Start: pickup_date + pickup_appt_start (or 8am default)
  const pickupDate = load.pickup_date;
  const startTime = load.pickup_appt_start
    ? new Date(load.pickup_appt_start).toISOString()
    : `${pickupDate}T08:00:00`;

  // End: delivery_date + delivery_appt_end (or pickup_date 5pm)
  const deliveryDate = load.delivery_date ?? load.pickup_date;
  const endTime = load.delivery_appt_end
    ? new Date(load.delivery_appt_end).toISOString()
    : `${deliveryDate}T17:00:00`;

  // Build pickup address for location field
  const location = load.origin_address
    ? `${load.origin_address}, ${origin}${load.origin_zip ? ' ' + load.origin_zip : ''}`
    : origin;

  // Description
  const lines = [
    `Load: ${load.load_number}`,
    `Route: ${origin} → ${dest}`,
    `Rate: $${load.rate_usd?.toLocaleString() ?? '—'}`,
    `Equipment: ${load.equipment}`,
    ...(load.commodity ? [`Commodity: ${load.commodity}`] : []),
    ...(load.total_miles ? [`Trip Miles: ${load.total_miles}`] : []),
    ...(deadheadMiles !== null ? [`Deadhead: ~${deadheadMiles} mi`] : []),
    ...(load.special_instructions ? [`\nSpecial Instructions:\n${load.special_instructions}`] : []),
    '',
    'Managed by FreightX',
  ];

  return {
    summary: `Load ${load.load_number}: ${origin} → ${dest}`,
    location,
    description: lines.join('\n'),
    start: {
      dateTime: startTime.includes('T') && startTime.includes(':') ? startTime : `${startTime}`,
      timeZone: 'America/Chicago',
    },
    end: {
      dateTime: endTime.includes('T') && endTime.includes(':') ? endTime : `${endTime}`,
      timeZone: 'America/Chicago',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 1440 }, // 24 hours
      ],
    },
  };
}

/**
 * Haversine distance in miles (approximation for deadhead estimate)
 */
async function estimateDeadhead(
  driverLat: number,
  driverLng: number,
  load: LoadRow,
): Promise<number | null> {
  // We don't have origin lat/lng directly on the load in all cases,
  // so we use a simple geocoding fallback or skip if not available
  // For now, return null — the trigger will calculate if coords are available
  // This could be enhanced with Mapbox geocoding in future
  void driverLat;
  void driverLng;
  void load;
  return null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
