import { useState } from 'react';
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, FlaskConical } from 'lucide-react';

const FMCSA_IS_PLACEHOLDER =
  (import.meta.env.VITE_FMCSA_API_KEY as string) === 'PLACEHOLDER_FMCSA_KEY' ||
  !import.meta.env.VITE_FMCSA_API_KEY;
import { VerifiedBadge } from './VerifiedBadge';
import { IdentityRiskBadge } from './identity-risk-badge';
import { startFmcsaLookup, uploadInsuranceCert, uploadW9 } from '@/services/verification.service';
import type { CarrierVerificationRow } from '@/lib/database.types';

interface Props {
  companyId: string;
  userId?: string;
  initial?: CarrierVerificationRow | null;
}

type Step = 'fmcsa' | 'insurance' | 'w9' | 'done';

function sectionDone(v: CarrierVerificationRow | null, step: Step) {
  if (!v) return false;
  if (step === 'fmcsa') return !!v.fmcsa_verified_at;
  if (step === 'insurance') return !!v.insurance_cert_url;
  if (step === 'w9') return !!v.w9_url;
  return false;
}

export function VerificationPanel({ companyId, userId, initial }: Props) {
  const [verification, setVerification] = useState<CarrierVerificationRow | null>(initial ?? null);
  const [active, setActive] = useState<Step>('fmcsa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FMCSA form state
  const [mcNumber, setMcNumber] = useState(verification?.mc_number ?? '');
  const [dotNumber, setDotNumber] = useState(verification?.dot_number ?? '');

  // Insurance form state
  const [insCarrier, setInsCarrier] = useState(verification?.insurance_carrier ?? '');
  const [insPolicy, setInsPolicy] = useState(verification?.insurance_policy ?? '');
  const [insAmount, setInsAmount] = useState(
    verification?.insurance_amount_usd ? String(verification.insurance_amount_usd) : '',
  );
  const [insExpires, setInsExpires] = useState(verification?.insurance_expires_at ?? '');
  const [insCertFile, setInsCertFile] = useState<File | null>(null);

  // W-9 form state
  const [w9File, setW9File] = useState<File | null>(null);

  const run = async (fn: () => Promise<CarrierVerificationRow>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fn();
      setVerification(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFmcsa = () =>
    run(() =>
      startFmcsaLookup(companyId, {
        mcNumber: mcNumber || undefined,
        dotNumber: dotNumber || undefined,
      }),
    );

  const handleInsurance = () => {
    if (!insCertFile) return;
    run(() =>
      uploadInsuranceCert(companyId, insCertFile, {
        carrier: insCarrier,
        policy: insPolicy,
        amountUsd: parseInt(insAmount, 10),
        expiresAt: insExpires,
      }),
    );
  };

  const handleW9 = () => {
    if (!w9File) return;
    run(() => uploadW9(companyId, w9File));
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'fmcsa', label: 'FMCSA Authority' },
    { key: 'insurance', label: 'Insurance Cert' },
    { key: 'w9', label: 'W-9' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-fx-orange" />
          <h3 className="text-sm font-semibold text-fx-text-main uppercase tracking-wider">
            Carrier Verification
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {verification && <VerifiedBadge status={verification.status} size="md" />}
          {verification && (verification as Record<string, unknown>).risk_score != null && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                ((verification as Record<string, unknown>).risk_score as number) <= 30
                  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  : ((verification as Record<string, unknown>).risk_score as number) <= 60
                    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                    : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}
            >
              Risk {(verification as Record<string, unknown>).risk_score as number}
            </span>
          )}
        </div>
      </div>

      {/* Identity risk assessment */}
      {userId && <IdentityRiskBadge userId={userId} />}

      {/* Step nav */}
      <div className="flex gap-2">
        {steps.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              active === s.key
                ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
                : sectionDone(verification, s.key)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800 border-zinc-700 text-fx-text-dim'
            }`}
          >
            {sectionDone(verification, s.key) && <CheckCircle2 size={11} />}
            {s.label}
          </button>
        ))}
      </div>

      {/* FMCSA panel */}
      {active === 'fmcsa' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          {FMCSA_IS_PLACEHOLDER && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-xs text-amber-400">
              <FlaskConical size={13} className="shrink-0" />
              <span>
                FMCSA lookup is in <strong>test mode</strong> — all carriers auto-approved. Register
                a free API key at{' '}
                <a
                  href="https://portal.fmcsa.dot.gov/Developer"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-amber-300"
                >
                  portal.fmcsa.dot.gov
                </a>{' '}
                to go live.
              </span>
            </div>
          )}
          {verification?.fmcsa_verified_at && (
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Verified{' '}
              {new Date(verification.fmcsa_verified_at).toLocaleDateString()} —{' '}
              {verification.fmcsa_status}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                MC Number
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                placeholder="MC-XXXXXX"
                value={mcNumber}
                onChange={(e) => setMcNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                DOT Number
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                placeholder="XXXXXXX"
                value={dotNumber}
                onChange={(e) => setDotNumber(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleFmcsa}
            disabled={loading || (!mcNumber && !dotNumber)}
            className="h-10 w-full bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify via FMCSA'}
          </button>
          {verification?.safety_rating && (
            <p className="text-xs text-fx-text-dim">
              Safety rating: <span className="text-fx-text-main">{verification.safety_rating}</span>
            </p>
          )}
        </div>
      )}

      {/* Insurance panel */}
      {active === 'insurance' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          {verification?.insurance_cert_url && (
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Certificate uploaded — expires{' '}
              {verification.insurance_expires_at
                ? new Date(verification.insurance_expires_at).toLocaleDateString()
                : 'unknown'}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Insurance Carrier
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                placeholder="e.g. Great West Casualty"
                value={insCarrier}
                onChange={(e) => setInsCarrier(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Policy Number
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                placeholder="Policy #"
                value={insPolicy}
                onChange={(e) => setInsPolicy(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Coverage Amount ($)
              </label>
              <input
                type="number"
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                placeholder="1000000"
                value={insAmount}
                onChange={(e) => setInsAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text-main focus:outline-none focus:border-fx-orange"
                value={insExpires}
                onChange={(e) => setInsExpires(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              Certificate of Insurance (PDF / Image)
            </label>
            <label className="flex items-center gap-2 h-10 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 cursor-pointer hover:border-fx-orange transition-colors">
              <Upload size={14} className="text-fx-text-dim" />
              <span className="text-sm text-fx-text-dim">
                {insCertFile ? insCertFile.name : 'Choose file…'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={(e) => setInsCertFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            onClick={handleInsurance}
            disabled={
              loading || !insCertFile || !insCarrier || !insPolicy || !insAmount || !insExpires
            }
            className="h-10 w-full bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Uploading…' : 'Save Insurance'}
          </button>
        </div>
      )}

      {/* W-9 panel */}
      {active === 'w9' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          {verification?.w9_url && (
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> W-9 uploaded{' '}
              {verification.w9_uploaded_at
                ? new Date(verification.w9_uploaded_at).toLocaleDateString()
                : ''}
            </div>
          )}
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              W-9 Form (PDF)
            </label>
            <label className="flex items-center gap-2 h-10 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 cursor-pointer hover:border-fx-orange transition-colors">
              <Upload size={14} className="text-fx-text-dim" />
              <span className="text-sm text-fx-text-dim">
                {w9File ? w9File.name : 'Choose PDF…'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={(e) => setW9File(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            onClick={handleW9}
            disabled={loading || !w9File}
            className="h-10 w-full bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Uploading…' : 'Upload W-9'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </div>
  );
}
