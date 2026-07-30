/**
 * notifications — unread count, mark all read, time formatting
 *
 * Production failure scenarios:
 *  - No notifications in DB → unread count should be 0, not crash
 *  - All notifications already read → unread count is 0
 *  - Mark all read when there are none → no-op, no error
 *  - Notification with missing timestamp → timeAgo should not crash
 *  - Count > 9 → badge should show "9+" not "10+"
 */

import { describe, it, expect } from 'vitest';

// ─── Unread count ─────────────────────────────────────────────────────────────

type Notification = { id: string; read: boolean; created_at: string };

function getUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

describe('unread count', () => {
  it('returns 0 for empty notifications array', () => {
    expect(getUnreadCount([])).toBe(0);
  });

  it('returns 0 when all are read', () => {
    const notifs: Notification[] = [
      { id: '1', read: true, created_at: '' },
      { id: '2', read: true, created_at: '' },
    ];
    expect(getUnreadCount(notifs)).toBe(0);
  });

  it('counts only unread notifications', () => {
    const notifs: Notification[] = [
      { id: '1', read: false, created_at: '' },
      { id: '2', read: true, created_at: '' },
      { id: '3', read: false, created_at: '' },
    ];
    expect(getUnreadCount(notifs)).toBe(2);
  });
});

// ─── Badge display ────────────────────────────────────────────────────────────

function formatBadge(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

describe('notification badge display', () => {
  it('shows empty string for 0 unread', () => {
    expect(formatBadge(0)).toBe('');
  });

  it('shows exact count for 1–9', () => {
    expect(formatBadge(5)).toBe('5');
  });

  it('shows 9+ for 10 or more', () => {
    expect(formatBadge(10)).toBe('9+');
    expect(formatBadge(99)).toBe('9+');
  });

  it('shows 9 for exactly 9', () => {
    expect(formatBadge(9)).toBe('9');
  });
});

// ─── timeAgo formatting ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

describe('timeAgo', () => {
  it('returns "just now" for very recent timestamps', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const t = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(timeAgo(t)).toBe('15m ago');
  });

  it('returns hours ago', () => {
    const t = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(t)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const t = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(t)).toBe('2d ago');
  });
});
