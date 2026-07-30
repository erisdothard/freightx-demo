import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Truck,
  Briefcase,
  Package,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Building2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptInvite,
  getInviteByToken,
} from '@/services/company-members.service';
import type { InvitePreview } from '@/services/company-members.service';
import type { UserRole } from '@/lib/database.types';

type Step = 1 | 2 | 3;

interface RoleCard {
  id: UserRole;
  label: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  route: string;
}

const roles: RoleCard[] = [
  {
    id: 'carrier',
    label: 'Carrier',
    description: 'I haul freight',
    detail: 'Post available trucks, search loads, bid and book, get paid.',
    icon: <Truck size={28} />,
    route: '/carrier',
  },
  {
    id: 'broker',
    label: 'Broker',
    description: 'I connect freight',
    detail: 'Post loads, find reliable carriers, manage your book of business.',
    icon: <Briefcase size={28} />,
    route: '/broker',
  },
  {
    id: 'shipper',
    label: 'Shipper',
    description: 'I ship goods',
    detail: 'Post loads, get competitive bids, track shipments, manage dock scheduling.',
    icon: <Package size={28} />,
    route: '/shipper',
  },
];

const STEP_TITLES: Record<Step, string> = {
  1: 'Choose your role',
  2: 'Create your account',
  3: 'Company details',
};

export default function OnboardingPage() {
  const { token: inviteToken } = useParams<{ token?: string }>();
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<UserRole | null>(null);

  // Invite preview state
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteExpired, setInviteExpired] = useState(false);

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 3 fields
  const [companyName, setCompanyName] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [brokerAuth, setBrokerAuth] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { signUp, signInWithGoogle, createCompany } = useAuth();

  const selectedRole = roles.find((r) => r.id === selected);

  // Invite flows skip Step 3 (company already set)
  const totalSteps = invitePreview ? 2 : 3;
  // If arriving via invite, Step 1 is skipped — renumber for display
  const displayStep = invitePreview ? step - 1 : step;

  // Fetch invite details when arriving via /invite/:token
  useEffect(() => {
    if (!inviteToken) return;
    getInviteByToken(inviteToken).then((preview) => {
      if (!preview || !preview.is_valid) {
        setInviteExpired(true);
      } else {
        setInvitePreview(preview);
        setEmail(preview.email);
        setSelected(preview.role as UserRole);
        setStep(2); // Skip role selection
      }
      setInviteLoading(false);
    });
  }, [inviteToken]);

  function back() {
    setError(null);
    if (invitePreview && step === 2) {
      navigate('/');
      return;
    }
    if (step > 1) setStep((s) => (s - 1) as Step);
    else navigate('/');
  }

  // Step 2 → create auth account + profile, then check for pending invite
  async function handleCreateAccount() {
    if (!selected || !fullName || !email || password.length < 8) return;
    setError(null);
    setLoading(true);
    const { error } = await signUp(email.trim(), password, fullName.trim(), selected);
    if (error) {
      setLoading(false);
      setError(error);
      return;
    }

    // If invite token from URL, accept it directly
    if (inviteToken) {
      try {
        await acceptInvite(inviteToken);
        setLoading(false);
        navigate(selectedRole!.route);
        return;
      } catch {
        // Token invalid/expired — fall through to email check
      }
    }

    setLoading(false);
    setStep(3);
  }

  // Google OAuth signup handler
  async function handleGoogleSignUp() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    const { error } = await signInWithGoogle(selected, inviteToken ?? undefined);
    if (error) {
      setLoading(false);
      setError(error);
    }
    // Redirect happens automatically — loading spinner stays on
  }

  // Step 3 → create company + mark onboarding complete
  async function handleCreateCompany() {
    if (!companyName.trim()) return;
    setError(null);
    setLoading(true);
    const { error } = await createCompany({
      name: companyName.trim(),
      mc_number: mcNumber.trim() || undefined,
      dot_number: dotNumber.trim() || undefined,
      broker_authority: brokerAuth.trim() || undefined,
      phone: companyPhone.trim() || undefined,
    });
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(selectedRole!.route);
  }

  const inputClass =
    'w-full h-12 bg-fx-surface rounded-ios-xs px-4 text-[14px] text-white placeholder:text-fx-text-dim focus:ring-1 focus:ring-fx-orange/50 outline-none transition-all card-highlight';

  // Loading state while fetching invite preview
  if (inviteLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-fx-border border-t-fx-orange rounded-full animate-spin" />
      </div>
    );
  }

  // Expired / invalid invite
  if (inviteExpired) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
          <Mail size={28} className="text-red-400" />
        </div>
        <p className="text-xl font-bold text-fx-text">This invite has expired</p>
        <p className="text-sm text-fx-text-muted max-w-xs">
          Ask your carrier admin to send a new invite from the Team page.
        </p>
        <Button size="lg" onClick={() => navigate('/')} className="rounded-2xl font-bold mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 pb-10">
      {/* Header */}
      <div
        className="flex items-center gap-3 py-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        <button
          onClick={back}
          className="w-9 h-9 rounded-xl bg-fx-surface flex items-center justify-center text-fx-text-muted"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-xs text-fx-text-muted font-semibold tracking-widest uppercase">
            Step {displayStep} of {totalSteps}
          </p>
          <h1 className="text-xl font-bold text-fx-text">{STEP_TITLES[step]}</h1>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-fx-surface rounded-full mb-8">
        <div
          className="h-full bg-fx-orange rounded-full transition-all duration-500"
          style={{ width: `${(displayStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* ── Step 1: Role selection ── */}
      {step === 1 && (
        <>
          <p className="text-fx-text-muted text-sm mb-6">
            Select how you use FreightX. You can always add more roles later.
          </p>

          <div className="flex flex-col gap-3 flex-1">
            {roles.map((role) => {
              const isSelected = selected === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelected(role.id)}
                  className={cn(
                    'w-full text-left rounded-2xl border p-5 transition-all duration-200 flex items-start gap-4',
                    isSelected
                      ? 'bg-fx-orange/10 border-fx-orange shadow-orange-glow'
                      : 'bg-fx-surface border-fx-border hover:border-fx-border-2',
                  )}
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-fx-orange text-white' : 'bg-fx-surface-2 text-fx-text-muted',
                    )}
                  >
                    {role.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-fx-text">{role.label}</span>
                      {isSelected && <CheckCircle2 size={20} className="text-fx-orange" />}
                    </div>
                    <p className="text-xs font-semibold text-fx-orange mt-0.5">
                      {role.description}
                    </p>
                    <p className="text-sm text-fx-text-muted mt-1.5 leading-relaxed">
                      {role.detail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              disabled={!selected}
              onClick={() => setStep(2)}
              className="rounded-2xl font-bold"
            >
              Continue as {selectedRole?.label ?? '—'}
              <ArrowRight size={18} />
            </Button>
            <p className="text-center text-xs text-fx-text-dim">
              By continuing, you agree to our{' '}
              <span className="text-fx-orange">Terms of Service</span>
            </p>
          </div>
        </>
      )}

      {/* ── Step 2: Account details ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4 flex-1">
          {/* Invite context banner */}
          {invitePreview && (
            <div className="bg-fx-orange/10 border border-fx-orange/20 rounded-2xl p-4 -mt-2 mb-1">
              <p className="text-sm font-bold text-fx-orange">
                Joining {invitePreview.company_name}
              </p>
              <p className="text-xs text-fx-text-muted mt-1">
                You've been invited as a{' '}
                <span className="text-fx-text font-semibold capitalize">{invitePreview.role}</span>.
                Create your account below.
              </p>
            </div>
          )}

          {!invitePreview && (
            <p className="text-fx-text-muted text-sm -mt-2 mb-2">
              Create your{' '}
              <span className="text-fx-orange font-semibold">{selectedRole?.label}</span> account.
            </p>
          )}

          <div className="relative">
            <User
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${inputClass} pl-10`}
              autoComplete="name"
            />
          </div>

          <div className="relative">
            <Mail
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => !invitePreview && setEmail(e.target.value)}
              readOnly={!!invitePreview}
              className={`${inputClass} pl-10 ${invitePreview ? 'opacity-60 cursor-not-allowed' : ''}`}
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type="password"
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pl-10`}
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 rounded-ios-xs px-4 py-3">
              {error}
            </p>
          )}

          <div className="mt-auto pt-6 flex flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              disabled={loading || !fullName || !email || password.length < 8}
              onClick={handleCreateAccount}
              className="rounded-2xl font-bold"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : invitePreview ? (
                <>
                  Create Account <ArrowRight size={18} />
                </>
              ) : (
                <>
                  Next: Company Info <ArrowRight size={18} />
                </>
              )}
            </Button>

            {/* Google OAuth divider + button */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-fx-border" />
              <span className="text-xs text-fx-text-dim">or</span>
              <div className="flex-1 h-px bg-fx-border" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading || !selected}
              className="w-full h-12 rounded-ios-xs flex items-center justify-center gap-3 bg-fx-surface border border-fx-border text-fx-text text-[14px] font-semibold disabled:opacity-50 hover:border-fx-border-2 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.09 24.09 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-xs text-fx-text-dim">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-fx-orange font-semibold">
                Sign in
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3: Company details ── */}
      {step === 3 && (
        <div className="flex flex-col gap-4 flex-1">
          <p className="text-fx-text-muted text-sm -mt-2 mb-2">
            Tell us about your{' '}
            <span className="text-fx-orange font-semibold">{selectedRole?.label}</span> company.
            This builds your public profile.
          </p>

          {/* Company name — required */}
          <div className="relative">
            <Building2
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type="text"
              placeholder="Company name *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>

          {/* MC number — carriers + brokers */}
          {(selected === 'carrier' || selected === 'broker') && (
            <input
              type="text"
              placeholder="MC Number (e.g. MC-847293)"
              value={mcNumber}
              onChange={(e) => setMcNumber(e.target.value)}
              className={inputClass}
            />
          )}

          {/* DOT number — carriers only */}
          {selected === 'carrier' && (
            <input
              type="text"
              placeholder="DOT Number (e.g. DOT-1923847)"
              value={dotNumber}
              onChange={(e) => setDotNumber(e.target.value)}
              className={inputClass}
            />
          )}

          {/* Broker authority — brokers only */}
          {selected === 'broker' && (
            <input
              type="text"
              placeholder="Broker Authority Number"
              value={brokerAuth}
              onChange={(e) => setBrokerAuth(e.target.value)}
              className={inputClass}
            />
          )}

          {/* Shipper hint */}
          {selected === 'shipper' && (
            <p className="text-xs text-fx-text-dim px-1">
              You'll be able to post loads, manage RFPs, and schedule dock appointments once your account is set up.
            </p>
          )}

          {/* Company phone */}
          <input
            type="tel"
            placeholder="Company phone (optional)"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            className={inputClass}
          />

          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 rounded-ios-xs px-4 py-3">
              {error}
            </p>
          )}

          <p className="text-[11px] text-fx-text-dim mt-1">
            * Required. MC/DOT numbers will be verified against FMCSA in a future update.
          </p>

          <div className="mt-auto pt-4 flex flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              disabled={loading || !companyName.trim()}
              onClick={handleCreateCompany}
              className="rounded-2xl font-bold"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Launch FreightX <ArrowRight size={18} />
                </>
              )}
            </Button>

            <button
              onClick={() => navigate(selectedRole!.route)}
              className="text-center text-xs text-fx-text-dim hover:text-fx-text-muted transition-colors"
            >
              Skip for now — I'll add company details later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
