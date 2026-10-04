import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../lib/supabaseClient';
import { Skeleton } from '../common/Skeleton';
import { OpticLogo } from '../brand/OpticLogo';

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
}) => {
  const { user, loading, refreshSession } = useAuth();
  const [checkingCrossDomain, setCheckingCrossDomain] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    // If user is already authenticated in context, skip check
    if (user) {
      setCheckingCrossDomain(false);
      return;
    }

    if (!loading) {
      // Check session across subdomains and Supabase cookies
      const verifySession = async () => {
        try {
          await refreshSession();
          if (!active) return;

          const sb = getSupabase();
          if (sb) {
            const { data } = await sb.auth.getSession();
            if (data?.session?.user) {
              setCheckingCrossDomain(false);
              return;
            }
          }

          // If no session found across subdomains/cookies, automatically redirect to login page
          if (active) {
            onOpenAuth();
          }
        } catch {
          if (active) {
            onOpenAuth();
          }
        }
      };

      verifySession();
    }

    return () => {
      active = false;
    };
  }, [user, loading, refreshSession, onOpenAuth]);

  // While authenticating, verifying cross-subdomain sessions, or redirecting:
  // Render a sleek, authentic Optic developer dashboard skeleton (NO pop-up, NO modal, NO manual button click)
  if (!user || checkingCrossDomain) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden font-sans">
        {/* Desktop Sidebar Skeleton */}
        <aside className="hidden md:flex flex-col w-60 border-r border-zinc-800 bg-zinc-950 shrink-0 p-4 space-y-6">
          <div className="h-10 flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <OpticLogo size={18} />
              <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 rounded-md" />
          </div>

          <div className="space-y-1.5">
            <div className="w-20 h-2.5 bg-zinc-800/60 rounded text-[10px]" />
            <div className="w-full h-9 bg-zinc-900 border border-zinc-800/80 rounded-lg animate-pulse" />
          </div>

          <div className="space-y-2 pt-2">
            <div className="w-16 h-2.5 bg-zinc-800/60 rounded text-[10px]" />
            <div className="w-full h-8 bg-zinc-900/60 rounded-lg animate-pulse" />
            <div className="w-full h-8 bg-zinc-900/60 rounded-lg animate-pulse" />
            <div className="w-full h-8 bg-zinc-900/60 rounded-lg animate-pulse" />
          </div>

          <div className="space-y-2 pt-4 mt-auto border-t border-zinc-800/60">
            <div className="w-full h-8 bg-zinc-900/40 rounded-lg animate-pulse" />
            <div className="w-full h-8 bg-zinc-900/40 rounded-lg animate-pulse" />
          </div>
        </aside>

        {/* Main View Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          {/* Header Skeleton */}
          <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-32 h-5 bg-zinc-800/80 rounded-md animate-pulse" />
              <div className="w-14 h-4 bg-emerald-500/10 border border-emerald-500/20 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-8 bg-zinc-900 border border-zinc-800 rounded-lg" />
              <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
            </div>
          </div>

          {/* Body Content Skeleton */}
          <div className="flex-1 p-6 space-y-6 max-w-6xl w-full mx-auto overflow-y-auto">
            {/* Top Banner / Actions row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              <div className="space-y-2">
                <div className="w-48 h-6 bg-zinc-800/90 rounded-md animate-pulse" />
                <div className="w-72 h-3.5 bg-zinc-800/50 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-8 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse" />
                <div className="w-28 h-8 bg-indigo-600/30 border border-indigo-500/30 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Stat / Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="w-24 h-3 bg-zinc-800/70 rounded" />
                <div className="w-32 h-6 bg-zinc-800 rounded animate-pulse" />
                <div className="w-40 h-2.5 bg-zinc-800/50 rounded" />
              </div>
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="w-24 h-3 bg-zinc-800/70 rounded" />
                <div className="w-28 h-6 bg-zinc-800 rounded animate-pulse" />
                <div className="w-36 h-2.5 bg-zinc-800/50 rounded" />
              </div>
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="w-24 h-3 bg-zinc-800/70 rounded" />
                <div className="w-36 h-6 bg-zinc-800 rounded animate-pulse" />
                <div className="w-48 h-2.5 bg-zinc-800/50 rounded" />
              </div>
            </div>

            {/* Item List Skeleton */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 divide-y divide-zinc-800/60 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/80 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="w-36 h-4 bg-zinc-800/90 rounded" />
                      <div className="w-56 h-3 bg-zinc-800/50 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-6 rounded-md bg-zinc-800/60" />
                    <div className="w-16 h-6 rounded-md bg-zinc-800/60" />
                  </div>
                </div>
              ))}
            </div>

            {/* Discreet status notice */}
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-500 py-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>Verifying Optic developer session across subdomains...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
