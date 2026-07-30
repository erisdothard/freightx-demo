import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const checks = {
    database: { status: 'unknown', responseTime: 0, error: null },
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check database connectivity
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);

      checks.database = {
        status: error ? 'fail' : 'pass',
        responseTime: Date.now() - dbStart,
        error: error?.message || null,
      };
    } catch (e) {
      checks.database = {
        status: 'fail',
        responseTime: Date.now() - dbStart,
        error: e.message,
      };
    }

    // Determine overall health
    const healthy = checks.database.status === 'pass';

    return new Response(
      JSON.stringify({
        status: healthy ? 'healthy' : 'unhealthy',
        checks,
      }),
      {
        status: healthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        checks,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
