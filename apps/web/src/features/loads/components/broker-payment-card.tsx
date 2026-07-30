import { CreditCard, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BrokerPaymentCardProps {
  brokerId?: string;
  companyId?: string;
  className?: string;
}

// Placeholder data until broker payment API is wired up
const PLACEHOLDER = {
  paymentTerms: 'Net 30',
  avgDaysToPay: 22,
  quickPay: true,
  quickPayFee: 2.5,
  factoringAccepted: true,
};

export function BrokerPaymentCard({
  brokerId: _brokerId,
  companyId: _companyId,
  className,
}: BrokerPaymentCardProps) {
  const { paymentTerms, avgDaysToPay, quickPay, quickPayFee, factoringAccepted } = PLACEHOLDER;

  const daysColor =
    avgDaysToPay <= 14 ? 'text-green-400' : avgDaysToPay <= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div
      className={cn('rounded-2xl border border-fx-border bg-fx-surface p-4 space-y-3', className)}
    >
      <div className="flex items-center gap-2">
        <CreditCard size={15} className="text-fx-orange" />
        <span className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Payment Terms
        </span>
      </div>

      <div className="flex gap-4">
        <div>
          <p className="text-lg font-black text-fx-text">{paymentTerms}</p>
          <p className="text-[10px] text-fx-text-dim">standard terms</p>
        </div>
        <div>
          <p className={cn('text-lg font-black', daysColor)}>{avgDaysToPay}d</p>
          <p className="text-[10px] text-fx-text-dim">avg to pay</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickPay && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-0.5 border border-blue-500/20">
            <Clock size={11} />
            QuickPay ({quickPayFee}% fee)
          </span>
        )}
        {factoringAccepted && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-400 bg-green-500/10 rounded-full px-2.5 py-0.5 border border-green-500/20">
            <ShieldCheck size={11} />
            Factoring Accepted
          </span>
        )}
      </div>
    </div>
  );
}

export default BrokerPaymentCard;
