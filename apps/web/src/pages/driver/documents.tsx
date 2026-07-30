import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Upload,
  Camera,
  CheckCircle2,
  PenLine,
  Download,
  Loader2,
  Check,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverLoads } from '@/services/loads.service';
import {
  getDocumentsForLoad,
  uploadDocument,
  markBolSigned,
  notifyBolSignedParties,
  deleteDocument,
} from '@/services/documents.service';
import { BolSignatureSheet } from '@/features/documents/components/bol-signature-sheet';
import { SignedBolViewer } from '@/features/documents/components/signed-bol-viewer';
import type { Load } from '@freightx/shared';
import type { DocumentRow, DocumentType } from '@/lib/database.types';

interface LoadWithDocs {
  load: Load;
  docs: DocumentRow[];
}

function docLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    bill_of_lading: 'BOL',
    proof_of_delivery: 'POD',
    rate_confirmation: 'Rate Con',
    other: 'Doc',
  };
  return labels[type] ?? type;
}

function docStatusBadge(doc: DocumentRow): { label: string; variant: 'orange' | 'green' | 'blue' } {
  if (doc.type === 'bill_of_lading' && doc.signed_at) {
    return { label: 'Signed', variant: 'green' };
  }
  if (doc.type === 'bill_of_lading') {
    return { label: 'Pending Signature', variant: 'orange' };
  }
  return { label: 'Uploaded', variant: 'blue' };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Combined BOL Upload Sheet ───────────────────────────────────────────────
// Single sheet: pick file or snap photo → toggle "already signed" → loader name → upload

function BolUploadSheet({
  load,
  userId,
  companyId,
  onDone,
  onClose,
}: {
  load: Load;
  userId: string;
  companyId: string | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [bolNumber, setBolNumber] = useState('');
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [loaderName, setLoaderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    if (alreadySigned && !loaderName.trim()) return;
    setUploading(true);
    setError('');

    try {
      const doc = await uploadDocument({
        loadId: load.id,
        uploadedBy: userId,
        companyId,
        type: 'bill_of_lading',
        file,
        bolNumber: bolNumber.trim() || undefined,
      });

      // If marked as already signed, update the doc + notify
      if (alreadySigned && loaderName.trim()) {
        await markBolSigned({ documentId: doc.id, signatoryName: loaderName.trim() });
        notifyBolSignedParties({
          loadId: load.id,
          loadNumber: load.loadNumber,
          origin: `${load.originCity}, ${load.originState}`,
          dest: `${load.destCity}, ${load.destState}`,
          signerName: loaderName.trim(),
        }).catch(console.warn);
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 space-y-4"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <h2 className="text-lg font-bold text-fx-text">Upload Bill of Lading</h2>
          <p className="text-sm text-fx-text-muted mt-0.5">
            Load {load.loadNumber} · {load.originCity}, {load.originState} → {load.destCity},{' '}
            {load.destState}
          </p>
        </div>

        {/* File / Camera picker */}
        {!file ? (
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 h-20 rounded-2xl border border-dashed border-fx-orange/40 flex flex-col items-center justify-center gap-1.5 text-fx-orange hover:bg-fx-orange/5 transition-colors"
            >
              <Upload size={20} />
              <span className="text-[11px] font-semibold">Choose File</span>
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 h-20 rounded-2xl border border-dashed border-fx-orange/40 flex flex-col items-center justify-center gap-1.5 text-fx-orange hover:bg-fx-orange/5 transition-colors"
            >
              <Camera size={20} />
              <span className="text-[11px] font-semibold">Take Photo</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-fx-surface-2 rounded-xl p-3">
            <div className="w-9 h-9 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
              <ImagePlus size={16} className="text-fx-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fx-text truncate">{file.name}</p>
              <p className="text-[10px] text-fx-text-dim">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-fx-text-dim hover:text-fx-orange transition-colors"
            >
              Change
            </button>
          </div>
        )}

        {/* BOL Number */}
        {file && (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              BOL Number
            </p>
            <input
              type="text"
              placeholder="e.g., BOL-123456 (optional)"
              value={bolNumber}
              onChange={(e) => setBolNumber(e.target.value)}
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
            />
          </div>
        )}

        {/* Already signed toggle */}
        {file && (
          <>
            <button
              onClick={() => setAlreadySigned(!alreadySigned)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-fx-surface-2 border border-fx-border"
            >
              <div
                className={`w-10 h-6 rounded-full transition-colors relative ${alreadySigned ? 'bg-fx-orange' : 'bg-fx-border'}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${alreadySigned ? 'translate-x-5' : 'translate-x-1'}`}
                />
              </div>
              <span className="text-sm font-semibold text-fx-text">Already signed at the dock</span>
            </button>

            {alreadySigned && (
              <div>
                <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                  Loader Name
                </p>
                <input
                  type="text"
                  placeholder="Loader's full name"
                  value={loaderName}
                  onChange={(e) => setLoaderName(e.target.value)}
                  autoFocus
                  className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
                />
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl font-bold text-sm bg-fx-surface-2 text-fx-text-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || (alreadySigned && !loaderName.trim()) || uploading}
            className="flex-1 h-12 rounded-2xl font-bold text-sm bg-fx-orange text-white disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Uploading…
              </>
            ) : alreadySigned ? (
              <>
                <Check size={16} /> Upload Signed BOL
              </>
            ) : (
              <>
                <Upload size={16} /> Upload BOL
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DriverDocumentsPage() {
  const navigate = useNavigate();
  const { user, company } = useAuth();
  const [loadDocs, setLoadDocs] = useState<LoadWithDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<DocumentType>('proof_of_delivery');
  const [justUploaded, setJustUploaded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // BOL signing state (canvas)
  const [signingDoc, setSigningDoc] = useState<{
    doc: DocumentRow;
    load: Load;
  } | null>(null);

  // BOL upload sheet state
  const [bolUploadLoad, setBolUploadLoad] = useState<Load | null>(null);

  // Signed BOL viewer state
  const [viewingSignedBol, setViewingSignedBol] = useState<{
    doc: DocumentRow;
    load: Load;
  } | null>(null);

  // POD file inputs (BOL now uses the sheet)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const activeLoadIdRef = useRef<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const loads = await getDriverLoads(user.id);
      const priority: Record<string, number> = {
        in_transit: 0,
        dispatched: 1,
        awarded: 2,
        delivered: 3,
        completed: 4,
      };
      const sorted = [...loads].sort(
        (a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5),
      );

      const results: LoadWithDocs[] = await Promise.all(
        sorted.map(async (load) => {
          const docs = await getDocumentsForLoad(load.id).catch(() => [] as DocumentRow[]);
          return { load, docs };
        }),
      );
      setLoadDocs(results);
    } catch (e) {
      console.error('Failed to fetch documents', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // POD upload handler (BOL uses the sheet now)
  async function handlePodFile(file: File | null) {
    const loadId = activeLoadIdRef.current;
    if (!file || !user || !loadId) return;
    setUploading(loadId);
    try {
      await uploadDocument({
        loadId,
        uploadedBy: user.id,
        companyId: company?.id ?? null,
        type: uploadType,
        file,
      });
      setJustUploaded(loadId);
      setTimeout(() => setJustUploaded(null), 2500);
      fetchAll();
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  function startPodUpload(loadId: string, useCamera: boolean) {
    activeLoadIdRef.current = loadId;
    setUploadType('proof_of_delivery');
    if (useCamera) {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!window.confirm('Delete this document?')) return;
    setDeleting(docId);
    try {
      await deleteDocument(docId);
      fetchAll();
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleting(null);
    }
  }

  const statusBadge: Record<string, 'orange' | 'blue' | 'green' | 'gray'> = {
    in_transit: 'orange',
    dispatched: 'blue',
    awarded: 'blue',
    delivered: 'green',
  };

  const statusLabel: Record<string, string> = {
    in_transit: 'In Transit',
    dispatched: 'Dispatched',
    awarded: 'Awarded',
    delivered: 'Delivered',
    completed: 'Completed',
  };

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Documents" showBack backAction={() => navigate('/driver')} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <SkeletonList count={3} />
        ) : loadDocs.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} className="text-fx-text-dim" />}
            title="No loads assigned yet"
            subtitle="Documents will appear here when loads are assigned to you"
          />
        ) : (
          loadDocs.map(({ load, docs }) => {
            const hasBol = docs.some((d) => d.type === 'bill_of_lading');
            const hasPod = docs.some((d) => d.type === 'proof_of_delivery');
            const isActive = ['in_transit', 'dispatched', 'awarded'].includes(load.status);

            return (
              <div
                key={load.id}
                className="bg-fx-surface border border-fx-border rounded-2xl overflow-hidden"
              >
                {/* Load header */}
                <div className="p-4 border-b border-fx-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
                    <Badge variant={statusBadge[load.status] ?? 'gray'} size="sm">
                      {statusLabel[load.status] ?? load.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-fx-text">
                    {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                  </p>
                  {(load.originAddress || load.destAddress) && (
                    <p className="text-[11px] text-fx-text-dim mt-0.5">
                      {load.originAddress && (
                        <span>
                          {load.originAddress}
                          {load.originZip ? ` ${load.originZip}` : ''}
                        </span>
                      )}
                      {load.originAddress && load.destAddress && ' → '}
                      {load.destAddress && (
                        <span>
                          {load.destAddress}
                          {load.destZip ? ` ${load.destZip}` : ''}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Documents list */}
                <div className="divide-y divide-fx-border">
                  {docs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-fx-text-dim">No documents yet</div>
                  ) : (
                    docs.map((doc) => {
                      const status = docStatusBadge(doc);
                      const isBolUnsigned = doc.type === 'bill_of_lading' && !doc.signed_at;

                      return (
                        <div key={doc.id} className="p-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
                            <FileText size={16} className="text-fx-orange" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-fx-text truncate">
                                {doc.file_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-semibold text-fx-orange">
                                {docLabel(doc.type as DocumentType)}
                              </span>
                              <Badge variant={status.variant} size="sm">
                                {status.label}
                              </Badge>
                              {doc.file_size && (
                                <span className="text-[10px] text-fx-text-dim">
                                  {formatBytes(doc.file_size)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isBolUnsigned && isActive ? (
                              <button
                                onClick={() => setSigningDoc({ doc, load })}
                                className="h-8 px-3 rounded-xl bg-fx-orange text-white text-[11px] font-bold flex items-center gap-1.5"
                              >
                                <PenLine size={12} /> Get Signature
                              </button>
                            ) : doc.type === 'bill_of_lading' && doc.signed_at ? (
                              <button
                                onClick={() => setViewingSignedBol({ doc, load })}
                                className="h-8 px-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-bold flex items-center gap-1.5"
                              >
                                <CheckCircle2 size={12} /> View Signed BOL
                              </button>
                            ) : (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-fx-text-dim hover:text-fx-orange transition-colors"
                              >
                                <Download size={14} />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              disabled={deleting === doc.id}
                              className="text-fx-text-dim hover:text-red-400 transition-colors disabled:opacity-40"
                              title="Delete document"
                            >
                              {deleting === doc.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin inline-block" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Upload actions */}
                {isActive && (
                  <div className="p-3 border-t border-fx-border flex gap-2">
                    {!hasBol && (
                      <button
                        onClick={() => setBolUploadLoad(load)}
                        className="flex-1 h-9 rounded-xl border border-dashed border-fx-orange/40 text-[11px] font-semibold text-fx-orange flex items-center justify-center gap-1.5 hover:bg-fx-orange/5 transition-colors"
                      >
                        <Upload size={12} /> Upload BOL
                      </button>
                    )}
                    {!hasPod && (
                      <>
                        <button
                          onClick={() => startPodUpload(load.id, false)}
                          disabled={uploading === load.id}
                          className="flex-1 h-9 rounded-xl border border-dashed border-fx-orange/40 text-[11px] font-semibold text-fx-orange flex items-center justify-center gap-1.5 hover:bg-fx-orange/5 transition-colors disabled:opacity-50"
                        >
                          {uploading === load.id && justUploaded !== load.id ? (
                            <span className="w-3 h-3 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
                          ) : justUploaded === load.id ? (
                            <>
                              <CheckCircle2 size={12} className="text-green-400" />
                              <span className="text-green-400">Done!</span>
                            </>
                          ) : (
                            <>
                              <Upload size={12} /> Upload POD
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => startPodUpload(load.id, true)}
                          disabled={uploading === load.id}
                          className="w-9 h-9 rounded-xl border border-dashed border-fx-orange/40 text-fx-orange flex items-center justify-center hover:bg-fx-orange/5 transition-colors disabled:opacity-50 shrink-0"
                          title="Capture POD with camera"
                        >
                          <Camera size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hidden file inputs — POD only */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => handlePodFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePodFile(e.target.files?.[0] ?? null)}
      />

      {/* BOL Upload Sheet (file/camera + signed toggle — one step) */}
      {bolUploadLoad && user && (
        <BolUploadSheet
          load={bolUploadLoad}
          userId={user.id}
          companyId={company?.id ?? null}
          onDone={() => {
            setBolUploadLoad(null);
            fetchAll();
          }}
          onClose={() => setBolUploadLoad(null)}
        />
      )}

      {/* Signed BOL Viewer */}
      {viewingSignedBol && (
        <SignedBolViewer
          doc={viewingSignedBol.doc}
          load={viewingSignedBol.load}
          onClose={() => setViewingSignedBol(null)}
        />
      )}

      {/* BOL Signing Sheet (on-device canvas for existing BOL) */}
      {signingDoc && (
        <BolSignatureSheet
          open={true}
          onClose={() => setSigningDoc(null)}
          documentId={signingDoc.doc.id}
          loadId={signingDoc.load.id}
          loadNumber={signingDoc.load.loadNumber}
          origin={`${signingDoc.load.originCity}, ${signingDoc.load.originState}`}
          dest={`${signingDoc.load.destCity}, ${signingDoc.load.destState}`}
          onSigned={() => {
            setSigningDoc(null);
            fetchAll();
          }}
        />
      )}

      <BottomNav role="driver" />
    </div>
  );
}
