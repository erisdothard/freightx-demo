import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DEMO_NOTIFICATIONS } from '@/lib/demo-data';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  load_id: string | null;
  read: boolean;
  created_at: string;
}

interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    if (!user) return;
    if (user.id.startsWith('demo-')) {
      setNotifications(
        DEMO_NOTIFICATIONS.map((n) => ({
          ...n,
          user_id: user.id,
          load_id: null,
          body: n.body,
        })),
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(
        ({ data }) => {
          setNotifications((data as AppNotification[]) ?? []);
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime — new notifications appear instantly in the bell
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        fetch,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetch]);

  // Polling fallback — in case Realtime isn't enabled for the table yet
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetch, 15_000);
    return () => clearInterval(interval);
  }, [user, fetch]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))));
  }

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    markAllRead,
    refresh: fetch,
  };
}
