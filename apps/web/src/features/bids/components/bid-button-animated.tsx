import { useState } from 'react';
import { Gavel, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BidButtonAnimatedProps {
  loadId: string;
  onBid?: () => void;
  disabled?: boolean;
  className?: string;
}

export function BidButtonAnimated({
  loadId: _loadId,
  onBid,
  disabled = false,
  className,
}: BidButtonAnimatedProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');

  async function handleClick() {
    if (state !== 'idle' || disabled) return;

    setState('loading');

    try {
      onBid?.();
      // Brief visual confirmation
      setState('success');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state !== 'idle'}
      className={cn(
        'relative flex items-center justify-center gap-2 rounded-xl px-5 py-2.5',
        'text-sm font-bold tracking-wide transition-all duration-200',
        'active:scale-95',
        state === 'idle' &&
          !disabled &&
          'bg-fx-orange text-white hover:bg-fx-orange/90 shadow-lg shadow-fx-orange/20',
        state === 'loading' && 'bg-fx-orange/70 text-white cursor-wait',
        state === 'success' && 'bg-green-500 text-white',
        disabled && 'bg-fx-surface-2 text-fx-text-dim cursor-not-allowed border border-fx-border',
        className,
      )}
    >
      {state === 'idle' && (
        <>
          <Gavel size={15} />
          Place Bid
        </>
      )}
      {state === 'loading' && (
        <>
          <Loader2 size={15} className="animate-spin" />
          Placing...
        </>
      )}
      {state === 'success' && (
        <>
          <CheckCircle size={15} />
          Bid Placed
        </>
      )}
    </button>
  );
}

export default BidButtonAnimated;
