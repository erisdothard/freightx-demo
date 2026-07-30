import { supabase } from '@/lib/supabase';
import type { Load } from '@freightx/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function generateHexToken(length = 32): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a shareable tracking token for a load.
 * Returns the token string (not the full record).
 */
export async function createTrackingToken(loadNumber: string, createdBy: string): Promise<string> {
  const token = generateHexToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db.from('tracking_tokens').insert({
    load_number: loadNumber,
    token,
    created_by: createdBy,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);
  return token;
}

/**
 * Get load info by tracking token (for public tracking page).
 * Uses anon access — no auth required.
 */
export async function getLoadByToken(token: string): Promise<{
  loadNumber: string;
  load: Load | null;
} | null> {
  // Validate token
  const { data: tokenRow, error } = await db
    .from('tracking_tokens')
    .select('load_number, expires_at, revoked')
    .eq('token', token)
    .single();

  if (error || !tokenRow) return null;
  if (tokenRow.revoked) return null;
  if (new Date(tokenRow.expires_at as string) < new Date()) return null;

  const loadNumber = tokenRow.load_number as string;

  // Fetch load details
  const { data: loadRow } = await supabase
    .from('loads')
    .select('*')
    .eq('load_number', loadNumber)
    .single();

  if (!loadRow) return { loadNumber, load: null };

  return {
    loadNumber,
    load: {
      id: loadRow.id,
      loadNumber: loadRow.load_number,
      postedBy: loadRow.posted_by,
      companyName: loadRow.company_name ?? '',
      originCity: loadRow.origin_city,
      originState: loadRow.origin_state,
      destCity: loadRow.dest_city,
      destState: loadRow.dest_state,
      pickupDate: loadRow.pickup_date,
      deliveryDate: loadRow.delivery_date,
      equipment: loadRow.equipment,
      commodity: loadRow.commodity ?? '',
      weightLbs: loadRow.weight_lbs,
      rateUsd: loadRow.rate_usd,
      ratePerMile: loadRow.rate_per_mile ?? 0,
      status: loadRow.status,
    } as Load,
  };
}

export async function revokeToken(token: string): Promise<void> {
  const { error } = await db.from('tracking_tokens').update({ revoked: true }).eq('token', token);
  if (error) throw new Error(error.message);
}
