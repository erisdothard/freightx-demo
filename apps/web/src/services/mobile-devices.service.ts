import { supabase } from '@/lib/supabase';

export interface MobileDevice {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  device_model: string | null;
  push_token: string | null;
  push_enabled: boolean;
  last_active_at: string;
  created_at: string;
}

export async function registerDevice(params: {
  deviceId: string;
  platform: string;
  deviceModel?: string;
  pushToken?: string;
}): Promise<MobileDevice> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('mobile_devices')
    .upsert(
      {
        user_id: user.id,
        device_id: params.deviceId,
        platform: params.platform,
        device_model: params.deviceModel ?? null,
        push_token: params.pushToken ?? null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MobileDevice;
}

export async function deregisterDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.from('mobile_devices').delete().eq('id', deviceId);
  if (error) throw new Error(error.message);
}

export async function getMyDevices(): Promise<MobileDevice[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('mobile_devices')
    .select('*')
    .eq('user_id', user.id)
    .order('last_active_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MobileDevice[];
}
