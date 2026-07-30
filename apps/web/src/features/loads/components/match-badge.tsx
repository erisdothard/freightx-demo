import { cn } from '@/shared/lib/utils';

interface MatchBadgeProps {
  score: number; // 0–100
  className?: string;
}

export function MatchBadge({ score, className }: MatchBadgeProps) {
  const color =
    score >= 80
      ? '#34D399' // green
      : score >= 60
        ? '#E86030' // fx-orange
        : '#6B7280'; // gray

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
        className,
      )}
      style={{
        background: `${color}1A`,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {score}% match
    </div>
  );
}
