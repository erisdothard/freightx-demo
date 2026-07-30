import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  ArrowLeftRight,
  DollarSign,
  MessageSquare,
} from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { getBidsForLoad, acceptBid, declineBid, counterBid } from '@/services/bids.service';
import { getOrCreateConversation } from '@/services/messages.service';
import { SignatureModal } from '@/features/bookings/components/signature-modal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BidRow } from '@/lib/database.types';
import type { Load } from '@freightx/shared';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-fx-orange/10 text-fx-orange',
  accepted: 'bg-green-500/10 text-green-400',
  declined: 'bg-red-500/10 text-red-400',
  countered: 'bg-blue-500/10 text-blue-400',
  expired: 'bg-fx-surface-2 text-fx-text-dim',
  cancelled: 'bg-fx-surface-2 text-fx-text-dim',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface BidListSheetProps {
  open: boolean;
  onClose: () => void;
  load: Load | null;
  onBidAccepted?: () => void;
}

export function BidListSheet({ open, onClose, load, onBidAccepted }: BidListSheetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counterBidId, setCounterBidId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [sigModal, setSigModal] = useState<{ bookingId: string; loadNumber: string } | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const fetchBids = useCallback(() => {
    if (!load) return;
    setLoading(true);
    getBidsForLoad(load.id)
      .then(setBids)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load bids'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (open) fetchBids();
  }, [open, fetchBids]);

  // Realtime — new bids appear instantly
  useEffect(() => {
    if (!open || !load) return;
    const channel = supabase
      .channel(`bids-${load.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `load_id=eq.${load.id}` },
        fetchBids,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bids', filter: `load_id=eq.${load.id}` },
        fetchBids,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, load, fetchBids]);

  async function handleAccept(bidId: string) {
    setActingId(bidId);
    setError(null);
    try {
      await acceptBid(bidId);
      fetchBids();
      setSigModal({
        bookingId: bidId,
        loadNumber: load?.loadNumber ?? load?.id ?? bidId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept bid');
    } finally {
      setActingId(null);
    }
  }

  async function handleCounter(originalBid: BidRow) {
    if (!user || !load || !counterAmount) return;
    const amount = parseFloat(counterAmount);
    if (!amount || amount <= 0) return;
    setActingId(originalBid.id);
    setError(null);
    try {
      await counterBid({
        originalBidId: originalBid.id,
        loadId: load.id,
        carrierId: originalBid.carrier_id,
        companyId: originalBid.company_id,
        companyName: originalBid.company_name || 'Carrier',
        originalAmount: originalBid.amount_usd,
        counterAmount: amount,
      });
      setCounterBidId(null);
      setCounterAmount('');
      fetchBids();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Counter failed');
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(bidId: string) {
    setActingId(bidId);
    setError(null);
    try {
      await declineBid(bidId);
      fetchBids();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decline bid');
    } finally {
      setActingId(null);
    }
  }

  async function handleMessageCarrier(bid: BidRow) {
    if (!user || !load) return;
    setMessagingId(bid.id);
    try {
      const convo = await getOrCreateConversation(
        user.id,
        bid.carrier_id,
        bid.company_name || 'Carrier',
        'carrier',
        load.loadNumber,
      );
      onClose();
      navigate('/messages', { state: { openConversation: convo } });
    } catch {
      setError('Failed to open conversation');
    } finally {
      setMessagingId(null);
    }
  }

  const pendingBids = bids.filter((b) => b.status === 'pending');
  const otherBids = bids.filter((b) => b.status !== 'pending');

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Bids Received">
        {load && (
          <div className="bg-fx-surface-2 border border-fx-border rounded-2xl p-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-fx-text-dim font-semibold">{load.loadNumber}</p>
              <p className="text-sm font-bold text-fx-text">
                {load.originCity} → {load.destCity}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-fx-text-dim">Asking</p>
              <p className="text-sm font-bold text-fx-orange">${load.rateUsd.toLocaleString()}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-3 mb-3">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-6 h-6 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
          </div>
        ) : bids.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Users size={36} className="text-fx-text-dim mb-4" />
            <p className="font-bold text-fx-text">No bids yet</p>
            <p className="text-sm text-fx-text-muted mt-1">
              Carriers will appear here when they bid
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingBids.length > 0 && (
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
                Pending · {pendingBids.length}
              </p>
            )}

            {pendingBids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                askingRate={load?.rateUsd ?? 0}
                acting={actingId === bid.id}
                onAccept={() => handleAccept(bid.id)}
                onDecline={() => handleDecline(bid.id)}
                onCounter={() => {
                  setCounterBidId(bid.id);
                  setCounterAmount('');
                }}
                counterOpen={counterBidId === bid.id}
                counterAmount={counterAmount}
                onCounterAmountChange={setCounterAmount}
                onCounterSubmit={() => handleCounter(bid)}
                onCounterCancel={() => {
                  setCounterBidId(null);
                  setCounterAmount('');
                }}
                onMessage={() => handleMessageCarrier(bid)}
                messaging={messagingId === bid.id}
              />
            ))}

            {otherBids.length > 0 && (
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest pt-2">
                History · {otherBids.length}
              </p>
            )}

            {otherBids.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                askingRate={load?.rateUsd ?? 0}
                acting={false}
                readOnly
                onMessage={() => handleMessageCarrier(bid)}
                messaging={messagingId === bid.id}
              />
            ))}
          </div>
        )}
      </BottomSheet>

      <SignatureModal
        open={!!sigModal}
        onClose={() => setSigModal(null)}
        bookingId={sigModal?.bookingId ?? ''}
        loadNumber={sigModal?.loadNumber ?? ''}
        onSigned={() => {
          setSigModal(null);
          onBidAccepted?.();
        }}
      />
    </>
  );
}

function BidCard({
  bid,
  askingRate,
  acting,
  readOnly,
  onAccept,
  onDecline,
  onCounter,
  counterOpen,
  counterAmount,
  onCounterAmountChange,
  onCounterSubmit,
  onCounterCancel,
  onMessage,
  messaging,
}: {
  bid: BidRow;
  askingRate: number;
  acting: boolean;
  readOnly?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
  counterOpen?: boolean;
  counterAmount?: string;
  onCounterAmountChange?: (v: string) => void;
  onCounterSubmit?: () => void;
  onCounterCancel?: () => void;
  onMessage?: () => void;
  messaging?: boolean;
}) {
  const diff = askingRate ? ((bid.amount_usd - askingRate) / askingRate) * 100 : 0;
  const diffLabel =
    diff === 0 ? 'at ask' : diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
  const diffColor = diff > 5 ? 'text-red-400' : diff < -5 ? 'text-green-400' : 'text-fx-text-muted';

  return (
    <div
      className={`rounded-2xl border p-4 ${bid.status === 'pending' ? 'border-fx-orange/20 bg-fx-orange/5' : 'border-fx-border bg-fx-surface'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-bold text-fx-text">{bid.company_name || 'Carrier'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-fx-text-dim flex items-center gap-1">
              <Clock size={10} /> {timeAgo(bid.created_at)}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[bid.status]}`}
            >
              {bid.status}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-fx-text">${bid.amount_usd.toLocaleString()}</p>
          <p className={`text-[11px] font-semibold ${diffColor}`}>{diffLabel}</p>
        </div>
      </div>

      {bid.notes && (
        <p className="text-xs text-fx-text-muted bg-fx-surface-2 rounded-xl px-3 py-2 mb-3 leading-relaxed">
          "{bid.notes}"
        </p>
      )}

      {!readOnly && bid.status === 'pending' && (
        <>
          {counterOpen ? (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <DollarSign
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-fx-text-dim"
                />
                <input
                  type="number"
                  min="1"
                  step="50"
                  placeholder="Counter amount"
                  value={counterAmount}
                  onChange={(e) => onCounterAmountChange?.(e.target.value)}
                  className="w-full h-10 bg-fx-surface border border-fx-orange/40 rounded-xl pl-8 pr-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:outline-none focus:ring-1 focus:ring-fx-orange/30"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCounterCancel}
                  className="flex-1 h-9 rounded-xl border border-fx-border text-xs font-bold text-fx-text-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={onCounterSubmit}
                  disabled={acting || !counterAmount}
                  className="flex-1 h-9 rounded-xl bg-blue-500 text-xs font-bold text-white disabled:opacity-50"
                >
                  {acting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  ) : (
                    'Send Counter'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onDecline}
                disabled={acting}
                className="flex-1 h-10 rounded-xl border border-fx-border text-xs font-bold text-fx-text-muted flex items-center justify-center gap-1.5 hover:border-red-400/50 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} /> Decline
              </button>
              <button
                onClick={onCounter}
                disabled={acting}
                className="flex-1 h-10 rounded-xl border border-blue-500/40 text-xs font-bold text-blue-400 flex items-center justify-center gap-1.5 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
              >
                <ArrowLeftRight size={14} /> Counter
              </button>
              <button
                onClick={onAccept}
                disabled={acting}
                className="flex-1 h-10 rounded-xl bg-green-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {acting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={14} /> Accept
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Message carrier button — always available */}
      {onMessage && (
        <button
          onClick={onMessage}
          disabled={messaging}
          className="w-full h-8 rounded-xl border border-fx-border text-[11px] font-semibold text-fx-text-muted flex items-center justify-center gap-1.5 hover:border-fx-orange/40 hover:text-fx-orange transition-colors disabled:opacity-50 mt-2"
        >
          {messaging ? (
            <span className="w-3 h-3 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
          ) : (
            <>
              <MessageSquare size={12} />
              Message Carrier
            </>
          )}
        </button>
      )}

      {bid.status === 'accepted' && (
        <div className="flex items-center gap-2 mt-2 text-green-400">
          <CheckCircle size={14} />
          <span className="text-xs font-semibold">Accepted — load awarded</span>
        </div>
      )}
    </div>
  );
}
