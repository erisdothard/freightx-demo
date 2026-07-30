import { TrendingUp, MapPin, DollarSign } from 'lucide-react';
import type { LaneSuggestion } from '@/services/lane-suggestions.service';

interface Props {
  suggestions: LaneSuggestion[];
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  preference: { label: 'Preferred', color: 'text-fx-orange bg-fx-orange/10' },
  history: { label: 'From History', color: 'text-blue-400 bg-blue-400/10' },
  popular: { label: 'Popular', color: 'text-emerald-400 bg-emerald-400/10' },
};

export function LaneSuggestionsFeed({ suggestions }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp size={24} className="mx-auto text-fx-text-dim mb-2" />
        <p className="text-fx-text-muted text-sm">No lane suggestions yet</p>
        <p className="text-fx-text-dim text-xs mt-1">
          Add lane preferences or bid on loads to get personalized suggestions.
        </p>
      </div>
    );
  }

  // Group by source
  const grouped: Record<string, LaneSuggestion[]> = {};
  for (const s of suggestions) {
    const key = s.source;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([source, items]) => {
        const meta = SOURCE_LABELS[source] ?? { label: source, color: 'text-zinc-400 bg-zinc-800' };
        return (
          <div key={source}>
            <span
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${meta.color}`}
            >
              {meta.label}
            </span>
            <div className="mt-2 space-y-2">
              {items.map((s, i) => (
                <div
                  key={`${source}-${i}`}
                  className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
                    <MapPin size={15} className="text-fx-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fx-text">
                      {s.origin_state} → {s.destination_state}
                    </p>
                    <p className="text-xs text-fx-text-muted">
                      {s.equipment_type?.toUpperCase()} · {s.load_count} loads
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-fx-orange flex items-center gap-0.5">
                      <DollarSign size={12} />
                      {s.avg_rate?.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-fx-text-dim">avg rate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
