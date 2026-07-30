import { useState } from 'react';
import { CreditCard, DollarSign, Fuel, Snowflake, AlertCircle } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';
import {
  getFuelCards,
  getFuelTransactions,
  getFuelSummary,
  updateFuelCardStatus,
  type FuelCard,
  type FuelTransaction,
  type FuelSummary,
} from '@/services/fuel-cards.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function CarrierFuelCardsPage() {
  const { profile, company } = useAuth();
  const role = getNavRole(profile?.role);
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery<FuelCard[]>({
    queryKey: ['fuel-cards', company?.id],
    queryFn: () => (company?.id ? getFuelCards(company.id) : []),
    enabled: !!company?.id,
  });

  const { data: summary } = useQuery<FuelSummary | null>({
    queryKey: ['fuel-summary', company?.id],
    queryFn: () => (company?.id ? getFuelSummary(company.id) : null),
    enabled: !!company?.id,
  });

  const { data: transactions = [] } = useQuery<FuelTransaction[]>({
    queryKey: ['fuel-transactions', selectedCard],
    queryFn: () => (selectedCard ? getFuelTransactions(selectedCard) : []),
    enabled: !!selectedCard,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      cardId,
      status,
    }: {
      cardId: string;
      status: 'active' | 'frozen' | 'cancelled';
    }) => updateFuelCardStatus(cardId, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['fuel-cards'] }),
  });

  const STATUS_COLORS: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-400/10',
    frozen: 'text-blue-400 bg-blue-400/10',
    cancelled: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Fuel Cards" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Summary */}
        {summary && (
          <div className="bg-fx-surface border border-fx-border rounded-2xl grid grid-cols-3 divide-x divide-fx-border">
            <div className="p-3 text-center">
              <p className="text-lg font-extrabold text-fx-orange">
                ${summary.total_spent.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold text-fx-text-muted uppercase mt-0.5">Spent</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-extrabold text-fx-orange">
                {summary.total_gallons.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold text-fx-text-muted uppercase mt-0.5">
                Gallons
              </p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-extrabold text-emerald-400">
                ${summary.savings_estimate.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold text-fx-text-muted uppercase mt-0.5">Saved</p>
            </div>
          </div>
        )}

        {/* Cards list */}
        <div>
          <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 px-1">
            Your Cards
          </p>
          {isLoading ? (
            <SkeletonList count={3} />
          ) : cards.length === 0 ? (
            <EmptyState icon={<CreditCard size={24} />} title="No fuel cards issued" />
          ) : (
            <div className="space-y-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
                  className={`w-full bg-fx-surface border rounded-xl p-4 text-left transition-colors ${
                    selectedCard === card.id
                      ? 'border-fx-orange/40'
                      : 'border-fx-border hover:bg-fx-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-fx-orange" />
                      <span className="text-sm font-semibold text-fx-text font-mono">
                        {card.card_number_masked}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${STATUS_COLORS[card.status] ?? ''}`}
                    >
                      {card.status}
                    </span>
                  </div>
                  <p className="text-xs text-fx-text-muted mt-1">
                    Daily: ${card.daily_limit_usd ?? 0} · Spending: ${card.spending_limit_usd ?? 0}
                  </p>
                  {card.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        statusMutation.mutate({ cardId: card.id, status: 'frozen' });
                      }}
                      className="mt-2 text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Snowflake size={10} /> Freeze Card
                    </button>
                  )}
                  {card.status === 'frozen' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        statusMutation.mutate({ cardId: card.id, status: 'active' });
                      }}
                      className="mt-2 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Unfreeze
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transactions */}
        {selectedCard && transactions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 px-1">
              Transactions
            </p>
            <div className="space-y-1.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-8 h-8 rounded-lg bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
                    <Fuel size={13} className="text-fx-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fx-text truncate">Fuel Purchase</p>
                    <p className="text-[10px] text-fx-text-dim">
                      {new Date(tx.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-fx-text">
                      ${tx.total_amount_usd.toFixed(2)}
                    </p>
                    {tx.gallons > 0 && (
                      <p className="text-[10px] text-fx-text-dim">{tx.gallons.toFixed(1)} gal</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav role={role} />
    </div>
  );
}
