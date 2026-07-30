import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('Testing listUsers...');
  const { data, error } = await sb.auth.admin.listUsers();
  console.log('Data:', data ? data.users.length : null);
  console.log('Error:', error);
}

run();
