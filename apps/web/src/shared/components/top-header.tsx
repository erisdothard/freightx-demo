import { Bell, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { SyncIndicator } from '@/features/loads/components/sync-indicator';

interface TopHeaderProps {
  greeting?: boolean;
  name?: string;
  title?: string;
  showBack?: boolean;
  backAction?: () => void;
  showNotification?: boolean;
  notificationCount?: number;
  className?: string;
  onNotificationClick?: () => void;
  right?: React.ReactNode;
}

export function TopHeader({
  greeting = false,
  name,
  title,
  showBack = false,
  backAction,
  showNotification = true,
  notificationCount = 0,
  className,
  onNotificationClick,
  right,
}: TopHeaderProps) {
  const navigate = useNavigate();

  const handleBack = backAction || (() => navigate(-1));

  return (
    <header
      className={cn(
        'flex items-center justify-between px-5 pt-safe pb-2',
        'sticky top-0 z-40 bg-fx-bg/90 backdrop-blur-md',
        className,
      )}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
    >
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl bg-fx-surface flex items-center justify-center text-fx-text-muted hover:text-fx-text hover:bg-fx-surface-2 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div>
          {greeting && (
            <p className="text-xs text-fx-text-muted font-medium tracking-wide uppercase">Hello,</p>
          )}
          <h1
            className={cn('font-bold text-fx-text leading-tight', greeting ? 'text-xl' : 'text-lg')}
          >
            {title || name || 'FreightX'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SyncIndicator />
        {right ??
          (showNotification && (
            <button
              onClick={onNotificationClick}
              className="relative w-10 h-10 rounded-xl bg-fx-surface border border-fx-border flex items-center justify-center text-fx-text-muted hover:text-fx-orange hover:border-fx-orange/40 transition-all duration-200"
            >
              <Bell size={18} />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-fx-orange rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          ))}
      </div>
    </header>
  );
}
