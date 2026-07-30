#!/usr/bin/env node
/**
 * Create 3 Aces Trucking Inc accounts
 *
 * Creates the company record plus its four starting accounts:
 * - Owner (also drives)
 * - Dispatcher
 * - Two drivers
 *
 * Staff emails and the shared onboarding password come from env vars:
 *   ONBOARDING_PASSWORD, OWNER_EMAIL, DISPATCHER_EMAIL,
 *   DRIVER_1_EMAIL, DRIVER_2_EMAIL
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load env ──────────────────────────────────────────────────────────────────
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

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Config ────────────────────────────────────────────────────────────────────
// Real staff emails and the onboarding password are supplied via env vars so no
// customer PII or credentials live in the repo. See README → Client Onboarding.
const PASSWORD = process.env.ONBOARDING_PASSWORD;

if (!PASSWORD) {
  console.error('Missing ONBOARDING_PASSWORD. Set it before running this script.');
  process.exit(1);
}

const USERS = [
  {
    email: process.env.OWNER_EMAIL ?? 'owner@example-carrier.com',
    full_name: 'Owner',
    role: 'carrier', // Owner role
    phone: '615-555-0001',
  },
  {
    email: process.env.DISPATCHER_EMAIL ?? 'dispatcher@example-carrier.com',
    full_name: 'Dispatcher',
    role: 'carrier', // Dispatcher
    phone: '615-555-0002',
  },
  {
    email: process.env.DRIVER_1_EMAIL ?? 'driver1@example-carrier.com',
    full_name: 'Driver One',
    role: 'driver',
    phone: '615-555-0003',
  },
  {
    email: process.env.DRIVER_2_EMAIL ?? 'driver2@example-carrier.com',
    full_name: 'Driver Two',
    role: 'driver',
    phone: '615-555-0004',
  },
];

const [OWNER, DISPATCHER, DRIVER_1, DRIVER_2] = USERS;

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  console.log('  ' + msg);
}
function warn(msg) {
  console.warn('  ⚠  ' + msg);
}

async function createUser({ email, full_name, role, phone }) {
  // Create auth user
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error) {
    if (error.message.includes('already') || error.message.includes('exists')) {
      warn(`${email} already exists`);
      // Look up existing user
      const { data: profile } = await sb
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (profile) return profile.id;
    }
    throw new Error(`createUser ${email}: ${error.message}`);
  }

  log(`✅  ${email} created`);
  const userId = data.user.id;

  // Create profile
  const { error: profileError } = await sb.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name,
      role,
      phone,
      onboarding_complete: true,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    warn(`profile ${email}: ${profileError.message}`);
  }

  return userId;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n3 Aces Trucking Inc — Account Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create users
  console.log('1/3  Creating users...');
  const userIds = {};
  for (const u of USERS) {
    userIds[u.email] = await createUser(u);
  }

  // 2. Create company
  console.log('\n2/3  Creating company...');
  const ownerId = userIds[OWNER.email];

  const { data: existingCompany } = await sb
    .from('companies')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let companyId;
  if (existingCompany) {
    companyId = existingCompany.id;
    log('↩  3 Aces Trucking Inc (existing)');
  } else {
    const { data: newCompany, error: companyError } = await sb
      .from('companies')
      .insert({
        owner_id: ownerId,
        type: 'carrier',
        name: '3 Aces Trucking Inc',
        address: '',
        city: 'Nashville',
        state: 'TN',
        zip: '',
        phone: '615-555-0001',
        email: OWNER.email,
        verified: false,
        rating: 0,
        total_loads: 0,
        on_time_percent: 0,
      })
      .select('id')
      .single();

    if (companyError) {
      console.error('❌  Failed to create company:', companyError.message);
      process.exit(1);
    }

    companyId = newCompany.id;
    log('✅  3 Aces Trucking Inc created');
  }

  // 3. Add team members
  console.log('\n3/3  Adding team members...');

  const members = [
    {
      user_id: userIds[DISPATCHER.email],
      role: 'dispatcher',
      name: DISPATCHER.full_name,
    },
    {
      user_id: userIds[OWNER.email],
      role: 'viewer', // Owner also drives — viewer role on the company record
      name: OWNER.full_name,
    },
    {
      user_id: userIds[DRIVER_1.email],
      role: 'viewer', // Driver role = viewer in company_members
      name: DRIVER_1.full_name,
    },
    {
      user_id: userIds[DRIVER_2.email],
      role: 'viewer', // Driver role = viewer in company_members
      name: DRIVER_2.full_name,
    },
  ];

  for (const member of members) {
    const { error } = await sb.from('company_members').upsert(
      {
        company_id: companyId,
        user_id: member.user_id,
        role: member.role,
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' },
    );

    if (error) {
      warn(`${member.name}: ${error.message}`);
    } else {
      log(`✅  ${member.name} added as ${member.role}`);
    }
  }

  // Done
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  3 Aces Trucking Inc setup complete!\n');
  console.log('Accounts created (password = $ONBOARDING_PASSWORD):\n');
  for (const u of USERS) {
    console.log(`  ${u.email.padEnd(38)} ${u.role}`);
  }
  console.log('\nNote: MC# and DOT# can be added via the company settings in the app.\n');
}

main().catch((err) => {
  console.error('\n❌  Setup failed:', err.message);
  process.exit(1);
});
