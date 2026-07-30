import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.error(
    'CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
  );
}

// Fallback to placeholder if missing to prevent initialization crash
const supabaseUrl = url || 'https://placeholder.supabase.co';
const supabaseKey = key || 'placeholder';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
