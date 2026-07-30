import { useState } from 'react';
import { Key, Plus, Copy, Trash2, AlertCircle, Check, Shield } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getApiKeys, generateApiKey, revokeApiKey, type ApiKey } from '@/services/api-keys.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const AVAILABLE_SCOPES = [
  'loads:read',
  'loads:write',
  'bids:read',
  'bids:write',
  'tracking:read',
  'documents:read',
  'rates:read',
  'webhooks:manage',
];

export default function BrokerApiKeysPage() {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', company?.id],
    queryFn: () => (company?.id ? getApiKeys(company.id) : []),
    enabled: !!company?.id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      generateApiKey({
        companyId: company!.id,
        name,
        scopes: Array.from(selectedScopes),
      }),
    onSuccess: (data) => {
      setNewKey(data.plaintext_key);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setName('');
      setSelectedScopes(new Set());
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create key'),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        title="API Keys"
        showBack
        right={
          <button
            onClick={() => setCreateOpen(true)}
            className="w-10 h-10 rounded-xl bg-fx-orange flex items-center justify-center text-white"
          >
            <Plus size={18} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <SkeletonList count={3} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={<Key size={28} className="text-fx-text-dim" />}
            title="No API keys"
            subtitle="Generate one to integrate with your TMS"
          />
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="bg-fx-surface border border-fx-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-fx-orange" />
                    <p className="text-sm font-semibold text-fx-text">{key.name}</p>
                  </div>
                  <button
                    onClick={() => revokeMutation.mutate(key.id)}
                    disabled={revokeMutation.isPending}
                    className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-xs text-fx-text-dim font-mono">{key.key_prefix}...****</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {key.scopes.map((s) => (
                    <span
                      key={s}
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-fx-text-dim"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-fx-text-dim mt-2">
                  {key.rate_limit_rpm} req/min
                  {key.last_used_at &&
                    ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav role="broker" />

      {/* Create API Key sheet */}
      <BottomSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setNewKey(null);
        }}
        title="Generate API Key"
      >
        {newKey ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/25 text-xs text-amber-400 flex items-center gap-2">
              <Shield size={14} />
              <span>Copy this key now. It won't be shown again.</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-fx-text break-all">
              {newKey}
            </div>
            <button
              onClick={copyKey}
              className="w-full h-10 rounded-xl bg-fx-orange hover:bg-fx-orange/90 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Key
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Name *
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My TMS Integration"
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Scopes *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                      selectedScopes.has(s)
                        ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
                        : 'bg-zinc-800 border-zinc-700 text-fx-text-dim hover:border-zinc-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !name || selectedScopes.size === 0}
              className="w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
            >
              {createMutation.isPending ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
