import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, User as UserIcon, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { OpticLogo } from '../brand/OpticLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}) => {
  const { signIn, signUp, signInWithGoogle, demoLogin, isSupabaseConfigured, supabaseUrl } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
        onSuccess?.();
        onClose();
      } else {
        await signUp(email, password, fullName);
        if (isSupabaseConfigured) {
          setSignupSuccess(true);
        } else {
          onSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      if (!isSupabaseConfigured) {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    demoLogin('Alex Rivera');
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'signin' ? 'Sign in to Optic' : 'Create your Optic account'}
      description="One developer identity across Dashboard, Cloud, and Hosting."
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Brand identity badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-zinc-800">
          <OpticLogo size={22} showWordmark={true} />
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <Shield size={13} className="text-emerald-400" />
            <span>Unified Auth (Supabase)</span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-1.5 rounded-md transition-colors ${
              mode === 'signin'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-1.5 rounded-md transition-colors ${
              mode === 'signup'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {signupSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} />
              <span>Account created successfully</span>
            </div>
            <p className="text-zinc-400">
              Please check your email ({email}) to confirm your account if email confirmations are enabled in your Supabase project.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSignupSuccess(false);
                setMode('signin');
              }}
              className="mt-2"
            >
              Proceed to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <Input
                label="Full Name"
                placeholder="Ada Lovelace"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<UserIcon size={16} />}
                required
              />
            )}

            <Input
              type="email"
              label="Work or Personal Email"
              placeholder="developer@optic.doy.best"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-2"
              variant="primary"
            >
              {mode === 'signin' ? 'Sign In to Platform' : 'Create Developer Account'}
            </Button>
          </form>
        )}

        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-900 px-2 text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
            or continue with
          </span>
        </div>

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 text-xs"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          }
        >
          Continue with Google
        </Button>

        {/* Demo Fast Login for Instant Testing */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-[11px] text-zinc-500">Fast preview test:</span>
          <button
            type="button"
            onClick={handleDemoSignIn}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
          >
            <span>Sign in as Test Developer</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Cross-subdomain explanation note */}
        <div className="text-[10px] text-zinc-500 leading-relaxed font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/60">
          <span className="text-zinc-400 font-semibold">Cross-Subdomain SSO:</span> Authenticating sets your Optic session cookie across optic.doy.best, cloud.optic.doy.best, and hosting.optic.doy.best.
        </div>
      </div>
    </Modal>
  );
};
