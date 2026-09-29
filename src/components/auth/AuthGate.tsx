import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { OpticLogo } from '../brand/OpticLogo';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
  surfaceName: string;
  onOpenAuth: () => void;
  onGoHome: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  children,
  surfaceName,
  onOpenAuth,
  onGoHome,
}) => {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <OpticLogo size={32} />
          <p className="text-xs font-mono text-zinc-500 animate-pulse">
            Authenticating session with Supabase...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <OpticLogo size={32} showWordmark={true} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Authentication Required
            </h1>
            <p className="text-xs text-zinc-400">
              You must be signed in to access <span className="text-zinc-200 font-semibold">{surfaceName}</span>.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">Unified Developer Account:</strong> Single session token across <code className="text-sky-400 font-mono">optic.doy.best</code>, <code className="text-sky-400 font-mono">cloud.optic.doy.best</code>, and <code className="text-sky-400 font-mono">hosting.optic.doy.best</code>.
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={onOpenAuth}
                icon={<Lock size={14} />}
              >
                Sign In with Supabase
              </Button>

              <Button
                variant="ghost"
                className="w-full text-zinc-400"
                onClick={onGoHome}
              >
                Back to Public Homepage
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
