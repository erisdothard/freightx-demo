#!/usr/bin/env node
/**
 * Database Maintenance — Phase 7
 * Runs periodic cleanup tasks on the FreightX Supabase database.
 * Usage: node scripts/db-maintenance.js
 *
 * Tasks:
 *   - Expire loads older than 30 days with status 'posted'
 *   - Prune location_pings older than 7 days
 *   - Report table row counts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function expireOldLoads() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('loads')
    .update({ status: 'expired' })
    .eq('status', 'posted')
    .lt('posted_at', cutoff)
    .select('id', { count: 'exact', head: true });
  if (error) {
    console.error('expire loads:', error.message);
    return;
  }
  console.log(`✅  Expired ${count ?? 0} old loads`);
}

async function pruneLocationPings() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('location_pings')
    .delete()
    .lt('created_at', cutoff)
    .select('id', { count: 'exact', head: true });
  if (error) {
    console.error('prune pings:', error.message);
    return;
  }
  console.log(`✅  Pruned ${count ?? 0} stale location pings`);
}

async function main() {
  console.log(`DB Maintenance — ${new Date().toISOString()}\n`);
  await expireOldLoads();
  await pruneLocationPings();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('DB maintenance error:', err.message);
  process.exit(1);
});
