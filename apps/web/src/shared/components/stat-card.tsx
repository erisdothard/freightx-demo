import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  trendValue,
  icon,
  highlight = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 flex flex-col gap-2 border',
        highlight ? 'bg-fx-orange/10 border-fx-orange/30' : 'bg-fx-surface border-fx-border',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-fx-text-muted uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className={cn('', highlight ? 'text-fx-orange' : 'text-fx-text-dim')}>{icon}</div>
        )}
      </div>

      <p className={cn('text-2xl font-bold', highlight ? 'text-fx-orange' : 'text-fx-text')}>
        {value}
      </p>

      {trend && trendValue && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={12} className="text-green-400" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-400" />}
          {trend === 'flat' && <Minus size={12} className="text-fx-text-muted" />}
          <span
            className={cn(
              'text-xs font-medium',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend === 'flat' && 'text-fx-text-muted',
            )}
          >
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
