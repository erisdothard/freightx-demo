import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'npm:zod@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Haiku — fast, cheap, deterministic. Used for query parsing.
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
// Sonnet — complex reasoning. Used for rate suggestions.
const MODEL_SONNET = 'claude-sonnet-4-6';

interface ParsedFilters {
  equipment?: string;
  search?: string;
  origin_state?: string;
  dest_states?: string[];
  pickup_within_days?: number;
  min_rate_per_mile?: number;
}

interface LaneStats {
  avg_rate_per_mile: number | null;
  min_rate_per_mile: number | null;
  max_rate_per_mile: number | null;
  sample_count: number;
}

interface RateSuggestion {
  suggested_low: number;
  suggested_mid: number;
  suggested_high: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  sample_count: number;
}

/**
 * Keyword-based fallback parser — no API key required.
 */
function keywordParse(query: string): ParsedFilters {
  const q = query.toLowerCase();
  const filters: ParsedFilters = {};

  if (q.includes('flatbed')) filters.equipment = 'flatbed';
  else if (q.includes('reefer') || q.includes('refrigerated')) filters.equipment = 'reefer';
  else if (q.includes('step deck') || q.includes('stepdeck')) filters.equipment = 'step_deck';
  else if (q.includes('lowboy')) filters.equipment = 'lowboy';
  else if (q.includes('tanker')) filters.equipment = 'tanker';
  else if (q.includes('box truck') || q.includes('box van')) filters.equipment = 'box_truck';
  else if (q.includes('sprinter')) filters.equipment = 'sprinter';
  else if (q.includes('van') || q.includes('dry van')) filters.equipment = 'van';

  if (q.includes('today') || q.includes('asap')) filters.pickup_within_days = 1;
  else if (q.includes('tomorrow')) filters.pickup_within_days = 2;
  else if (q.includes('this week')) filters.pickup_within_days = 7;

  const stateMap: Record<string, string> = {
    texas: 'TX',
    california: 'CA',
    florida: 'FL',
    'new york': 'NY',
    illinois: 'IL',
    ohio: 'OH',
    georgia: 'GA',
    michigan: 'MI',
    pennsylvania: 'PA',
    'north carolina': 'NC',
    tennessee: 'TN',
    arizona: 'AZ',
    indiana: 'IN',
    missouri: 'MO',
    wisconsin: 'WI',
    colorado: 'CO',
    washington: 'WA',
    oregon: 'OR',
    nevada: 'NV',
    oklahoma: 'OK',
    louisiana: 'LA',
    alabama: 'AL',
    kentucky: 'KY',
  };
  for (const [name, code] of Object.entries(stateMap)) {
    if (q.includes(name) || q.includes(code.toLowerCase())) {
      const originPattern = new RegExp(`(out of|from|leaving|departing).*${name}`);
      if (originPattern.test(q)) {
        filters.origin_state = code;
      }
    }
  }

  const stripped = query
    .replace(/\b(flatbed|reefer|van|tanker|lowboy|sprinter|step deck)\b/gi, '')
    .replace(/\b(today|tomorrow|this week|asap|monday|tuesday|wednesday|thursday|friday)\b/gi, '')
    .replace(/\b(load|loads|out of|from|going|heading|to the|good rate|high rate)\b/gi, '')
    .trim();
  if (stripped.length > 2) filters.search = stripped;

  return filters;
}

// ── Context Injection Helpers ───────────────────────────────────────────

/**
 * Fetch national avg diesel price from EIA API (free, no key needed).
 * Returns a formatted string or null on failure.
 */
async function fetchFuelPrice(): Promise<string | null> {
  try {
    const url =
      'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly&data[0]=value&facets[product][]=EPD2D&facets[duession][]=NUS&sort[0][column]=period&sort[0][direction]=desc&length=1&api_key=DEMO_KEY';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.response?.data?.[0]?.value;
    const period = data?.response?.data?.[0]?.period;
    if (price) return `National avg diesel: $${Number(price).toFixed(2)}/gal (week of ${period})`;
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch avg dwell time at facilities in the origin/dest states from dwell_records.
 * Returns a formatted string or null.
 */
async function fetchDetentionHistory(
  originState: string,
  destState: string,
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return null;

    const sb = createClient(supabaseUrl, serviceKey);

    // Query dwell records that were flagged for detention in the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from('dwell_records')
      .select('dwell_minutes, stop_type')
      .gte('created_at', ninetyDaysAgo)
      .not('dwell_minutes', 'is', null)
      .limit(200);

    if (!data || data.length === 0) return null;

    const pickupDwells = data.filter((d: any) => d.stop_type === 'pickup');
    const deliveryDwells = data.filter((d: any) => d.stop_type === 'delivery');

    const avgPickup =
      pickupDwells.length > 0
        ? Math.round(
            pickupDwells.reduce((sum: number, d: any) => sum + d.dwell_minutes, 0) /
              pickupDwells.length,
          )
        : null;
    const avgDelivery =
      deliveryDwells.length > 0
        ? Math.round(
            deliveryDwells.reduce((sum: number, d: any) => sum + d.dwell_minutes, 0) /
              deliveryDwells.length,
          )
        : null;

    const parts: string[] = [];
    if (avgPickup != null) parts.push(`Avg pickup dwell: ${avgPickup} min`);
    if (avgDelivery != null) parts.push(`Avg delivery dwell: ${avgDelivery} min`);
    if (parts.length === 0) return null;
    return `Detention history (last 90d, ${data.length} samples): ${parts.join(', ')}`;
  } catch {
    return null;
  }
}

/**
 * Fetch 3-day weather forecast for origin/dest using Open-Meteo (free, no key).
 * Uses state capital coordinates as proxy when exact coords aren't available.
 */
async function fetchWeather(originState: string, destState: string): Promise<string | null> {
  // State capital coordinates (subset)
  const stateCoords: Record<string, { lat: number; lng: number; city: string }> = {
    AL: { lat: 32.377, lng: -86.3, city: 'Montgomery' },
    AZ: { lat: 33.449, lng: -112.074, city: 'Phoenix' },
    CA: { lat: 38.577, lng: -121.494, city: 'Sacramento' },
    CO: { lat: 39.739, lng: -104.985, city: 'Denver' },
    FL: { lat: 30.438, lng: -84.281, city: 'Tallahassee' },
    GA: { lat: 33.749, lng: -84.388, city: 'Atlanta' },
    IL: { lat: 39.798, lng: -89.654, city: 'Springfield' },
    IN: { lat: 39.768, lng: -86.158, city: 'Indianapolis' },
    KY: { lat: 38.187, lng: -84.875, city: 'Frankfort' },
    LA: { lat: 30.457, lng: -91.187, city: 'Baton Rouge' },
    MI: { lat: 42.733, lng: -84.555, city: 'Lansing' },
    MO: { lat: 38.577, lng: -92.173, city: 'Jefferson City' },
    NC: { lat: 35.78, lng: -78.639, city: 'Raleigh' },
    NV: { lat: 39.164, lng: -119.767, city: 'Carson City' },
    NY: { lat: 42.653, lng: -73.757, city: 'Albany' },
    OH: { lat: 39.962, lng: -83.001, city: 'Columbus' },
    OK: { lat: 35.473, lng: -97.517, city: 'Oklahoma City' },
    OR: { lat: 44.938, lng: -123.03, city: 'Salem' },
    PA: { lat: 40.264, lng: -76.884, city: 'Harrisburg' },
    TN: { lat: 36.166, lng: -86.784, city: 'Nashville' },
    TX: { lat: 30.267, lng: -97.743, city: 'Austin' },
    WA: { lat: 47.043, lng: -122.893, city: 'Olympia' },
    WI: { lat: 43.075, lng: -89.384, city: 'Madison' },
  };

  const origin = stateCoords[originState];
  const dest = stateCoords[destState];
  if (!origin && !dest) return null;

  async function getWeatherStr(
    coords: { lat: number; lng: number; city: string },
    label: string,
  ): Promise<string | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&forecast_days=3&timezone=America%2FChicago`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      const daily = data?.daily;
      if (!daily?.time?.length) return null;

      const days = daily.time
        .map((date: string, i: number) => {
          const hi = daily.temperature_2m_max[i];
          const lo = daily.temperature_2m_min[i];
          const rain = daily.precipitation_sum[i];
          const wind = daily.windspeed_10m_max[i];
          return `${date}: ${Math.round(lo)}-${Math.round(hi)}F, ${rain > 0.01 ? `${rain.toFixed(1)}in precip` : 'dry'}, wind ${Math.round(wind)}mph`;
        })
        .join(' | ');

      return `${label} (${coords.city}): ${days}`;
    } catch {
      return null;
    }
  }

  const results = await Promise.all([
    origin ? getWeatherStr(origin, 'Origin') : null,
    dest ? getWeatherStr(dest, 'Dest') : null,
  ]);

  const valid = results.filter(Boolean);
  return valid.length > 0 ? valid.join('\n') : null;
}

/**
 * Build enriched context string for rate suggestion prompt.
 * Fetches fuel prices, detention history, and weather in parallel.
 * All external calls are non-blocking — failures return null gracefully.
 */
async function buildContext(originState: string, destState: string): Promise<string> {
  const [fuel, detention, weather] = await Promise.all([
    fetchFuelPrice(),
    fetchDetentionHistory(originState, destState),
    fetchWeather(originState, destState),
  ]);

  const parts: string[] = [];
  if (fuel) parts.push(fuel);
  if (detention) parts.push(detention);
  if (weather) parts.push(weather);

  return parts.length > 0 ? '\n\nAdditional market context:\n' + parts.join('\n') : '';
}

/**
 * Suggest rate using Claude Sonnet — complex market reasoning.
 */
async function suggestRateWithSonnet(params: {
  originState: string;
  destState: string;
  equipment: string;
  totalMiles: number;
  laneStats: LaneStats;
  apiKey: string;
}): Promise<RateSuggestion> {
  const { originState, destState, equipment, totalMiles, laneStats, apiKey } = params;

  const hasData = laneStats.sample_count > 0 && laneStats.avg_rate_per_mile != null;

  // Fetch enriched context (fuel, detention, weather) in parallel
  const contextStr = await buildContext(originState, destState);

  const systemPrompt = `You are a freight rate analyst for a trucking marketplace.
Given lane data, suggest a competitive rate range for a load posting.
Return ONLY valid JSON with these exact fields:
- suggested_low: number ($/mile — low end of competitive range)
- suggested_mid: number ($/mile — midpoint, recommended posting rate)
- suggested_high: number ($/mile — premium rate)
- confidence: "high" | "medium" | "low" (based on sample size and data recency)
- reasoning: string (1-2 sentences explaining the suggestion, mention key factors)
- sample_count: number (pass through from input)

Consider: equipment type premium, lane direction (headhaul vs backhaul), fuel costs, driver availability, weather conditions, and detention risk.
For reefer: add $0.15-0.25/mi premium. For flatbed: add $0.10-0.20/mi premium.
For low sample counts (<5): widen the range and lower confidence.
If weather shows precipitation or high winds, note potential delays.
If detention history shows high dwell times, factor detention risk into pricing.`;

  const userMessage = `Lane: ${originState} → ${destState}
Equipment: ${equipment}
Distance: ${totalMiles} miles
${
  hasData
    ? `Historical data (last 90 days):
  - Avg rate/mile: $${laneStats.avg_rate_per_mile}
  - Min: $${laneStats.min_rate_per_mile}, Max: $${laneStats.max_rate_per_mile}
  - Sample count: ${laneStats.sample_count}`
    : 'No historical data for this lane yet.'
}${contextStr}

Suggest a competitive rate range for this load.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL_SONNET,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const claudeData = await response.json();
  const text = claudeData?.content?.[0]?.text ?? '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Sonnet response');

  const result = JSON.parse(jsonMatch[0]) as RateSuggestion;
  result.sample_count = laneStats.sample_count;
  return result;
}

/**
 * Fallback rate suggestion when no API key or Sonnet fails.
 * Uses simple market heuristics.
 */
function fallbackRateSuggestion(params: {
  equipment: string;
  totalMiles: number;
  laneStats: LaneStats;
}): RateSuggestion {
  const { equipment, laneStats } = params;

  let base = 2.2; // national avg dry van
  if (equipment === 'reefer') base = 2.55;
  else if (equipment === 'flatbed') base = 2.45;
  else if (equipment === 'step_deck') base = 2.6;
  else if (equipment === 'lowboy') base = 3.0;
  else if (equipment === 'tanker') base = 2.8;

  // Use historical data if available
  if (laneStats.sample_count > 0 && laneStats.avg_rate_per_mile != null) {
    base = laneStats.avg_rate_per_mile;
  }

  return {
    suggested_low: +(base * 0.92).toFixed(2),
    suggested_mid: +base.toFixed(2),
    suggested_high: +(base * 1.12).toFixed(2),
    confidence:
      laneStats.sample_count >= 10 ? 'high' : laneStats.sample_count >= 3 ? 'medium' : 'low',
    reasoning:
      laneStats.sample_count > 0
        ? `Based on ${laneStats.sample_count} recent transactions on this lane.`
        : 'Based on national averages for this equipment type. No lane-specific data yet.',
    sample_count: laneStats.sample_count,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RequestBodySchema = z.object({
      action: z.string().optional(),
      query: z.string().optional(),
      origin_state: z.string().optional(),
      dest_state: z.string().optional(),
      equipment: z.string().optional(),
      total_miles: z.number().positive().optional(),
      lane_stats: z
        .object({
          avg_rate_per_mile: z.number().nullable(),
          min_rate_per_mile: z.number().nullable(),
          max_rate_per_mile: z.number().nullable(),
          sample_count: z.number(),
        })
        .optional(),
    });

    const parseResult = RequestBodySchema.safeParse(await req.json());
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const body = parseResult.data;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

    // ── Mode: suggest_rate (Claude Sonnet) ────────────────────────────────────
    if (body.action === 'suggest_rate') {
      const { origin_state, dest_state, equipment, total_miles, lane_stats } = body;

      if (!origin_state || !dest_state || !equipment || !total_miles) {
        return new Response(
          JSON.stringify({ error: 'origin_state, dest_state, equipment, total_miles required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const stats: LaneStats = lane_stats ?? {
        avg_rate_per_mile: null,
        min_rate_per_mile: null,
        max_rate_per_mile: null,
        sample_count: 0,
      };

      if (!apiKey) {
        const suggestion = fallbackRateSuggestion({
          equipment,
          totalMiles: total_miles,
          laneStats: stats,
        });
        return new Response(JSON.stringify(suggestion), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const suggestion = await suggestRateWithSonnet({
          originState: origin_state,
          destState: dest_state,
          equipment,
          totalMiles: total_miles,
          laneStats: stats,
          apiKey,
        });
        return new Response(JSON.stringify(suggestion), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        // Fallback on Sonnet failure
        console.error('[ai-load-search] Sonnet rate suggestion failed:', err);
        const suggestion = fallbackRateSuggestion({
          equipment,
          totalMiles: total_miles,
          laneStats: stats,
        });
        return new Response(JSON.stringify(suggestion), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Mode: parse_query (Claude Haiku) ──────────────────────────────────────
    const { query } = body;

    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      const filters = keywordParse(query);
      return new Response(JSON.stringify(filters), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a freight load search parser.
Given a carrier's natural language description of the load they want, extract structured search filters.
Return ONLY valid JSON with these optional fields:
- equipment: one of "van" | "reefer" | "flatbed" | "step_deck" | "lowboy" | "tanker" | "box_truck" | "sprinter"
- origin_state: 2-letter US state code (where the load should pick up)
- dest_states: array of 2-letter US state codes (where the load should deliver)
- pickup_within_days: number (how many days until pickup — e.g. "this week" = 7, "today" = 1)
- min_rate_per_mile: number (minimum $/mile the carrier wants)
- search: string (any other keywords like city name or commodity)
Only include fields that are clearly mentioned. Return empty object {} if nothing is clear.`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_HAIKU,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      const filters = keywordParse(query);
      return new Response(JSON.stringify(filters), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await response.json();
    const text = claudeData?.content?.[0]?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const filters: ParsedFilters = jsonMatch ? JSON.parse(jsonMatch[0]) : keywordParse(query);

    return new Response(JSON.stringify(filters), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Parse failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
