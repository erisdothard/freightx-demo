import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Download, Camera, CheckCircle2 } from 'lucide-react';
import { uploadDocument, getDocumentsForLoad } from '@/services/documents.service';
import { useAuth } from '@/contexts/AuthContext';
import type { DocumentRow, DocumentType } from '@/lib/database.types';

const DOC_TYPES: { type: DocumentType; label: string; roles: string[] }[] = [
  {
    type: 'bill_of_lading',
    label: 'Bill of Lading',
    roles: ['carrier', 'broker', 'admin', 'driver'],
  },
  { type: 'proof_of_delivery', label: 'Proof of Delivery', roles: ['carrier', 'admin', 'driver'] },
  { type: 'rate_confirmation', label: 'Rate Confirmation', roles: ['broker', 'admin'] },
  { type: 'other', label: 'Other Document', roles: ['carrier', 'broker', 'admin'] },
];

const DOC_LABEL: Record<DocumentType, string> = {
  bill_of_lading: 'BOL',
  proof_of_delivery: 'POD',
  rate_confirmation: 'Rate Con',
  other: 'Doc',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadProps {
  loadId: string;
  role: string;
}

export function DocumentUpload({ loadId, role }: DocumentUploadProps) {
  const { user, company } = useAuth();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType>('bill_of_lading');
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(() => {
    getDocumentsForLoad(loadId)
      .then(setDocs)
      .catch(() => undefined);
  }, [loadId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function handleFile(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument({
        loadId,
        uploadedBy: user.id,
        companyId: company?.id ?? null,
        type: selectedType,
        file,
      });
      setJustUploaded(selectedType);
      setTimeout(() => setJustUploaded(null), 2500);
      fetchDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  const availableTypes = DOC_TYPES.filter((d) => d.roles.includes(role));
  const isPOD = selectedType === 'proof_of_delivery';

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Upload Document
        </p>

        {/* Doc type selector */}
        <div className="grid grid-cols-2 gap-2">
          {availableTypes.map((d) => (
            <button
              key={d.type}
              onClick={() => setSelectedType(d.type)}
              className={`h-10 rounded-xl text-xs font-semibold transition-all ${
                selectedType === d.type
                  ? 'bg-fx-orange text-white'
                  : 'bg-fx-surface-2 border border-fx-border text-fx-text-muted hover:border-fx-orange/40'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Upload buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 h-11 rounded-xl border border-dashed border-fx-orange/40 text-xs font-semibold text-fx-orange flex items-center justify-center gap-2 hover:bg-fx-orange/5 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-4 h-4 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
            ) : justUploaded ? (
              <>
                <CheckCircle2 size={14} className="text-green-400" />{' '}
                <span className="text-green-400">Uploaded!</span>
              </>
            ) : (
              <>
                <Upload size={14} /> Choose File
              </>
            )}
          </button>

          {isPOD && (
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="w-11 h-11 rounded-xl border border-dashed border-fx-orange/40 text-fx-orange flex items-center justify-center hover:bg-fx-orange/5 transition-colors disabled:opacity-50"
              title="Capture with camera"
            >
              <Camera size={16} />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
        )}
      </div>

      {/* Uploaded documents list */}
      {docs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
            Documents · {docs.length}
          </p>
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-fx-surface border border-fx-border rounded-2xl hover:border-fx-orange/40 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-fx-orange" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fx-text truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold text-fx-orange">
                    {DOC_LABEL[doc.type as DocumentType]}
                  </span>
                  {doc.file_size && (
                    <span className="text-[10px] text-fx-text-dim">
                      {formatBytes(doc.file_size)}
                    </span>
                  )}
                  <span className="text-[10px] text-fx-text-dim">
                    {new Date(doc.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <Download
                size={14}
                className="text-fx-text-dim group-hover:text-fx-orange transition-colors shrink-0"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
