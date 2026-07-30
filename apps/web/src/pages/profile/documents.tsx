import { useState } from 'react';
import { FileText, Upload, Shield, AlertCircle, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';

interface DocumentStatus {
  id: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  verified: boolean;
  expiryDate?: string;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { profile, company } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  const role = getNavRole(profile?.role);

  // Document requirements based on role
  const isCarrier = role === 'carrier';

  const [documents, setDocuments] = useState<DocumentStatus[]>(
    isCarrier
      ? [
          {
            id: 'mc',
            name: 'MC Authority',
            description: 'Motor Carrier Authority from FMCSA',
            required: true,
            uploaded: !!company?.mc_number,
            verified: false,
          },
          {
            id: 'dot',
            name: 'DOT Number',
            description: 'Department of Transportation number',
            required: true,
            uploaded: !!company?.dot_number,
            verified: false,
          },
          {
            id: 'insurance',
            name: 'Insurance Certificate',
            description: 'Liability insurance (min $1M)',
            required: true,
            uploaded: false,
            verified: false,
          },
          {
            id: 'w9',
            name: 'W-9 Form',
            description: 'Tax identification form',
            required: true,
            uploaded: false,
            verified: false,
          },
          {
            id: 'cdl',
            name: 'CDL Copies',
            description: 'Commercial Driver License for all drivers',
            required: true,
            uploaded: false,
            verified: false,
          },
        ]
      : [
          {
            id: 'mc',
            name: 'Broker Authority',
            description: 'Freight Broker Authority from FMCSA',
            required: true,
            uploaded: !!company?.mc_number,
            verified: false,
          },
          {
            id: 'bop',
            name: 'Broker of Record',
            description: 'Broker of Record letter',
            required: true,
            uploaded: false,
            verified: false,
          },
          {
            id: 'insurance',
            name: 'Insurance Certificate',
            description: 'Freight broker liability insurance (min $100K)',
            required: true,
            uploaded: false,
            verified: false,
          },
          {
            id: 'w9',
            name: 'W-9 Form',
            description: 'Tax identification form',
            required: true,
            uploaded: false,
            verified: false,
          },
        ],
  );

  const handleUpload = async (docId: string) => {
    setUploading(docId);
    // Simulate upload - in real app, open file picker
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, uploaded: true } : d)));
    setUploading(null);
  };

  const uploadedCount = documents.filter((d) => d.uploaded).length;
  const allUploaded = uploadedCount === documents.length;

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Documents" showBack backAction={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📄</div>
          <h1 className="text-xl font-bold text-fx-text">Your Documents</h1>
          <p className="text-sm text-fx-text-muted mt-1">
            {isCarrier ? 'Upload required carrier documents' : 'Upload required broker documents'}
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-fx-orange" />
              <span className="text-sm font-semibold text-fx-text">Verification Status</span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${
                allUploaded ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {allUploaded ? 'Complete' : 'In Progress'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-fx-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allUploaded ? 'bg-green-500' : 'bg-fx-orange'
                }`}
                style={{ width: `${(uploadedCount / documents.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-fx-text-muted">
              {uploadedCount}/{documents.length}
            </span>
          </div>
        </div>

        {/* Required Notice */}
        {!allUploaded && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400">Verification Required</p>
              <p className="text-xs text-fx-text-muted mt-1">
                Upload all required documents to get verified and start hauling.
              </p>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-3 mb-6">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-fx-surface border border-fx-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    doc.uploaded
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-fx-surface-2 border border-fx-border'
                  }`}
                >
                  {doc.uploaded ? (
                    doc.verified ? (
                      <Shield size={18} className="text-green-400" />
                    ) : (
                      <Check size={18} className="text-green-400" />
                    )
                  ) : (
                    <FileText size={18} className="text-fx-text-dim" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-fx-text">{doc.name}</p>
                    {doc.required && (
                      <span className="text-[10px] text-fx-orange font-medium">Required</span>
                    )}
                  </div>
                  <p className="text-xs text-fx-text-muted mt-0.5">{doc.description}</p>

                  {doc.uploaded && (
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          doc.verified
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {doc.verified ? 'Verified' : 'Pending Review'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {!doc.uploaded && (
                <button
                  onClick={() => handleUpload(doc.id)}
                  disabled={uploading === doc.id}
                  className="w-full mt-3 h-10 bg-fx-surface-2 border border-fx-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-fx-text hover:border-fx-orange/50 transition-colors"
                >
                  {uploading === doc.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="text-fx-orange" />
                      <span>Upload Document</span>
                    </>
                  )}
                </button>
              )}

              {doc.uploaded && !doc.verified && (
                <button
                  onClick={() => handleUpload(doc.id)}
                  className="w-full mt-3 h-10 bg-fx-surface-2 border border-fx-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-fx-text-muted hover:border-fx-orange/50 transition-colors"
                >
                  <X size={16} />
                  <span>Replace Document</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Help Text */}
        <p className="text-xs text-fx-text-dim text-center">
          Documents are reviewed within 1-2 business days.{'\n'}
          Need help? Contact support@freightx.com
        </p>

        {/* Version Info */}
        <p className="text-center text-[10px] text-fx-text-dim mt-6">FreightX v0.2.0 · Phase 2</p>
      </div>

      <BottomNav role={role} />
    </div>
  );
}
