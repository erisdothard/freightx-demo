import { cn } from '@/shared/lib/utils';

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function InfoRow({ label, value, icon, className }: InfoRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 border-b border-fx-border last:border-b-0',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-fx-text-muted">
        {icon && <span className="text-fx-text-dim shrink-0">{icon}</span>}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold text-fx-text text-right">{value}</span>
    </div>
  );
}

export default InfoRow;
