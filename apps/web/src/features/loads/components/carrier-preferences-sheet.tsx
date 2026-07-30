import { useState, useEffect } from 'react';
import { Check, MapPin, DollarSign } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { saveCarrierPreferences } from '../lib/preferences';
import { cn } from '@/shared/lib/utils';
import { EQUIPMENT_LABELS, US_STATES } from '@freightx/shared';
import type { CarrierPreferences } from '../lib/match-score';
import type { EquipmentType } from '@freightx/shared';

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as EquipmentType[];

interface CarrierPreferencesSheetProps {
  open: boolean;
  onClose: () => void;
  initial: CarrierPreferences;
  onSaved: (prefs: CarrierPreferences) => void;
}

export function CarrierPreferencesSheet({
  open,
  onClose,
  initial,
  onSaved,
}: CarrierPreferencesSheetProps) {
  const [prefs, setPrefs] = useState<CarrierPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if parent changes initial (e.g. after fetch)
  useEffect(() => {
    setPrefs(initial);
  }, [initial]);

  function toggleEquipment(eq: EquipmentType) {
    setPrefs((p) => ({
      ...p,
      preferredEquipment: p.preferredEquipment.includes(eq)
        ? p.preferredEquipment.filter((e) => e !== eq)
        : [...p.preferredEquipment, eq],
    }));
  }

  function toggleState(field: 'preferredOriginStates' | 'preferredDestStates', st: string) {
    setPrefs((p) => ({
      ...p,
      [field]: p[field].includes(st) ? p[field].filter((s) => s !== st) : [...p[field], st],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveCarrierPreferences(prefs);
      onSaved(prefs);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Load Preferences">
      <div className="space-y-6 pb-4">
        {/* Home base */}
        <section>
          <label className="text-[11px] font-bold text-fx-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin size={11} />
            Home Base
          </label>
          <div className="flex gap-2">
            <input
              value={prefs.homeCity}
              onChange={(e) => setPrefs((p) => ({ ...p, homeCity: e.target.value }))}
              placeholder="City"
              className="flex-1 h-11 bg-fx-surface border border-fx-border rounded-ios-xs px-3 text-sm text-white placeholder:text-fx-text-dim focus:border-fx-orange outline-none"
            />
            <select
              value={prefs.homeState}
              onChange={(e) => setPrefs((p) => ({ ...p, homeState: e.target.value }))}
              className="w-20 h-11 bg-fx-surface border border-fx-border rounded-ios-xs px-2 text-sm text-white focus:border-fx-orange outline-none"
            >
              <option value="">ST</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Equipment */}
        <section>
          <label className="text-[11px] font-bold text-fx-text-muted uppercase tracking-wider mb-3 block">
            Equipment Types
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_EQUIPMENT.map((eq) => {
              const selected = prefs.preferredEquipment.includes(eq);
              return (
                <button
                  key={eq}
                  onClick={() => toggleEquipment(eq)}
                  className={cn(
                    'h-8 px-3 rounded-full text-xs font-semibold border transition-all duration-150 flex items-center gap-1',
                    selected
                      ? 'bg-fx-orange text-white border-fx-orange'
                      : 'bg-fx-surface border-fx-border text-fx-text-muted',
                  )}
                >
                  {selected && <Check size={10} strokeWidth={3} />}
                  {EQUIPMENT_LABELS[eq]}
                </button>
              );
            })}
          </div>
          {prefs.preferredEquipment.length === 0 && (
            <p className="text-[11px] text-fx-text-dim mt-2">None selected = show all equipment</p>
          )}
        </section>

        {/* Origin states */}
        <section>
          <label className="text-[11px] font-bold text-fx-text-muted uppercase tracking-wider mb-3 block">
            Preferred Pickup States
          </label>
          <div className="flex flex-wrap gap-1.5">
            {US_STATES.map((st) => {
              const selected = prefs.preferredOriginStates.includes(st);
              return (
                <button
                  key={st}
                  onClick={() => toggleState('preferredOriginStates', st)}
                  className={cn(
                    'w-10 h-8 rounded-lg text-[11px] font-bold border transition-all duration-150',
                    selected
                      ? 'bg-fx-orange text-white border-fx-orange'
                      : 'bg-fx-surface border-fx-border text-fx-text-muted',
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </section>

        {/* Dest states */}
        <section>
          <label className="text-[11px] font-bold text-fx-text-muted uppercase tracking-wider mb-3 block">
            Preferred Delivery States
          </label>
          <div className="flex flex-wrap gap-1.5">
            {US_STATES.map((st) => {
              const selected = prefs.preferredDestStates.includes(st);
              return (
                <button
                  key={st}
                  onClick={() => toggleState('preferredDestStates', st)}
                  className={cn(
                    'w-10 h-8 rounded-lg text-[11px] font-bold border transition-all duration-150',
                    selected
                      ? 'bg-fx-orange text-white border-fx-orange'
                      : 'bg-fx-surface border-fx-border text-fx-text-muted',
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </section>

        {/* Min rate */}
        <section>
          <label className="text-[11px] font-bold text-fx-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign size={11} />
            Minimum Rate per Mile
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim text-sm">
              $
            </span>
            <input
              type="number"
              min={0}
              step={0.05}
              value={prefs.minRatePerMile || ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, minRatePerMile: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0.00"
              className="w-full h-11 bg-fx-surface border border-fx-border rounded-ios-xs pl-7 pr-12 text-sm text-white placeholder:text-fx-text-dim focus:border-fx-orange outline-none"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim text-xs">
              /mi
            </span>
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-ios-xs text-[15px] font-bold text-white bg-orange-gradient disabled:opacity-50 transition-opacity"
          style={{ boxShadow: '0 2px 16px rgba(232,96,48,0.35)' }}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </BottomSheet>
  );
}
