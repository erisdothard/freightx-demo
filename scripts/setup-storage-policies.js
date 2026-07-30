#!/usr/bin/env node

// Setup storage policies using Supabase service role
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-storage-policies.js',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sql = readFileSync(
  join(__dirname, '../database/migrations/20260412_storage_policies.sql'),
  'utf-8',
);

// Split by policy and execute each one
const policies = sql
  .split('CREATE POLICY')
  .filter((p) => p.trim())
  .map((p) => 'CREATE POLICY' + p);

async function setupPolicies() {
  console.log('Setting up storage policies...\n');

  for (const policy of policies) {
    const policyName = policy.match(/"([^"]+)"/)?.[1] || 'unknown';
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`✓ Policy "${policyName}" already exists`);
        } else {
          console.error(`✗ Error creating policy "${policyName}":`, error.message);
        }
      } else {
        console.log(`✓ Created policy "${policyName}"`);
      }
    } catch (err) {
      console.error(`✗ Failed to create policy "${policyName}":`, err.message);
    }
  }

  console.log('\nDone!');
}

setupPolicies();
