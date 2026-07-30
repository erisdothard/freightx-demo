import { supabase } from '@/lib/supabase';
import type { ConversationRow, MessageRow } from '@/lib/database.types';
import { notifyNewMessage } from './email-notifications.service';

const PAGE_SIZE = 30;

export async function getConversations(
  userId: string,
  page = 0,
): Promise<{ data: ConversationRow[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  const rows = data ?? [];
  return { data: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

/**
 * Fetch messages with cursor-based pagination.
 * Returns newest messages first (for infinite scroll "load older").
 * Pass `before` as the created_at of the oldest message you have.
 */
export async function getMessages(
  conversationId: string,
  options?: { before?: string; limit?: number },
): Promise<{ data: MessageRow[]; hasMore: boolean }> {
  const limit = options?.limit ?? PAGE_SIZE;
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (options?.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  // Return in chronological order (oldest first) for display
  return { data: rows.slice(0, limit).reverse(), hasMore };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text, from_me: true })
    .select()
    .single();
  if (error) throw error;

  // Update last_message on conversation
  await supabase
    .from('conversations')
    .update({ last_message: text, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Notify the recipient — in-app + email (non-blocking)
  const { data: convo } = await supabase
    .from('conversations')
    .select('participant_a, participant_b')
    .eq('id', conversationId)
    .single();

  if (convo) {
    const recipientId =
      convo.participant_a === senderId ? convo.participant_b : convo.participant_a;

    if (recipientId) {
      // In-app notification
      const { data: sender } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .single();

      const senderName = sender?.full_name || 'Someone';

      supabase
        .rpc('send_notification', {
          p_user_id: recipientId,
          p_type: 'new_message',
          p_title: `Message from ${senderName}`,
          p_body: text.length > 120 ? text.slice(0, 120) + '...' : text,
        })
        .then(
          () => undefined,
          () => undefined,
        );

      // Email notification
      const { data: recipient } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', recipientId)
        .single();

      if (recipient?.email) {
        notifyNewMessage({
          recipientEmail: recipient.email as string,
          senderName,
          preview: text,
        }).then(
          () => undefined,
          () => undefined,
        );
      }
    }
  }

  return data;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (error) throw error;
}

/**
 * Find an existing conversation between two users (optionally scoped to a load),
 * or create one if none exists.
 */
export async function getOrCreateConversation(
  myId: string,
  otherId: string,
  otherName: string,
  otherRole: string,
  loadNumber?: string,
): Promise<ConversationRow> {
  // Check for existing conversation between these two participants
  let query = supabase
    .from('conversations')
    .select('*')
    .or(
      `and(participant_a.eq.${myId},participant_b.eq.${otherId}),and(participant_a.eq.${otherId},participant_b.eq.${myId})`,
    );

  if (loadNumber) {
    query = query.eq('load_number', loadNumber);
  } else {
    query = query.is('load_number', null);
  }

  const { data: existing } = await query.limit(1).single();
  if (existing) return existing;

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_a: myId,
      participant_b: otherId,
      other_party: otherName,
      other_party_role: otherRole,
      load_number: loadNumber ?? null,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Search profiles by name or email for the user search in messaging.
 */
export async function searchUsers(
  query: string,
  excludeId: string,
): Promise<Array<{ id: string; full_name: string | null; email: string; role: string }>> {
  const s = `%${query}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .neq('id', excludeId)
    .or(`full_name.ilike.${s},email.ilike.${s}`)
    .limit(15);
  if (error) throw error;
  return data ?? [];
}
