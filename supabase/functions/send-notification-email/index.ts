import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

// Role-aware HTML email templates
function buildEmailHtml(template: string, data: Record<string, unknown>): string {
  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0a0a0a; color: #e8e8e8; padding: 40px 20px; max-width: 600px; margin: 0 auto;
  `;
  const cardStyle = `
    background: #141414; border: 1px solid #2a2a2a; border-radius: 16px; padding: 32px;
  `;
  const accentColor = '#E86030';
  const mutedColor = '#888';

  const header = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:900;color:${accentColor};letter-spacing:-0.5px;">FreightX</span>
    </div>`;

  const footer = `
    <div style="text-align:center;margin-top:32px;font-size:11px;color:${mutedColor};">
      FreightX · Real-time freight management · <a href="https://freightx.app" style="color:${accentColor};text-decoration:none;">freightx.app</a>
    </div>`;

  const templates: Record<string, string> = {
    new_bid: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">New Bid Received</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">A carrier has submitted a bid on your load.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="font-size:13px;color:${mutedColor};margin-bottom:4px;">Load</div>
            <div style="font-size:16px;font-weight:600;color:#fff;">${data.load_number ?? ''} · ${data.origin ?? ''} → ${data.dest ?? ''}</div>
          </div>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="font-size:13px;color:${mutedColor};margin-bottom:4px;">Bid Amount</div>
            <div style="font-size:28px;font-weight:900;color:${accentColor};">$${data.amount?.toLocaleString() ?? ''}</div>
            <div style="font-size:13px;color:${mutedColor};margin-top:4px;">from ${data.carrier_name ?? 'Unknown Carrier'}</div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">Review Bid</a>
        </div>
        ${footer}
      </div>`,

    bid_accepted: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Your Bid Was Accepted!</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">Congratulations — you've been awarded the load.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="font-size:13px;color:${mutedColor};margin-bottom:4px;">Load</div>
            <div style="font-size:16px;font-weight:600;color:#fff;">${data.load_number ?? ''} · ${data.origin ?? ''} → ${data.dest ?? ''}</div>
            <div style="font-size:13px;color:${mutedColor};margin-top:8px;">Pickup: ${data.pickup_date ?? ''}</div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">View Load Details</a>
        </div>
        ${footer}
      </div>`,

    bid_declined: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Bid Update</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">Your bid on load <strong style="color:#fff;">${data.load_number ?? ''}</strong> was not selected this time.</p>
          <p style="font-size:14px;color:${mutedColor};">Keep checking the load board — new loads are posted daily.</p>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;margin-top:24px;">Browse Open Loads</a>
        </div>
        ${footer}
      </div>`,

    booking_confirmed: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Booking Confirmed</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">Load <strong style="color:#fff;">${data.load_number ?? ''}</strong> has been booked.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
              <span style="font-size:13px;color:${mutedColor};">Route</span>
              <span style="font-size:13px;font-weight:600;color:#fff;">${data.origin ?? ''} → ${data.dest ?? ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
              <span style="font-size:13px;color:${mutedColor};">Pickup</span>
              <span style="font-size:13px;font-weight:600;color:#fff;">${data.pickup_date ?? ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:13px;color:${mutedColor};">Rate</span>
              <span style="font-size:13px;font-weight:600;color:${accentColor};">$${data.amount?.toLocaleString() ?? ''}</span>
            </div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">View Booking</a>
        </div>
        ${footer}
      </div>`,

    load_status_change: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Load Status Update</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">Load <strong style="color:#fff;">${data.load_number ?? ''}</strong> status changed.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
            <div style="font-size:13px;color:${mutedColor};margin-bottom:8px;">New Status</div>
            <div style="font-size:22px;font-weight:900;color:${accentColor};text-transform:uppercase;letter-spacing:1px;">${String(data.status ?? '').replace(/_/g, ' ')}</div>
            <div style="font-size:12px;color:${mutedColor};margin-top:4px;">${data.load_number ?? ''} · ${data.origin ?? ''} → ${data.dest ?? ''}</div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">Track Load</a>
        </div>
        ${footer}
      </div>`,

    new_message: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">New Message</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">You have a new message from <strong style="color:#fff;">${data.sender_name ?? 'someone'}</strong>.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;border-left:3px solid ${accentColor};">
            <p style="font-size:14px;color:#e8e8e8;margin:0;line-height:1.6;">"${data.preview ?? ''}"</p>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">Reply</a>
        </div>
        ${footer}
      </div>`,

    bol_signed: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">BOL Signed</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">The Bill of Lading for load <strong style="color:#fff;">${data.load_number ?? ''}</strong> has been signed.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="font-size:13px;color:${mutedColor};margin-bottom:4px;">Route</div>
            <div style="font-size:16px;font-weight:600;color:#fff;">${data.origin ?? ''} → ${data.dest ?? ''}</div>
            <div style="font-size:13px;color:${mutedColor};margin-top:12px;">Signed by</div>
            <div style="font-size:14px;font-weight:600;color:${accentColor};">${data.signed_by ?? ''}</div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">View Document</a>
        </div>
        ${footer}
      </div>`,

    lane_alert: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          ${header}
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Lane Alert: New Load Match</h2>
          <p style="color:${mutedColor};margin:0 0 24px;font-size:14px;">A new load matches your saved search <strong style="color:#fff;">"${data.search_name ?? ''}"</strong>.</p>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px;">${data.load_number ?? ''}</div>
            <div style="font-size:14px;color:${mutedColor};">${data.origin ?? ''} → ${data.dest ?? ''}</div>
            <div style="font-size:20px;font-weight:900;color:${accentColor};margin-top:12px;">$${data.rate?.toLocaleString() ?? 'Call'}</div>
            <div style="font-size:12px;color:${mutedColor};margin-top:2px;">${data.equipment ?? ''} · ${data.miles ?? ''} mi</div>
          </div>
          <a href="https://freightx.app" style="display:block;background:${accentColor};color:#fff;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;">View Load</a>
        </div>
        ${footer}
      </div>`,
  };

  return templates[template] ?? templates.new_message;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as EmailPayload;
    const { to, subject, template, data } = payload;

    if (!to || !subject || !template) {
      return new Response(JSON.stringify({ error: 'to, subject, and template are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      // Dev mode: log and return success
      console.log('[email-dry-run]', { to, subject, template, data });
      return new Response(JSON.stringify({ id: 'dry-run', status: 'logged' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildEmailHtml(template, data);

    const emailBody: Record<string, unknown> = {
      from: 'FreightX <notifications@freightx.app>',
      to: [to],
      subject,
      html,
    };

    // Attach signed BOL PDF when available
    if (template === 'bol_signed' && data.bol_pdf_url) {
      emailBody.attachments = [
        {
          filename: `BOL-${data.load_number ?? 'document'}.pdf`,
          path: data.bol_pdf_url as string,
        },
      ];
    }

    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[send-notification-email] Resend error:', errBody);
      return new Response(JSON.stringify({ error: 'Email delivery failed', detail: errBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resp.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
