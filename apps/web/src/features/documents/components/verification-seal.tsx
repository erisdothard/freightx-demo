import { ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface VerificationSealProps {
  verified?: boolean;
  label?: string;
  className?: string;
}

export function VerificationSeal({ verified = true, label, className }: VerificationSealProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide border',
        verified
          ? 'bg-green-500/10 text-green-400 border-green-500/25'
          : 'bg-red-500/10 text-red-400 border-red-500/25',
        className,
      )}
    >
      {verified ? <ShieldCheck size={14} /> : <XCircle size={14} />}
      <span>{label ?? (verified ? 'Verified' : 'Unverified')}</span>
    </div>
  );
}

export default VerificationSeal;
