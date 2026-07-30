import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const pointerDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onPointerDown={(e) => {
          pointerDownTarget.current = e.target;
        }}
        onClick={(e) => {
          if (pointerDownTarget.current === e.currentTarget) onClose();
          pointerDownTarget.current = null;
        }}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-[430px] mx-auto rounded-t-[28px] flex flex-col animate-slide-up"
        style={{
          background: 'linear-gradient(180deg, #1E1A17 0%, #181410 100%)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
          maxHeight: '92dvh',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={onClose}
            className="text-[14px] font-semibold text-fx-text-muted hover:text-fx-orange transition-colors"
          >
            Cancel
          </button>
          <p className="text-[17px] font-bold text-white tracking-[-0.01em]">{title}</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/08 flex items-center justify-center hover:bg-white/12 transition-colors"
          >
            <X size={14} className="text-fx-text-muted" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-10 scrollbar-hide">{children}</div>
      </div>
    </div>
  );
}
