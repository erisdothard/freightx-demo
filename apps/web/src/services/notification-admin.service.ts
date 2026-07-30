import { supabase } from '@/lib/supabase';

export interface NotificationQueueStats {
  sentToday: number;
  failedToday: number;
  deadLetterCount: number;
  avgRetryCount: number;
}

export interface FailedNotification {
  id: string;
  type: string;
  recipient: string;
  error_message: string | null;
  attempts: number;
  status: string;
  created_at: string;
  next_retry_at: string;
}

export async function getNotificationQueueStats(): Promise<NotificationQueueStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const [sentRes, failedRes, deadRes, retryRes] = await Promise.all([
    supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', todayStr),
    supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', todayStr),
    supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'dead'),
    supabase.from('notification_queue').select('attempts').neq('status', 'pending'),
  ]);

  const avgRetry =
    retryRes.data && retryRes.data.length > 0
      ? retryRes.data.reduce((sum, r) => sum + (r.attempts ?? 0), 0) / retryRes.data.length
      : 0;

  return {
    sentToday: sentRes.count ?? 0,
    failedToday: failedRes.count ?? 0,
    deadLetterCount: deadRes.count ?? 0,
    avgRetryCount: +avgRetry.toFixed(1),
  };
}

export async function getFailedNotifications(limit = 50): Promise<FailedNotification[]> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('id, type, recipient, error_message, attempts, status, created_at, next_retry_at')
    .in('status', ['failed', 'dead'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FailedNotification[];
}

export async function retryAllFailed(): Promise<number> {
  const { data, error } = await supabase
    .from('notification_queue')
    .update({ status: 'pending', next_retry_at: new Date().toISOString() })
    .eq('status', 'failed')
    .select('id');

  if (error) throw error;
  return (data ?? []).length;
}
