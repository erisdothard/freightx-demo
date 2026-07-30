import { MapPin, Shield, X } from 'lucide-react';

interface GpsConsentModalProps {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export function GpsConsentModal({ open, onAllow, onDismiss }: GpsConsentModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onDismiss} />

      {/* Modal */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{ maxWidth: 430, margin: '0 auto' }}
      >
        <div className="bg-fx-surface rounded-t-[24px] pb-safe overflow-hidden">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-9 h-1 rounded-full bg-fx-border" />
          </div>

          <div className="px-6 pb-6 pt-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-fx-orange/15 flex items-center justify-center">
                  <MapPin size={20} className="text-fx-orange" />
                </div>
                <h2 className="text-lg font-bold text-white">GPS Tracking</h2>
              </div>
              <button
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
              >
                <X size={16} className="text-fx-text-dim" />
              </button>
            </div>

            <p className="text-sm text-fx-text-dim mb-5 leading-relaxed">
              FreightX needs your permission to share your live GPS location with your carrier and
              dispatcher while you're on active loads.
            </p>

            {/* What's collected */}
            <div className="space-y-3 mb-6">
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
                What We Collect
              </p>
              {[
                { label: 'Location', desc: 'Latitude & longitude coordinates' },
                { label: 'Speed', desc: 'Current driving speed' },
                { label: 'Heading', desc: 'Direction of travel' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-fx-orange/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield size={12} className="text-fx-orange" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-fx-text-dim">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-fx-text-dim mb-5 leading-relaxed">
              GPS is only active while you have location sharing enabled. You can revoke access at
              any time by toggling off "Share Location" on your dashboard.
            </p>

            {/* Buttons */}
            <div className="space-y-2">
              <button
                onClick={onAllow}
                className="w-full h-12 rounded-2xl bg-fx-orange text-white font-semibold text-sm active-scale"
                style={{ boxShadow: '0 4px 16px rgba(232,96,48,0.4)' }}
              >
                Allow GPS Tracking
              </button>
              <button
                onClick={onDismiss}
                className="w-full h-12 rounded-2xl bg-white/5 text-fx-text-dim font-semibold text-sm active-scale"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
