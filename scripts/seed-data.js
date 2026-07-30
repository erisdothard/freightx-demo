#!/usr/bin/env node
/**
 * FreightX — Full Test Environment Seed
 *
 * Creates 3 test users (broker, carrier, shipper), their companies,
 * 10 loads across every status, 3 trucks, and bids so you can see the full
 * app running immediately.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed
 *
 * The VITE_SUPABASE_URL is read from apps/web/.env.local automatically.
 * SUPABASE_SERVICE_ROLE_KEY comes from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 * ⚠️  Dev / staging only. Set ALLOW_PROD_SEED=yes to override the remote guard.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load env from apps/web/.env.local ────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../apps/web/.env.local');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local missing — rely on shell env
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing env vars.');
  console.error('    VITE_SUPABASE_URL   — should be in apps/web/.env.local');
  console.error('    SUPABASE_SERVICE_ROLE_KEY — from Supabase Dashboard → Settings → API');
  process.exit(1);
}

if (!supabaseUrl.includes('localhost') && process.env.ALLOW_PROD_SEED !== 'yes') {
  console.error(
    '⛔  Remote Supabase detected. Set ALLOW_PROD_SEED=yes to continue (staging only).',
  );
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Config ────────────────────────────────────────────────────────────────────
// Password for the seeded @freightx.com test accounts. Override via env so a
// known credential is never baked into the repo.
const PASSWORD = process.env.SEED_PASSWORD ?? `seed-${Math.random().toString(36).slice(2, 14)}!A1`;

const TEST_USERS = [
  { idKey: 'broker', email: 'broker@freightx.com', full_name: 'Test Broker', role: 'broker' },
  { idKey: 'carrier', email: 'carrier@freightx.com', full_name: 'Test Carrier', role: 'carrier' },
  { idKey: 'shipper', email: 'shipper@freightx.com', full_name: 'Test Shipper', role: 'shipper' },
  { idKey: 'driver', email: 'driver@freightx.com', full_name: 'Test Driver', role: 'driver' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  console.log('  ' + msg);
}
function warn(msg) {
  console.warn('  ⚠  ' + msg);
}
function header(msg) {
  console.log('\n' + msg);
}

async function upsertUser({ email, full_name, role }) {
  // Try to create first
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (!error) {
    log(`✅  ${email} created`);
    return data.user.id;
  }

  // User already exists — look up by profile email and update password
  if (
    error.message.includes('already') ||
    error.message.includes('exists') ||
    error.status === 422
  ) {
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (profile) {
      await sb.auth.admin.updateUserById(profile.id, { password: PASSWORD });
      log(`↩  ${email} (existing) - Updated password`);
      return profile.id;
    }
  }

  throw new Error(`createUser ${email}: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('FreightX Seed — ' + new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── 1. Auth Users ──────────────────────────────────────────────────────────
  header('1/6  Auth Users');
  const ids = {};
  for (const u of TEST_USERS) {
    ids[u.idKey] = await upsertUser(u);
  }

  // ── 2. Profiles ────────────────────────────────────────────────────────────
  header('2/6  Profiles');
  for (const u of TEST_USERS) {
    const { error } = await sb.from('profiles').upsert(
      {
        id: ids[u.idKey],
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        onboarding_complete: true,
        phone: '555-000-000' + TEST_USERS.indexOf(u),
      },
      { onConflict: 'id' },
    );
    if (error) warn(`profile ${u.email}: ${error.message}`);
    else log(`✅  ${u.email}`);
  }

  // ── 3. Companies ───────────────────────────────────────────────────────────
  header('3/6  Companies');
  const companyDefs = [
    {
      key: 'broker',
      owner_id: ids.broker,
      type: 'broker',
      name: 'Blue Sky Freight LLC',
      mc_number: 'MC-111222',
      broker_authority: 'Active',
      address: '233 S Wacker Dr',
      city: 'Chicago',
      state: 'IL',
      zip: '60606',
      phone: '312-555-0100',
      email: 'broker@freightx.dev',
      verified: true,
      rating: 4.7,
      total_loads: 412,
      on_time_percent: 94,
      broker_credit_score: 92,
    },
    {
      key: 'carrier',
      owner_id: ids.carrier,
      type: 'carrier',
      name: 'Rivera Transport Inc',
      mc_number: 'MC-334455',
      dot_number: 'DOT-9988776',
      address: '4400 Belt Line Rd',
      city: 'Dallas',
      state: 'TX',
      zip: '75244',
      phone: '972-555-0200',
      email: 'carrier@freightx.dev',
      verified: true,
      rating: 4.9,
      total_loads: 284,
      on_time_percent: 97,
    },
    {
      key: 'shipper',
      owner_id: ids.shipper,
      type: 'shipper',
      name: 'Lee Manufacturing Co',
      address: '1 Peachtree Center',
      city: 'Atlanta',
      state: 'GA',
      zip: '30303',
      phone: '404-555-0300',
      email: 'shipper@freightx.dev',
      verified: true,
      rating: 4.5,
      total_loads: 103,
      on_time_percent: 91,
    },
  ];

  const companyIds = {};
  for (const c of companyDefs) {
    const { data: existing } = await sb
      .from('companies')
      .select('id')
      .eq('owner_id', c.owner_id)
      .maybeSingle();
    if (existing) {
      companyIds[c.key] = existing.id;
      log(`↩  ${c.name} (existing)`);
      continue;
    }
    const { key, broker_credit_score, ...insert } = c;
    const { data, error } = await sb.from('companies').insert(insert).select('id').single();
    if (error) {
      warn(`company ${c.name}: ${error.message}`);
      continue;
    }
    companyIds[c.key] = data.id;
    log(`✅  ${c.name}`);
  }

  // ── 3.5. Broker Payment Metrics ────────────────────────────────────────────
  header('3.5/6  Broker Payment Metrics');
  if (companyIds.broker) {
    const { error } = await sb.from('broker_payment_metrics').upsert(
      {
        company_id: companyIds.broker,
        avg_days_to_pay: 14.2,
        payment_count: 47,
        on_time_pct: 93.6,
        total_paid_usd: 128450.0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    );

    if (error) warn(`broker payment metrics: ${error.message}`);
    else log('✅  Broker payment metrics seeded');
  }

  // ── 4. Loads ───────────────────────────────────────────────────────────────
  header('4/6  Loads');

  const loadsData = [
    // ── Posted (open for bids)
    {
      load_number: 'FX-TEST-0001',
      status: 'posted',
      origin_city: 'Chicago',
      origin_state: 'IL',
      dest_city: 'Dallas',
      dest_state: 'TX',
      equipment: 'van',
      commodity: 'General Freight',
      weight_lbs: 42000,
      rate_usd: 2800,
      rate_per_mile: 2.1,
      total_miles: 933,
      pickup_date: '2026-04-01',
      delivery_date: '2026-04-03',
      hazmat: false,
      temp_controlled: false,
      bid_count: 0,
    },
    {
      load_number: 'FX-TEST-0002',
      status: 'posted',
      origin_city: 'Atlanta',
      origin_state: 'GA',
      dest_city: 'Miami',
      dest_state: 'FL',
      equipment: 'reefer',
      commodity: 'Fresh Produce',
      weight_lbs: 38000,
      rate_usd: 1950,
      rate_per_mile: 3.1,
      total_miles: 662,
      pickup_date: '2026-04-05',
      delivery_date: '2026-04-06',
      hazmat: false,
      temp_controlled: true,
      bid_count: 0,
    },
    {
      load_number: 'FX-TEST-0003',
      status: 'posted',
      origin_city: 'Los Angeles',
      origin_state: 'CA',
      dest_city: 'Phoenix',
      dest_state: 'AZ',
      equipment: 'flatbed',
      commodity: 'Steel Coils',
      weight_lbs: 44000,
      rate_usd: 1400,
      rate_per_mile: 2.4,
      total_miles: 370,
      pickup_date: '2026-04-07',
      delivery_date: '2026-04-08',
      hazmat: false,
      temp_controlled: false,
      bid_count: 0,
    },
    {
      load_number: 'FX-TEST-0004',
      status: 'posted',
      origin_city: 'Houston',
      origin_state: 'TX',
      dest_city: 'Nashville',
      dest_state: 'TN',
      equipment: 'van',
      commodity: 'Auto Parts',
      weight_lbs: 36000,
      rate_usd: 2200,
      rate_per_mile: 2.2,
      total_miles: 793,
      pickup_date: '2026-04-08',
      delivery_date: '2026-04-10',
      hazmat: false,
      temp_controlled: false,
      bid_count: 0,
    },
    {
      load_number: 'FX-TEST-0005',
      status: 'posted',
      origin_city: 'Seattle',
      origin_state: 'WA',
      dest_city: 'Salt Lake City',
      dest_state: 'UT',
      equipment: 'reefer',
      commodity: 'Frozen Seafood',
      weight_lbs: 35000,
      rate_usd: 2600,
      rate_per_mile: 3.05,
      total_miles: 840,
      pickup_date: '2026-04-10',
      delivery_date: '2026-04-12',
      hazmat: false,
      temp_controlled: true,
      bid_count: 0,
    },
    // ── Bids received (broker can review & accept)
    {
      load_number: 'FX-TEST-0006',
      status: 'bid_received',
      origin_city: 'Denver',
      origin_state: 'CO',
      dest_city: 'Kansas City',
      dest_state: 'MO',
      equipment: 'van',
      commodity: 'Electronics',
      weight_lbs: 28000,
      rate_usd: 1800,
      rate_per_mile: 2.5,
      total_miles: 599,
      pickup_date: '2026-04-03',
      delivery_date: '2026-04-04',
      hazmat: false,
      temp_controlled: false,
      bid_count: 2,
    },
    {
      load_number: 'FX-TEST-0007',
      status: 'bid_received',
      origin_city: 'Memphis',
      origin_state: 'TN',
      dest_city: 'Charlotte',
      dest_state: 'NC',
      equipment: 'van',
      commodity: 'Clothing & Apparel',
      weight_lbs: 31000,
      rate_usd: 1650,
      rate_per_mile: 2.15,
      total_miles: 530,
      pickup_date: '2026-04-04',
      delivery_date: '2026-04-05',
      hazmat: false,
      temp_controlled: false,
      bid_count: 1,
    },
    // ── Dispatched (awarded, driver assigned)
    {
      load_number: 'FX-TEST-0008',
      status: 'dispatched',
      origin_city: 'Phoenix',
      origin_state: 'AZ',
      dest_city: 'Las Vegas',
      dest_state: 'NV',
      equipment: 'van',
      commodity: 'Consumer Goods',
      weight_lbs: 29000,
      rate_usd: 950,
      rate_per_mile: 2.2,
      total_miles: 297,
      pickup_date: '2026-03-28',
      delivery_date: '2026-03-29',
      hazmat: false,
      temp_controlled: false,
      bid_count: 3,
    },
    // ── In transit (live)
    {
      load_number: 'FX-TEST-0009',
      status: 'in_transit',
      origin_city: 'Detroit',
      origin_state: 'MI',
      dest_city: 'Columbus',
      dest_state: 'OH',
      equipment: 'van',
      commodity: 'Machine Parts',
      weight_lbs: 40000,
      rate_usd: 1100,
      rate_per_mile: 2.0,
      total_miles: 174,
      pickup_date: '2026-03-15',
      delivery_date: '2026-03-16',
      hazmat: false,
      temp_controlled: false,
      bid_count: 2,
    },
    // ── Delivered (closed)
    {
      load_number: 'FX-TEST-0010',
      status: 'delivered',
      origin_city: 'Boston',
      origin_state: 'MA',
      dest_city: 'New York',
      dest_state: 'NY',
      equipment: 'box_truck',
      commodity: 'Office Furniture',
      weight_lbs: 18000,
      rate_usd: 750,
      rate_per_mile: 2.5,
      total_miles: 215,
      pickup_date: '2026-03-10',
      delivery_date: '2026-03-11',
      hazmat: false,
      temp_controlled: false,
      bid_count: 1,
    },
  ];

  const loadIds = {};
  for (const l of loadsData) {
    const { data: existing } = await sb
      .from('loads')
      .select('id')
      .eq('load_number', l.load_number)
      .maybeSingle();
    if (existing) {
      loadIds[l.load_number] = existing.id;
      log(`↩  ${l.load_number} (existing)`);
      continue;
    }
    const { data, error } = await sb
      .from('loads')
      .insert({
        ...l,
        posted_by: ids.broker,
        company_id: companyIds.broker,
        company_name: 'Blue Sky Freight LLC',
      })
      .select('id')
      .single();
    if (error) {
      warn(`${l.load_number}: ${error.message}`);
      continue;
    }
    loadIds[l.load_number] = data.id;
    log(`✅  ${l.load_number}  [${l.status}]`);
  }

  // ── 5. Trucks ──────────────────────────────────────────────────────────────
  header('4/5  Trucks');
  const trucksData = [
    {
      origin_city: 'Dallas',
      origin_state: 'TX',
      dest_city: 'Chicago',
      dest_state: 'IL',
      available_date: '2026-04-01',
      equipment: 'van',
      length_ft: 53,
      weight_capacity_lbs: 45000,
      driver_name: 'Mike Torres',
      driver_phone: '214-555-0101',
      status: 'available',
    },
    {
      origin_city: 'Atlanta',
      origin_state: 'GA',
      dest_city: 'Miami',
      dest_state: 'FL',
      available_date: '2026-04-05',
      equipment: 'reefer',
      length_ft: 53,
      weight_capacity_lbs: 43000,
      driver_name: 'Lisa Chen',
      driver_phone: '404-555-0202',
      status: 'available',
    },
    {
      origin_city: 'Dallas',
      origin_state: 'TX',
      dest_city: 'Nashville',
      dest_state: 'TN',
      available_date: '2026-04-08',
      equipment: 'flatbed',
      length_ft: 48,
      weight_capacity_lbs: 48000,
      driver_name: 'Carlos Vega',
      driver_phone: '972-555-0303',
      status: 'available',
    },
  ];

  for (const t of trucksData) {
    const { error } = await sb.from('trucks').insert({
      ...t,
      posted_by: ids.carrier,
      company_id: companyIds.carrier,
      company_name: 'Rivera Transport Inc',
    });
    if (error) warn(`truck ${t.equipment}: ${error.message}`);
    else log(`✅  ${t.equipment} — ${t.origin_city} → ${t.dest_city}  (${t.driver_name})`);
  }

  // ── 6. Bids ────────────────────────────────────────────────────────────────
  header('5/6  Bids');
  const bidsData = [
    {
      load_number: 'FX-TEST-0006',
      amount_usd: 1700,
      notes: 'Can pick up early if needed. Team driver available.',
      status: 'pending',
    },
    {
      load_number: 'FX-TEST-0006',
      amount_usd: 1750,
      notes: 'Top-rated carrier, 97% on-time. Happy to negotiate.',
      status: 'pending',
    },
    {
      load_number: 'FX-TEST-0007',
      amount_usd: 1600,
      notes: 'Available and ready to roll tomorrow morning.',
      status: 'pending',
    },
    {
      load_number: 'FX-TEST-0008',
      amount_usd: 920,
      notes: 'Quick turnaround guaranteed. Driver is pre-loaded.',
      status: 'accepted',
    },
    {
      load_number: 'FX-TEST-0009',
      amount_usd: 1080,
      notes: 'En route, ETA on time.',
      status: 'accepted',
    },
    {
      load_number: 'FX-TEST-0010',
      amount_usd: 730,
      notes: 'Delivered clean. No exceptions.',
      status: 'accepted',
    },
  ];

  for (const b of bidsData) {
    const loadId = loadIds[b.load_number];
    if (!loadId) {
      warn(`no load id for ${b.load_number}`);
      continue;
    }
    const { error } = await sb.from('bids').insert({
      load_id: loadId,
      carrier_id: ids.carrier,
      company_id: companyIds.carrier,
      company_name: 'Rivera Transport Inc',
      amount_usd: b.amount_usd,
      notes: b.notes,
      status: b.status,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    if (error) warn(`bid on ${b.load_number}: ${error.message}`);
    else log(`✅  $${b.amount_usd} on ${b.load_number}  [${b.status}]`);
  }

  // ── 6. Driver → Company Member + Load Assignment ──────────────────────────
  header('6/6  Driver Setup');

  // Add driver to carrier's company
  if (companyIds.carrier && ids.driver) {
    const { error: memberErr } = await sb.from('company_members').upsert(
      {
        company_id: companyIds.carrier,
        user_id: ids.driver,
        role: 'driver',
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' },
    );
    if (memberErr) warn(`company member: ${memberErr.message}`);
    else log('✅  driver added to carrier company');
  }

  // Assign in-transit load to driver
  if (loadIds['FX-TEST-0009'] && ids.driver) {
    const { error: assignErr } = await sb
      .from('loads')
      .update({ assigned_driver_id: ids.driver })
      .eq('id', loadIds['FX-TEST-0009']);
    if (assignErr) warn(`assign driver: ${assignErr.message}`);
    else log('✅  FX-TEST-0009 assigned to driver');
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  Seed complete!\n');
  console.log('Test credentials (all share the same password):\n');
  console.log(`  Email                       Role      Password`);
  console.log(`  broker@freightx.com         broker    ${PASSWORD}`);
  console.log(`  carrier@freightx.com        carrier   ${PASSWORD}`);
  console.log(`  shipper@freightx.com        shipper   ${PASSWORD}`);
  console.log(`  driver@freightx.com         driver    ${PASSWORD}`);
  console.log('');
  console.log("What's seeded:");
  console.log('  • 10 loads across all statuses (posted → delivered)');
  console.log('  • 3 trucks (van, reefer, flatbed) posted by carrier');
  console.log('  • 6 bids — 3 pending, 3 accepted');
  console.log('  • Companies with ratings, verification, credit scores');
  console.log('  • Driver assigned to carrier company + in-transit load FX-TEST-0009');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
