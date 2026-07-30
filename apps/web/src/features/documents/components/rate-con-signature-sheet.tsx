import { useRef, useState, useEffect } from 'react';
import { Loader2, RotateCcw, Check, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { embedSignatureIntoPdf } from '@/services/pdf-signature-embed.service';
import { generateRateConBlob } from '@/features/bookings/lib/generate-rate-con';
import { notifyRateConSigned } from '@/services/email-notifications.service';
import { VerificationSeal } from './verification-seal';
import type { Load } from '@freightx/shared';

interface RateConSignatureSheetProps {
  open: boolean;
  onClose: () => void;
  load: Load;
  carrierName: string;
  brokerName: string;
  uploadedBy: string;
  onSigned: () => void;
}

/** Fetch server-side timestamp via Supabase REST response header to avoid device clock spoofing. */
async function getNetworkTimestamp(): Promise<string> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    const dateHeader = res.headers.get('date');
    if (dateHeader) return new Date(dateHeader).toISOString();
  } catch {
    // fallback
  }
  return new Date().toISOString();
}

/** Request GPS coordinates (non-blocking — returns null on failure). */
function getGpsCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  });
}

/**
 * Carrier signs the rate confirmation before dispatch.
 * Generates the rate con PDF, captures an e-signature, embeds it,
 * uploads the signed PDF to storage, and saves a rate_confirmation doc record.
 */
export function RateConSignatureSheet({
  open,
  onClose,
  load,
  carrierName,
  brokerName,
  uploadedBy,
  onSigned,
}: RateConSignatureSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatoryName, setSignatoryName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setHasSignature(false);
    setConsentChecked(false);
    setError('');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [open]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#E86030';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSign() {
    if (!hasSignature || !signatoryName.trim() || !consentChecked) return;
    const canvas = canvasRef.current!;
    setSaving(true);
    setError('');

    try {
      // Capture metadata in parallel + attestation hash for chain of custody
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [gps, networkTs, attestationResult] = await Promise.all([
        getGpsCoords(),
        getNetworkTimestamp(),
        (supabase as any)
          .from('carrier_attestations')
          .select('attestation_hash')
          .eq('load_id', load.id)
          .maybeSingle(),
      ]);
      const attestationHash: string | null = attestationResult?.data?.attestation_hash ?? null;
      const consentGivenAt = new Date().toISOString();

      // 1. Generate unsigned rate con PDF as Blob
      const unsignedBlob = generateRateConBlob({ load, carrierName, brokerName });

      // 2. Upload unsigned PDF to get a URL for the embed service
      const unsignedPath = `${load.id}/rate_confirmation-unsigned-${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(unsignedPath, unsignedBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: unsignedUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(unsignedPath);

      // 3. Capture signature PNG
      const signatureDataUrl = canvas.toDataURL('image/png', 0.95);

      // 4. Embed signature into PDF (now returns hashes)
      const result = await embedSignatureIntoPdf({
        pdfUrl: unsignedUrlData.publicUrl,
        signatureDataUrl,
        signatoryName: signatoryName.trim(),
        signedAt: new Date(),
      });

      // 5. Upload signed PDF
      const signedPath = `${load.id}/rate_confirmation-signed-${Date.now()}.pdf`;
      const { error: signedUploadErr } = await supabase.storage
        .from('documents')
        .upload(signedPath, result.blob, { contentType: 'application/pdf', upsert: true });
      if (signedUploadErr) throw signedUploadErr;
      const { data: signedUrlData } = supabase.storage.from('documents').getPublicUrl(signedPath);

      // 6. Upload signature PNG
      const sigPngPath = `documents/signatures/ratecon-${load.id}-${Date.now()}.png`;
      const sigBlob = await fetch(signatureDataUrl).then((r) => r.blob());
      await supabase.storage
        .from('documents')
        .upload(sigPngPath, sigBlob, { contentType: 'image/png', upsert: true });
      const { data: sigUrlData } = supabase.storage.from('documents').getPublicUrl(sigPngPath);

      // 7. Save document record with hashes + metadata + chain of custody link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase as any).from('documents').insert({
        load_id: load.id,
        uploaded_by: uploadedBy,
        type: 'rate_confirmation',
        file_name: `RateCon-${load.loadNumber}.pdf`,
        file_url: signedUrlData.publicUrl,
        file_size: result.blob.size,
        mime_type: 'application/pdf',
        signed_at: new Date().toISOString(),
        signature_url: sigUrlData.publicUrl,
        signatory_name: signatoryName.trim(),
        doc_hash: result.docHash,
        signed_doc_hash: result.signedDocHash,
        sign_lat: gps?.lat ?? null,
        sign_lng: gps?.lng ?? null,
        sign_network_ts: networkTs,
        consent_given_at: consentGivenAt,
        attestation_hash: attestationHash,
      });
      if (dbErr) throw new Error(dbErr.message);

      // Log consent event to audit_log (includes chain of custody link)
      await supabase
        .rpc('write_audit_log', {
          p_action: 'consent_given',
          p_entity_type: 'document',
          p_entity_id: load.id,
          p_diff: {
            consent_text:
              'I confirm my intent to electronically sign this document. This signature carries the same legal weight as a handwritten signature.',
            consent_given_at: consentGivenAt,
            sign_lat: gps?.lat ?? null,
            sign_lng: gps?.lng ?? null,
            sign_network_ts: networkTs,
            attestation_hash: attestationHash,
          },
        })
        .then(undefined, () => undefined);

      // 8. Notify broker by email + in-app notification (non-fatal)
      if (load.postedBy) {
        const { data: brokerProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', load.postedBy)
          .single();
        if (brokerProfile?.email) {
          notifyRateConSigned({
            brokerEmail: brokerProfile.email,
            loadNumber: load.loadNumber,
            origin: `${load.originCity}, ${load.originState}`,
            dest: `${load.destCity}, ${load.destState}`,
            carrierName,
            signedBy: signatoryName.trim(),
            rateConPdfUrl: signedUrlData.publicUrl,
          }).catch(() => {});
        }
        // In-app notification for broker
        supabase
          .from('notifications')
          .insert({
            user_id: load.postedBy,
            type: 'rate_con_signed',
            title: 'Rate Confirmation Signed',
            body: `${carrierName} signed the rate confirmation for load ${load.loadNumber}. Ready to dispatch.`,
            load_id: load.id,
          })
          .then(
            () => undefined,
            () => undefined,
          );
      }

      // 9. Clean up unsigned PDF
      await supabase.storage
        .from('documents')
        .remove([unsignedPath])
        .catch(() => {});

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSigned();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rate confirmation');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col items-center gap-4 animate-scale-in">
          <VerificationSeal />
          <p className="text-lg font-bold text-fx-text">Rate Con Signed</p>
          <p className="text-sm text-fx-text-muted">Document verified & recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 space-y-4"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-fx-orange" />
            <h2 className="text-lg font-bold text-fx-text">Sign Rate Confirmation</h2>
          </div>
          <p className="text-sm text-fx-text-muted mt-0.5">
            Load {load.loadNumber} · {load.originCity}, {load.originState} → {load.destCity},{' '}
            {load.destState}
          </p>
          <p className="text-xs text-fx-text-dim mt-1">
            Rate: <span className="text-fx-orange font-bold">${load.rateUsd.toLocaleString()}</span>
            {load.totalMiles ? ` · ${load.totalMiles} mi` : ''}
          </p>
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mt-2">
            By signing, carrier agrees to transport this load at the stated rate. Required before
            dispatch.
          </p>
        </div>

        {/* Signature pad */}
        <div
          className="rounded-xl overflow-hidden border border-fx-border"
          style={{ touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full"
            style={{ display: 'block', cursor: 'crosshair', background: '#111' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-[11px] text-fx-text-dim">Draw your signature above</p>
          <button
            onClick={clearCanvas}
            className="flex items-center gap-1 text-xs text-fx-text-dim hover:text-fx-orange transition-colors"
          >
            <RotateCcw size={12} />
            Clear
          </button>
        </div>

        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Authorized Representative Name
          </p>
          <input
            type="text"
            placeholder="Full name"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
            className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
          />
        </div>

        {/* Click-wrap consent checkbox */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-fx-border accent-fx-orange flex-shrink-0"
          />
          <span className="text-xs text-fx-text-muted leading-relaxed">
            I confirm my intent to electronically sign this document. This signature carries the
            same legal weight as a handwritten signature.
          </span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl font-bold text-sm bg-fx-surface-2 text-fx-text-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSign}
            disabled={!hasSignature || !signatoryName.trim() || !consentChecked || saving}
            className="flex-1 h-12 rounded-2xl font-bold text-sm bg-fx-orange text-white disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check size={16} /> Sign Rate Con
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
