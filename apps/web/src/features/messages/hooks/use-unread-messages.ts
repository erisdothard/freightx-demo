import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the total number of conversations with unread messages for the current user.
 * Uses polling (30s) with realtime INSERT listener for instant updates.
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetch = useCallback(() => {
    if (!user) return;
    supabase
      .from('conversations')
      .select('id, unread_count', { count: 'exact' })
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .gt('unread_count', 0)
      .then(({ count: total }) => {
        setCount(total ?? 0);
      });
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime — new messages trigger re-check
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetch]);

  // Polling fallback
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [user, fetch]);

  return count;
}
