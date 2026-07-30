import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { IOSStatusBar } from '@/shared/components/ios-status-bar';
import { supabase } from '@/lib/supabase';

export default function ClaimAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setVerifying(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setVerifying(false);
    });
    // If no token and no session after a delay, show error
    const timeout = setTimeout(() => {
      if (verifying && !token) {
        setError('Invalid or expired claim link.');
        setVerifying(false);
      }
    }, 5000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [token, verifying]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  }

  const inputClass =
    'w-full h-12 bg-fx-surface rounded-ios-xs px-4 text-[14px] text-white placeholder:text-fx-text-dim focus:ring-1 focus:ring-fx-orange/50 outline-none transition-all card-highlight';

  return (
    <div className="min-h-dvh flex flex-col px-5 pb-10">
      <IOSStatusBar />

      <div
        className="flex items-center gap-3 py-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        <div>
          <h1 className="text-xl font-bold text-fx-text">Claim Your Account</h1>
          <p className="text-xs text-fx-text-muted mt-0.5">
            Set a password to activate your FreightX account.
          </p>
        </div>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-fx-text">Account claimed</p>
            <p className="text-sm text-fx-text-muted mt-2">Redirecting you to sign in…</p>
          </div>
        </div>
      ) : verifying ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
          <span className="w-8 h-8 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
          <p className="text-sm text-fx-text-muted">Verifying invite link…</p>
        </div>
      ) : error && !password ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="text-sm text-fx-orange underline"
          >
            Go to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Choose a password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pl-10 pr-11`}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputClass} pl-10`}
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 rounded-ios-xs px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full h-12 rounded-ios-xs flex items-center justify-center gap-2 text-[15px] font-semibold text-white active-scale disabled:opacity-60 bg-orange-gradient"
            style={{ boxShadow: '0 4px 20px rgba(232,96,48,0.4)' }}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Activate Account'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
