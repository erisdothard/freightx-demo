import { useState, useEffect } from 'react';
import { Bookmark, Plus, Bell, BellOff, Trash2, Loader2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import {
  getSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  type SavedSearch,
} from '@/services/saved-searches.service';
import type { LoadFilters } from '@/services/loads.service';

interface SavedSearchesSheetProps {
  open: boolean;
  onClose: () => void;
  currentFilters: LoadFilters;
  onApply: (filters: LoadFilters) => void;
}

export function SavedSearchesSheet({
  open,
  onClose,
  currentFilters,
  onApply,
}: SavedSearchesSheetProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (!open) return;
    getSavedSearches().then((data) => {
      setSearches(data);
      setLoading(false);
    });
  }, [open]);

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const search = await createSavedSearch({ name: saveName.trim(), filters: currentFilters });
      setSearches((prev) => [search, ...prev]);
      setSaveName('');
      setShowSave(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAlert(search: SavedSearch) {
    await updateSavedSearch(search.id, { alert_enabled: !search.alert_enabled });
    setSearches((prev) =>
      prev.map((s) => (s.id === search.id ? { ...s, alert_enabled: !s.alert_enabled } : s)),
    );
  }

  async function handleDelete(id: string) {
    await deleteSavedSearch(id);
    setSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function describeFilters(filters: LoadFilters): string {
    const parts: string[] = [];
    if (filters.equipment && filters.equipment !== 'all')
      parts.push(filters.equipment.replace(/_/g, ' '));
    if (filters.originState) parts.push(`from ${filters.originState}`);
    if (filters.destState) parts.push(`to ${filters.destState}`);
    if (filters.minRatePerMile) parts.push(`$${filters.minRatePerMile}+/mi`);
    if (filters.search) parts.push(`"${filters.search}"`);
    return parts.join(' · ') || 'All loads';
  }

  const hasActiveFilters = Object.values(currentFilters).some(
    (v) => v !== undefined && v !== 'all' && v !== '' && v !== 0,
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Saved Searches">
      <div className="space-y-4">
        {/* Save current search */}
        {hasActiveFilters && (
          <div>
            {!showSave ? (
              <button
                onClick={() => setShowSave(true)}
                className="flex items-center gap-2 text-xs font-bold text-fx-orange"
              >
                <Plus size={14} />
                Save Current Search
              </button>
            ) : (
              <div className="bg-fx-surface border border-fx-border rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest">
                  {describeFilters(currentFilters)}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name this search…"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="flex-1 h-9 bg-fx-surface-2 border border-fx-border rounded-lg text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !saveName.trim()}
                    className="px-3 h-9 rounded-lg bg-fx-orange text-white text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Searches list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-fx-orange animate-spin" />
          </div>
        ) : searches.length === 0 ? (
          <div className="text-center py-8">
            <Bookmark size={28} className="text-fx-text-dim mx-auto mb-2" />
            <p className="text-sm text-fx-text-dim">No saved searches yet</p>
            <p className="text-xs text-fx-text-dim mt-1">
              Filter loads then save your search for instant recall
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {searches.map((search) => (
              <div
                key={search.id}
                className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      onApply(search.filters);
                      onClose();
                    }}
                    className="text-sm font-bold text-fx-text hover:text-fx-orange transition-colors text-left w-full"
                  >
                    {search.name}
                  </button>
                  <p className="text-[11px] text-fx-text-dim mt-0.5">
                    {describeFilters(search.filters)}
                  </p>
                  {search.last_alerted_at && (
                    <p className="text-[10px] text-fx-text-dim mt-0.5">
                      Last alert: {new Date(search.last_alerted_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleAlert(search)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      search.alert_enabled
                        ? 'bg-fx-orange/10 text-fx-orange'
                        : 'bg-fx-surface-2 text-fx-text-dim'
                    }`}
                    title={search.alert_enabled ? 'Alerts on' : 'Alerts off'}
                  >
                    {search.alert_enabled ? <Bell size={13} /> : <BellOff size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(search.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
