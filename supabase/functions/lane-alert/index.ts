import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * lane-alert: Triggered on new load INSERT via Supabase webhook/trigger.
 * Checks all saved searches with alert_enabled = true,
 * notifies matching users via in-app notification + email queue.
 *
 * Expects POST body: { load: LoadRow }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    // Support both direct call and Supabase webhook payload
    const load = body.load ?? body.record ?? body;

    if (!load?.id) {
      return new Response(JSON.stringify({ error: 'load object required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all alert-enabled saved searches
    const { data: searches } = await supabase
      .from('saved_searches')
      .select('*, profiles!inner(id, email, full_name)')
      .eq('alert_enabled', true);

    if (!searches || searches.length === 0) {
      return new Response(JSON.stringify({ matched: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let matched = 0;

    for (const search of searches) {
      const filters = search.filters as Record<string, unknown>;
      if (!matchesFilters(load, filters)) continue;

      matched++;

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: search.user_id,
        type: 'lane_alert',
        title: `Lane Alert: ${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}`,
        body: `New ${load.equipment} load matching "${search.name}" — $${load.rate_usd?.toLocaleString() ?? 'Call'}`,
        load_id: load.id,
        read: false,
      });

      // Enqueue email
      const profile = Array.isArray(search.profiles) ? search.profiles[0] : search.profiles;
      if (profile?.email) {
        await supabase.rpc('enqueue_notification', {
          p_type: 'email',
          p_recipient: profile.email,
          p_subject: `Lane Alert: New load on ${load.origin_state}→${load.dest_state}`,
          p_payload: {
            template: 'lane_alert',
            data: {
              search_name: search.name,
              load_number: load.load_number,
              origin: `${load.origin_city}, ${load.origin_state}`,
              dest: `${load.dest_city}, ${load.dest_state}`,
              rate: load.rate_usd,
              equipment: load.equipment,
              miles: load.total_miles,
            },
          },
        });
      }

      // Update last_alerted_at
      await supabase
        .from('saved_searches')
        .update({ last_alerted_at: new Date().toISOString() })
        .eq('id', search.id);
    }

    return new Response(JSON.stringify({ matched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function matchesFilters(load: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  if (filters.equipment && filters.equipment !== 'all' && load.equipment !== filters.equipment) {
    return false;
  }
  if (filters.origin_state && load.origin_state !== filters.origin_state) {
    return false;
  }
  if (filters.dest_state && load.dest_state !== filters.dest_state) {
    return false;
  }
  if (
    typeof filters.min_rate_per_mile === 'number' &&
    typeof load.rate_per_mile === 'number' &&
    load.rate_per_mile < filters.min_rate_per_mile
  ) {
    return false;
  }
  return true;
}
