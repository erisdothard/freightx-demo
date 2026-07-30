import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-emerald-400 shrink-0" />,
  error: <AlertCircle size={16} className="text-red-400 shrink-0" />,
  info: <Info size={16} className="text-blue-400 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
};

const BORDER: Record<ToastVariant, string> = {
  success: 'border-emerald-500/30',
  error: 'border-red-500/30',
  info: 'border-blue-500/30',
  warning: 'border-amber-500/30',
};

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastItem({ toast, onClose }: ToastItemProps) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl bg-fx-surface border ${BORDER[toast.variant]} shadow-lg backdrop-blur-sm animate-slide-up text-sm text-fx-text max-w-xs w-full`}
    >
      {ICONS[toast.variant]}
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="text-fx-text-dim hover:text-fx-text transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}
