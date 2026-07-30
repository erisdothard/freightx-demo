import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  MessageSquare,
  User,
  Package,
  FileText,
  DollarSign,
  MapPin,
  PlusCircle,
  Bell,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLoadActionCounts } from '@/features/loads/hooks/use-load-action-counts';
import { useUnreadMessages } from '@/features/messages/hooks/use-unread-messages';

type NavRole = 'carrier' | 'broker' | 'driver' | 'shipper';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const carrierNav: NavItem[] = [
  { label: 'Home', icon: <Home size={22} />, path: '/carrier' },
  { label: 'Load Board', icon: <Search size={22} />, path: '/carrier/loads' },
  { label: 'Alerts', icon: <Bell size={22} />, path: '/carrier/alerts' },
  { label: 'Messages', icon: <MessageSquare size={22} />, path: '/messages' },
  { label: 'Profile', icon: <User size={22} />, path: '/profile' },
];

const brokerNav: NavItem[] = [
  { label: 'Home', icon: <Home size={22} />, path: '/broker' },
  { label: 'My Loads', icon: <Package size={22} />, path: '/broker/loads' },
  { label: 'Post Load', icon: <PlusCircle size={22} />, path: '/broker/loads?post=1' },
  { label: 'Messages', icon: <MessageSquare size={22} />, path: '/messages' },
  { label: 'Profile', icon: <User size={22} />, path: '/profile' },
];

const driverNav: NavItem[] = [
  { label: 'Home', icon: <Home size={22} />, path: '/driver' },
  { label: 'My Loads', icon: <Package size={22} />, path: '/driver/loads' },
  { label: 'HOS', icon: <Clock size={22} />, path: '/driver/hos' },
  { label: 'Expenses', icon: <DollarSign size={22} />, path: '/driver/expenses' },
  { label: 'Profile', icon: <User size={22} />, path: '/profile' },
];

const shipperNav: NavItem[] = [
  { label: 'Home', icon: <Home size={22} />, path: '/shipper' },
  { label: 'Shipments', icon: <Package size={22} />, path: '/shipper/loads' },
  { label: 'Track', icon: <MapPin size={22} />, path: '/track' },
  { label: 'Messages', icon: <MessageSquare size={22} />, path: '/messages' },
  { label: 'Profile', icon: <User size={22} />, path: '/profile' },
];

const navByRole: Record<NavRole, NavItem[]> = {
  carrier: carrierNav,
  broker: brokerNav,
  driver: driverNav,
  shipper: shipperNav,
};

export function BottomNav({ role }: { role: NavRole }) {
  const location = useLocation();
  const items = navByRole[role];
  const actionCount = useLoadActionCounts();
  const unreadMessages = useUnreadMessages();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
      {/* iOS frosted glass bar */}
      <div
        className="absolute inset-0 ios-blur"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      />

      <div className="relative flex items-center justify-around px-1 pb-safe pt-2 h-[68px]">
        {items.map((item) => {
          const basePath = item.path.split('?')[0];
          const isActive =
            basePath === '/carrier' ||
            basePath === '/broker' ||
            basePath === '/driver' ||
            basePath === '/shipper'
              ? location.pathname === basePath
              : item.label === 'Post Load'
                ? false
                : location.pathname.startsWith(basePath);

          // Show action badge on the Loads nav item (not Post Load)
          const isLoadsItem =
            item.label !== 'Post Load' &&
            (basePath === '/carrier/loads' ||
              basePath === '/broker/loads' ||
              basePath === '/driver/loads');
          const showBadge = isLoadsItem && actionCount > 0;

          // Show unread badge on Messages nav item
          const isMessagesItem = item.label === 'Messages';
          const showMessageBadge = isMessagesItem && unreadMessages > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl min-w-[44px] transition-all duration-150"
            >
              <div
                className={cn(
                  'relative transition-colors duration-150',
                  isActive ? 'text-fx-orange' : 'text-fx-text-dim',
                )}
              >
                {item.icon}
                {showBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-fx-orange rounded-full ring-2 ring-fx-bg flex items-center justify-center px-0.5">
                    <span className="text-[8px] font-bold text-white leading-none">
                      {actionCount > 9 ? '9+' : actionCount}
                    </span>
                  </span>
                )}
                {showMessageBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-fx-orange rounded-full ring-2 ring-fx-bg flex items-center justify-center px-0.5">
                    <span className="text-[8px] font-bold text-white leading-none">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold transition-colors duration-150',
                  isActive ? 'text-fx-orange' : 'text-fx-text-dim',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
