import { useEffect } from 'react';
import { Bell, Package, MessageSquare, Zap, CheckCheck, Radio, FileCheck } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import type { AppNotification } from '../hooks/use-notifications';

const TYPE_ICON: Record<string, React.ReactNode> = {
  new_bid: <Zap size={14} className="text-green-400" />,
  bid_accepted: <Zap size={14} className="text-fx-orange" />,
  bid_declined: <Zap size={14} className="text-red-400" />,
  new_message: <MessageSquare size={14} className="text-blue-400" />,
  load_status_change: <Package size={14} className="text-fx-orange" />,
  load_booked: <Package size={14} className="text-green-400" />,
  load_cancelled: <Package size={14} className="text-red-400" />,
  gps_request: <Radio size={14} className="text-green-400" />,
  bol_signed: <FileCheck size={14} className="text-green-400" />,
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationSheetProps {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onNotificationClick?: (notification: AppNotification) => void;
}

export function NotificationSheet({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onNotificationClick,
}: NotificationSheetProps) {
  // Mark all read when sheet opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      onMarkAllRead();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet open={open} onClose={onClose} title="Notifications">
      {/* Mark all read button */}
      {unreadCount > 0 && (
        <button
          onClick={onMarkAllRead}
          className="flex items-center gap-1.5 text-xs font-semibold text-fx-orange mb-4"
        >
          <CheckCheck size={13} />
          Mark all as read
        </button>
      )}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell size={36} className="text-fx-text-dim mb-4" />
          <p className="font-bold text-fx-text">No notifications yet</p>
          <p className="text-sm text-fx-text-muted mt-1">
            You'll be notified about bids, messages, and load updates
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNotificationClick?.(n)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${
                !n.read
                  ? 'bg-fx-orange/5 border border-fx-orange/15'
                  : 'bg-fx-surface border border-fx-border'
              } ${n.load_id && onNotificationClick ? 'cursor-pointer hover:bg-fx-surface-2' : ''}`}
            >
              <div className="w-8 h-8 rounded-xl bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0 mt-0.5">
                {TYPE_ICON[n.type] ?? <Bell size={14} className="text-fx-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-semibold leading-snug ${!n.read ? 'text-fx-text' : 'text-fx-text-muted'}`}
                  >
                    {n.title}
                  </p>
                  <span className="text-[10px] text-fx-text-dim shrink-0">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.body && <p className="text-xs text-fx-text-dim mt-0.5 leading-snug">{n.body}</p>}
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-fx-orange shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
