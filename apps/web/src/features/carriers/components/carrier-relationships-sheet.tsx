import { useState, useEffect } from 'react';
import { Star, Ban, Trash2, Plus, Search, Loader2, ChevronDown } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import {
  getRelationships,
  upsertRelationship,
  removeRelationship,
  type CarrierRelationship,
  type RelationshipStatus,
} from '@/services/carrier-relationships.service';
import { supabase } from '@/lib/supabase';

interface CarrierRelationshipsSheetProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  RelationshipStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  preferred: {
    label: 'Preferred',
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    icon: Star,
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: Ban,
  },
};

interface CompanyRow {
  id: string;
  name: string;
}

export function CarrierRelationshipsSheet({ open, onClose }: CarrierRelationshipsSheetProps) {
  const [relationships, setRelationships] = useState<CarrierRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<RelationshipStatus>('preferred');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanyRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getRelationships()
      .then(setRelationships)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .eq('type', 'carrier')
      .limit(6);
    setSearchResults((data as CompanyRow[]) ?? []);
    setSearching(false);
  }

  async function handleAdd(carrier: CompanyRow) {
    setSaving(true);
    try {
      await upsertRelationship(carrier.id, 'preferred');
      const updated = await getRelationships();
      setRelationships(updated);
      setShowAdd(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(rel: CarrierRelationship) {
    setSaving(true);
    try {
      await upsertRelationship(rel.carrier_id, editStatus, editNotes);
      const updated = await getRelationships();
      setRelationships(updated);
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setSaving(true);
    try {
      await removeRelationship(id);
      setRelationships((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Carrier Network">
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-3 mb-3">{error}</p>
      )}

      {/* Add carrier button */}
      <button
        onClick={() => setShowAdd((v) => !v)}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl border border-fx-orange/40 text-sm font-semibold text-fx-orange hover:bg-fx-orange/5 transition-colors mb-4"
      >
        <Plus size={14} />
        Add Carrier
      </button>

      {/* Search panel */}
      {showAdd && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type="text"
              placeholder="Search carrier companies…"
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
              className="w-full h-10 bg-fx-surface border border-fx-border rounded-xl pl-9 pr-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange outline-none"
              autoFocus
            />
            {searching && (
              <Loader2
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim animate-spin"
              />
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="bg-fx-surface border border-fx-border rounded-xl divide-y divide-fx-border overflow-hidden">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void handleAdd(c)}
                  disabled={saving}
                  className="w-full text-left px-4 py-3 text-sm text-fx-text hover:bg-fx-surface-2 transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="text-fx-orange animate-spin" />
        </div>
      ) : relationships.length === 0 ? (
        <div className="text-center py-12 text-fx-text-muted text-sm">
          No carrier relationships yet
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => {
            const cfg = STATUS_CONFIG[rel.status];
            const Icon = cfg.icon;
            const isEditing = editId === rel.id;

            return (
              <div key={rel.id} className="bg-fx-surface border border-fx-border rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fx-text truncate">
                      {rel.carrier_name ?? rel.carrier_id}
                    </p>
                    {rel.notes && !isEditing && (
                      <p className="text-xs text-fx-text-dim mt-0.5 truncate">{rel.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}
                    >
                      <Icon size={10} />
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditId(null);
                          return;
                        }
                        setEditId(rel.id);
                        setEditStatus(rel.status);
                        setEditNotes(rel.notes ?? '');
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-fx-surface-2 transition-colors"
                    >
                      <ChevronDown
                        size={14}
                        className={`text-fx-text-dim transition-transform ${isEditing ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-2 pt-3 border-t border-fx-border">
                    {/* Status selector */}
                    <div className="flex gap-1.5">
                      {(['preferred', 'blocked'] as RelationshipStatus[]).map((s) => {
                        const sc = STATUS_CONFIG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => setEditStatus(s)}
                            className={`flex-1 h-8 rounded-xl text-xs font-semibold border transition-all ${
                              editStatus === s
                                ? `${sc.bg} ${sc.color}`
                                : 'border-fx-border text-fx-text-dim'
                            }`}
                          >
                            {sc.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Notes */}
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full h-9 bg-fx-surface-2 border border-fx-border rounded-xl px-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange outline-none"
                    />
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleRemove(rel.id)}
                        disabled={saving}
                        className="h-9 w-9 flex items-center justify-center rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 h-9 rounded-xl border border-fx-border text-xs font-semibold text-fx-text-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleSaveEdit(rel)}
                        disabled={saving}
                        className="flex-1 h-9 rounded-xl bg-fx-orange text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin mx-auto" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
