import { useRef, useState, useEffect } from 'react';
import { Loader2, RotateCcw, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { markBolSigned, notifyBolSignedParties } from '@/services/documents.service';
import { embedSignatureIntoPdf } from '@/services/pdf-signature-embed.service';
import { VerificationSeal } from './verification-seal';

interface BolSignatureSheetProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  loadId: string;
  loadNumber: string;
  origin: string;
  dest: string;
  onSigned: (signatureUrl: string) => void;
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
 * Loader/dock-worker BOL signature capture.
 * Driver hands phone to the loader at pickup — they sign on the canvas.
 */
export function BolSignatureSheet({
  open,
  onClose,
  documentId,
  loadId,
  loadNumber,
  origin,
  dest,
  onSigned,
}: BolSignatureSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatoryName, setSignatoryName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [bolWarnings, setBolWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setHasSignature(false);
    setConsentChecked(false);
    setError('');
    setBolWarnings([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pre-validate BOL required fields (49 CFR § 373.101)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .rpc('validate_bol_requirements', { p_load_id: loadId })
      .then(({ data }: { data: { valid: boolean; errors: string[] } | null }) => {
        if (data && !data.valid && data.errors?.length) {
          setBolWarnings(data.errors);
        }
      })
      .catch(() => {
        /* non-blocking */
      });
  }, [open, loadId]);

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
      // Capture metadata in parallel with document fetch + attestation hash
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [bolDocResult, gps, networkTs, attestationResult] = await Promise.all([
        supabase.from('documents').select('*').eq('id', documentId).single(),
        getGpsCoords(),
        getNetworkTimestamp(),
        // Fetch the carrier attestation hash for this load (chain of custody link)
        (supabase as any)
          .from('carrier_attestations')
          .select('attestation_hash')
          .eq('load_id', loadId)
          .maybeSingle(),
      ]);
      const attestationHash: string | null = attestationResult?.data?.attestation_hash ?? null;
      if (bolDocResult.error || !bolDocResult.data) throw new Error('BOL document not found');
      const bolDoc = bolDocResult.data;

      const consentGivenAt = new Date().toISOString();

      // 2. Convert canvas to data URL
      const signatureDataUrl = canvas.toDataURL('image/png', 0.95);

      const hasRealPdf = !!bolDoc.file_url;
      let signedPdfUrl: string | undefined;
      let docHash: string | undefined;
      let signedDocHash: string | undefined;

      if (hasRealPdf) {
        // 3a. Embed signature into existing PDF (now returns hashes)
        const result = await embedSignatureIntoPdf({
          pdfUrl: bolDoc.file_url,
          signatureDataUrl,
          signatoryName: signatoryName.trim(),
          signedAt: new Date(),
        });
        docHash = result.docHash;
        signedDocHash = result.signedDocHash;

        // 4a. Upload signed PDF (replace original)
        const path = `${loadId}/bill_of_lading-signed-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, result.blob, { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        signedPdfUrl = urlData.publicUrl;
      }

      // 5. Save signature PNG (for in-app display, and as primary artifact when no PDF exists)
      const signaturePngPath = `documents/signatures/bol-${loadId}-${Date.now()}.png`;
      const signatureBlob = await fetch(signatureDataUrl).then((r) => r.blob());
      await supabase.storage.from('documents').upload(signaturePngPath, signatureBlob, {
        contentType: 'image/png',
        upsert: true,
      });

      const { data: sigUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(signaturePngPath);

      // 6. Update document record with signature metadata + hashes + GPS + consent
      await markBolSigned({
        documentId,
        signatoryName: signatoryName.trim(),
        signatureUrl: sigUrlData.publicUrl,
        ...(signedPdfUrl && { signedPdfUrl }),
      });

      // Store legal-grade metadata columns + chain of custody link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('documents')
        .update({
          doc_hash: docHash ?? null,
          signed_doc_hash: signedDocHash ?? null,
          sign_lat: gps?.lat ?? null,
          sign_lng: gps?.lng ?? null,
          sign_network_ts: networkTs,
          consent_given_at: consentGivenAt,
          attestation_hash: attestationHash,
        })
        .eq('id', documentId);

      // Log consent event to audit_log (includes chain of custody link)
      await supabase.rpc('write_audit_log', {
        p_action: 'consent_given',
        p_entity_type: 'document',
        p_entity_id: documentId,
        p_diff: {
          consent_text:
            'I confirm my intent to electronically sign this document. This signature carries the same legal weight as a handwritten signature.',
          consent_given_at: consentGivenAt,
          sign_lat: gps?.lat ?? null,
          sign_lng: gps?.lng ?? null,
          sign_network_ts: networkTs,
          attestation_hash: attestationHash,
        },
      });

      // 7. Delete old unsigned PDF (cleanup) — only if we replaced it
      if (hasRealPdf && signedPdfUrl) {
        const oldPath = bolDoc.file_url.split('/documents/')[1];
        if (oldPath && !oldPath.includes('signed')) {
          await supabase.storage.from('documents').remove([oldPath]);
        }
      }

      // 8. Notify broker + carrier (non-blocking)
      notifyBolSignedParties({
        loadId,
        loadNumber,
        origin,
        dest,
        signerName: signatoryName.trim(),
        bolPdfUrl: signedPdfUrl,
      }).catch(console.warn);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSigned(signedPdfUrl ?? sigUrlData.publicUrl);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col items-center gap-4 animate-scale-in">
          <VerificationSeal />
          <p className="text-lg font-bold text-fx-text">BOL Signed</p>
          <p className="text-sm text-fx-text-muted">Document verified & recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 space-y-4"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <h2 className="text-lg font-bold text-fx-text">Loader Signature — Bill of Lading</h2>
          <p className="text-sm text-fx-text-muted mt-0.5">
            Load {loadNumber} · {origin} → {dest}
          </p>
          <p className="text-xs text-fx-text-dim mt-1">Have the loader/dock worker sign below</p>
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

        {/* Printed name */}
        <div>
          <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
            Loader Name
          </p>
          <input
            type="text"
            placeholder="Loader's full name"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
            className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
          />
        </div>

        {/* BOL field warnings */}
        {bolWarnings.length > 0 && (
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
            <p className="text-xs font-bold text-yellow-400 mb-1">Missing Required Fields</p>
            <ul className="text-xs text-yellow-300/80 space-y-0.5">
              {bolWarnings.map((w, i) => (
                <li key={i}>- {w}</li>
              ))}
            </ul>
            <p className="text-[10px] text-yellow-400/60 mt-2">
              Update the load details before signing to ensure compliance.
            </p>
          </div>
        )}

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
                <Check size={16} /> Confirm Signature
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
