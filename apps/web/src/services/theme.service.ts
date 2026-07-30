import { supabase } from '@/lib/supabase';

export type ThemePreference = 'light' | 'dark' | 'system';

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  const { error } = await supabase.rpc('set_theme_preference', {
    p_theme: preference,
  });
  if (error) throw new Error(error.message);
}
