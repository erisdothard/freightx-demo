import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

interface InviteRequest {
  email: string;
  full_name?: string;
  phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (headers: Record<string, string>, status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

  try {
    const { email, full_name, phone } = (await req.json()) as InviteRequest;
    if (!email) {
      return json(corsHeaders, 400, { error: 'email is required' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://freightx.app';

    // ── 1. Verify caller identity via anon client + JWT ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(corsHeaders, 401, { error: 'Missing authorization header' });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return json(corsHeaders, 401, { error: 'Unauthorized' });
    }

    // ── 2. Look up caller's company + role via company_members ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership, error: memberError } = await adminClient
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', caller.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .single();

    if (memberError || !membership) {
      return json(corsHeaders, 403, { error: 'Only company owners/admins can invite drivers' });
    }

    const companyId = membership.company_id;

    // Get company name for the email
    const { data: company } = await adminClient
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // ── 3. Generate invite link via admin API ──
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${appUrl}/claim-account`,
        data: {
          role: 'driver',
          carrier_id: companyId,
          status: 'invited',
          full_name: full_name ?? '',
        },
      },
    });

    if (linkError || !linkData?.user) {
      return json(corsHeaders, 500, { error: linkError?.message ?? 'Failed to generate invite link' });
    }

    const userId = linkData.user.id;
    const signupLink = linkData.properties?.action_link ?? '';

    // ── 4. Update profile with phone if provided ──
    if (phone) {
      await adminClient
        .from('profiles')
        .update({ phone })
        .eq('id', userId);
    }

    // ── 5. Insert company_members row ──
    await adminClient.from('company_members').upsert(
      { company_id: companyId, user_id: userId, role: 'driver' },
      { onConflict: 'company_id,user_id' },
    );

    // ── 6. Fire-and-forget: send invite email ──
    const callerProfile = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', caller.id)
      .single();

    // Call send-notification-email edge function (fire-and-forget)
    fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: `You're invited to join ${company?.name ?? 'a team'} on FreightX`,
        template: 'company_invite',
        data: {
          invited_by_name: callerProfile?.data?.full_name ?? 'Your carrier',
          company_name: company?.name ?? 'the team',
          role: 'Driver',
          invite_url: signupLink,
          expires_at: '7 days from now',
        },
      }),
    }).catch((err) => console.error('[invite-driver] email send failed:', err));

    // ── 7. Return signup link ──
    return json(corsHeaders, 200, {
      signup_link: signupLink,
      user_id: userId,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
