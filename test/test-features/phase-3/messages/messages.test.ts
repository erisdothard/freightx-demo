import { describe, it, expect } from 'vitest';

// ─── Message validation ───────────────────────────────────────────────────────

function validateMessage(text: string): string | null {
  if (!text.trim()) return 'Message cannot be empty';
  if (text.length > 2000) return 'Message exceeds 2000 characters';
  return null;
}

describe('Message validation', () => {
  it('accepts a normal message', () => expect(validateMessage('Hello!')).toBeNull());
  it('rejects empty string', () => expect(validateMessage('')).not.toBeNull());
  it('rejects whitespace only', () => expect(validateMessage('   ')).not.toBeNull());
  it('rejects message over 2000 chars', () =>
    expect(validateMessage('a'.repeat(2001))).not.toBeNull());
  it('accepts message of exactly 2000 chars', () =>
    expect(validateMessage('a'.repeat(2000))).toBeNull());
});

// ─── Unread count logic ───────────────────────────────────────────────────────

interface Message {
  id: string;
  conversation_id: string;
  from_me: boolean;
  read: boolean;
}

function unreadCount(messages: Message[], conversationId: string): number {
  return messages.filter((m) => m.conversation_id === conversationId && !m.from_me && !m.read)
    .length;
}

describe('Unread message count', () => {
  const msgs: Message[] = [
    { id: '1', conversation_id: 'conv-A', from_me: false, read: false },
    { id: '2', conversation_id: 'conv-A', from_me: false, read: true },
    { id: '3', conversation_id: 'conv-A', from_me: true, read: false },
    { id: '4', conversation_id: 'conv-B', from_me: false, read: false },
  ];

  it('counts unread incoming messages', () => expect(unreadCount(msgs, 'conv-A')).toBe(1));
  it('excludes sent messages from unread count', () => {
    const sent = msgs.filter((m) => m.from_me);
    expect(sent.every((m) => !m.read)).toBe(true); // sent but not counted
    expect(unreadCount(msgs, 'conv-A')).toBe(1); // still 1, not 2
  });
  it('excludes read messages', () => {
    const allRead = msgs.map((m) => ({ ...m, read: true }));
    expect(unreadCount(allRead, 'conv-A')).toBe(0);
  });
  it('only counts for specified conversation', () => {
    expect(unreadCount(msgs, 'conv-B')).toBe(1);
  });
  it('returns 0 for unknown conversation', () => {
    expect(unreadCount(msgs, 'conv-Z')).toBe(0);
  });
});

// ─── Conversation sort (most recent first) ────────────────────────────────────

interface Conversation {
  id: string;
  last_message_at: string;
}

function sortConversations(convs: Conversation[]): Conversation[] {
  return [...convs].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );
}

describe('Conversation sort', () => {
  const convs: Conversation[] = [
    { id: 'old', last_message_at: '2026-01-01T10:00:00Z' },
    { id: 'new', last_message_at: '2026-02-15T10:00:00Z' },
    { id: 'mid', last_message_at: '2026-01-20T10:00:00Z' },
  ];

  it('places most recent first', () => {
    expect(sortConversations(convs)[0].id).toBe('new');
  });

  it('places oldest last', () => {
    const sorted = sortConversations(convs);
    expect(sorted[sorted.length - 1].id).toBe('old');
  });

  it('does not mutate original array', () => {
    sortConversations(convs);
    expect(convs[0].id).toBe('old');
  });
});
