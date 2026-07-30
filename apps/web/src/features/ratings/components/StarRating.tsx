import { Star } from 'lucide-react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  max?: number;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, max = 5, size = 20, readOnly = false }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`transition-transform ${readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'}`}
        >
          <Star
            size={size}
            className={star <= value ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}
          />
        </button>
      ))}
    </div>
  );
}

export function RatingDisplay({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-xs text-fx-text-dim">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={Math.round(value)} readOnly size={13} />
      <span className="text-xs font-semibold text-fx-text-main">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-fx-text-dim">({count})</span>}
    </div>
  );
}
