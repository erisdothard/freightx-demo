import { X, Printer, Download } from 'lucide-react';
import type { DocumentRow } from '@/lib/database.types';
import type { Load } from '@freightx/shared';

interface SignedBolViewerProps {
  doc: DocumentRow;
  load: Load;
  onClose: () => void;
}

export function SignedBolViewer({ doc, load, onClose }: SignedBolViewerProps) {
  const signedAt = doc.signed_at
    ? new Date(doc.signed_at).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <>
      {/* Print styles — injected into head via style tag */}
      <style>{`
        @media print {
          body > *:not(#signed-bol-print-root) { display: none !important; }
          #signed-bol-print-root {
            position: static !important;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
          .print-page {
            padding: 32px !important;
            background: white !important;
            color: black !important;
            font-family: Arial, sans-serif !important;
          }
          .print-page * { color: black !important; border-color: #ddd !important; }
        }
      `}</style>

      <div
        id="signed-bol-print-root"
        className="fixed inset-0 z-[60] flex items-end justify-center"
      >
        <div className="absolute inset-0 bg-black/80 no-print" onClick={onClose} />

        <div
          className="print-page relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl"
          style={{ background: '#0e0e16', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 no-print">
            <h2 className="text-lg font-bold text-white">Signed Bill of Lading</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-fx-orange text-white text-[12px] font-bold"
              >
                <Printer size={14} /> Download / Print
              </button>
              <button
                onClick={onClose}
                className="text-fx-text-dim hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* BOL Content */}
          <div className="px-6 pb-8 space-y-5">
            {/* Title */}
            <div
              className="text-center pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <p className="text-[11px] font-bold text-fx-text-muted uppercase tracking-widest">
                FreightX
              </p>
              <p className="text-xl font-extrabold text-white mt-1">Bill of Lading</p>
              <p className="text-sm text-fx-text-muted mt-0.5">Load #{load.loadNumber}</p>
            </div>

            {/* Route */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-1">
                  Origin
                </p>
                <p className="text-sm font-semibold text-white">
                  {load.originCity}, {load.originState}
                </p>
                {load.originAddress && (
                  <p className="text-xs text-fx-text-dim mt-0.5">{load.originAddress}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-1">
                  Destination
                </p>
                <p className="text-sm font-semibold text-white">
                  {load.destCity}, {load.destState}
                </p>
                {load.destAddress && (
                  <p className="text-xs text-fx-text-dim mt-0.5">{load.destAddress}</p>
                )}
              </div>
            </div>

            {/* Load details */}
            <div
              className="rounded-xl p-4 grid grid-cols-2 gap-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {[
                { label: 'Equipment', value: load.equipment },
                { label: 'Weight', value: `${(load.weightLbs / 1000).toFixed(0)}k lbs` },
                {
                  label: 'Pickup Date',
                  value: new Date(load.pickupDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                },
                {
                  label: 'Delivery Date',
                  value: load.deliveryDate
                    ? new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—',
                },
                { label: 'Broker', value: load.companyName },
                { label: 'Rate', value: `$${load.rateUsd.toLocaleString()}` },
                ...(load.freight_class
                  ? [{ label: 'Freight Class', value: `Class ${load.freight_class}` }]
                  : []),
                ...(load.packaging_type
                  ? [
                      {
                        label: 'Packaging',
                        value:
                          load.packaging_type.charAt(0).toUpperCase() +
                          load.packaging_type.slice(1),
                      },
                    ]
                  : []),
                ...(load.po_number ? [{ label: 'PO Number', value: load.po_number }] : []),
                ...(load.shipper_reference
                  ? [{ label: 'Shipper Ref', value: load.shipper_reference }]
                  : []),
                ...(doc.bol_number ? [{ label: 'BOL Number', value: doc.bol_number }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Signature block */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3">
                Electronic Signature
              </p>

              {doc.signature_url && (
                <div
                  className="rounded-xl overflow-hidden mb-3"
                  style={{ background: 'white', padding: '8px' }}
                >
                  <img
                    src={doc.signature_url}
                    alt="Signature"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-0.5">
                    Signed By
                  </p>
                  <p className="text-sm font-semibold text-white">{doc.signatory_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-0.5">
                    Signed At
                  </p>
                  <p className="text-sm font-semibold text-white">{signedAt}</p>
                </div>
              </div>
            </div>

            {/* Download signed PDF */}
            <div className="flex gap-3 no-print">
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  download={`BOL-${load.loadNumber}-signed.pdf`}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white bg-fx-orange hover:bg-fx-orange/90 transition-colors"
                >
                  <Download size={16} /> Download Signed BOL
                </a>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold text-fx-text-dim hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Printer size={16} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
