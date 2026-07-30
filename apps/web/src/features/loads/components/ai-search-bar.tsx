import { useState, useRef } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/shared/lib/utils';
import type { LoadFilters } from '@/services/loads.service';

interface AiSearchBarProps {
  onFilters: (filters: LoadFilters) => void;
  onClear: () => void;
  className?: string;
}

const EXAMPLES = [
  'Flatbed from Texas to Illinois this week',
  'Reefer out of California, over $2.50/mi',
  'Dry van loads picking up tomorrow in Tennessee',
];

const STATE_MAP: Record<string, string> = {
  alabama: 'AL',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  florida: 'FL',
  georgia: 'GA',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  nebraska: 'NE',
  nevada: 'NV',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  virginia: 'VA',
  washington: 'WA',
  wisconsin: 'WI',
  // abbreviations
  al: 'AL',
  az: 'AZ',
  ca: 'CA',
  co: 'CO',
  fl: 'FL',
  ga: 'GA',
  il: 'IL',
  in: 'IN',
  ky: 'KY',
  la: 'LA',
  mi: 'MI',
  mn: 'MN',
  mo: 'MO',
  ms: 'MS',
  nc: 'NC',
  ne: 'NE',
  nv: 'NV',
  ny: 'NY',
  oh: 'OH',
  ok: 'OK',
  or: 'OR',
  pa: 'PA',
  tn: 'TN',
  tx: 'TX',
  ut: 'UT',
  va: 'VA',
  wa: 'WA',
  wi: 'WI',
};

function localParse(query: string): LoadFilters {
  const q = query.toLowerCase();
  const filters: LoadFilters = {};

  // Equipment — includes trucker shorthand ("dry" = dry van, "flat" = flatbed)
  if (q.includes('flatbed') || /\bflat\b/.test(q)) filters.equipment = 'flatbed';
  else if (q.includes('reefer') || q.includes('refrigerated')) filters.equipment = 'reefer';
  else if (q.includes('step deck') || q.includes('stepdeck')) filters.equipment = 'step_deck';
  else if (q.includes('lowboy')) filters.equipment = 'lowboy';
  else if (q.includes('tanker')) filters.equipment = 'tanker';
  else if (q.includes('box truck') || q.includes('box van')) filters.equipment = 'box_truck';
  else if (q.includes('sprinter')) filters.equipment = 'sprinter';
  else if (
    q.includes('dry van') ||
    q.includes('dry freight') ||
    /\bdry\b/.test(q) ||
    q.includes('van')
  )
    filters.equipment = 'van';

  // Rate per mile — match "$2.50/mi", "$3 a mile", "over $2/mi"
  const rateMatch = q.match(/\$(\d+(?:\.\d+)?)\s*(?:\/mi|per mile|a mile)/);
  if (rateMatch) filters.minRatePerMile = parseFloat(rateMatch[1]);

  // States — detect origin vs dest context
  for (const [name, code] of Object.entries(STATE_MAP)) {
    if (!q.includes(name)) continue;
    const beforeState = q.slice(0, q.indexOf(name));
    const isOrigin = /\b(from|out of|leaving|departing|pickup in|picks? up in|based in)\s*$/.test(
      beforeState,
    );
    const isDest = /\b(to|going to|heading to|delivering to|towards?)\s*$/.test(beforeState);

    if (isOrigin && !filters.originState) filters.originState = code;
    else if (isDest && !filters.destState) filters.destState = code;
    else if (!filters.originState && !filters.destState) filters.originState = code;
  }

  return filters;
}

export function AiSearchBar({ onFilters, onClear, className }: AiSearchBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);

    let filters: LoadFilters = {};

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-load-search', {
        body: { query: q },
      });

      if (fnError) throw fnError;

      // Map structured fields only — skip 'search' (causes false-negative text matches)
      if (data?.equipment) filters.equipment = data.equipment;
      if (data?.origin_state) filters.originState = data.origin_state;
      if (data?.dest_states?.length) filters.destState = data.dest_states[0];
      if (data?.min_rate_per_mile) filters.minRatePerMile = data.min_rate_per_mile;
    } catch {
      // Edge function unavailable — fall back to local keyword parser silently
      filters = localParse(q);
    }

    onFilters(filters);
    setActive(true);
    setLoading(false);
  }

  function handleClear() {
    setQuery('');
    setActive(false);
    onClear();
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') handleClear();
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Sparkles
          size={15}
          className={cn(
            'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors',
            loading
              ? 'text-fx-orange animate-pulse'
              : active
                ? 'text-fx-orange'
                : 'text-fx-text-dim',
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the load you're looking for…"
          className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-2xl pl-10 pr-20 text-sm text-white placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all"
          style={
            active ? { borderColor: '#E86030', boxShadow: '0 0 0 1px rgba(232,96,48,0.3)' } : {}
          }
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(query || active) && (
            <button
              onClick={handleClear}
              className="w-6 h-6 rounded-full flex items-center justify-center text-fx-text-dim hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="h-8 w-8 rounded-xl bg-fx-orange flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
          >
            <ArrowRight size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Example prompts */}
      {!query && !active && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="shrink-0 text-[11px] text-fx-text-dim bg-fx-surface border border-fx-border px-3 py-1.5 rounded-full hover:border-fx-orange/40 hover:text-fx-text transition-all"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
