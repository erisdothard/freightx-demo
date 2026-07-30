import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, CheckCircle2 } from 'lucide-react';
import { IOSStatusBar } from '@/shared/components/ios-status-bar';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const resetUrl = `${window.location.origin}/reset-password`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetUrl,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
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
        <button
          onClick={() => navigate('/login')}
          className="w-9 h-9 rounded-xl bg-fx-surface flex items-center justify-center text-fx-text-muted"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-fx-text">Reset Password</h1>
        </div>
      </div>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-fx-text">Check your inbox</p>
            <p className="text-sm text-fx-text-muted mt-2 leading-relaxed">
              We sent a password reset link to{' '}
              <span className="text-fx-orange font-semibold">{email}</span>. Click the link in the
              email to set a new password.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-[13px] text-fx-orange font-semibold mt-2"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-4">
          <p className="text-sm text-fx-text-muted leading-relaxed">
            Enter the email address for your FreightX account and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputClass} pl-10`}
                autoComplete="email"
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
              disabled={loading || !email}
              className="w-full h-12 rounded-ios-xs flex items-center justify-center gap-2 text-[15px] font-semibold text-white active-scale disabled:opacity-60 bg-orange-gradient"
              style={{ boxShadow: '0 4px 20px rgba(232,96,48,0.4)' }}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
