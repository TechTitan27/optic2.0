import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getUserAvatarUrl } from '../../lib/avatar';
import {
  User,
  Mail,
  Key,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  getActiveAnonKey,
  getStoredAnonKey,
  setCustomAnonKey,
  clearCustomAnonKey,
  verifySupabaseKey,
} from '../../lib/supabaseClient';

export const SettingsView: React.FC = () => {
  const { user, profile, isSupabaseConfigured, supabaseUrl, refreshSession, updateProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile?.fullName) {
      setFullName(profile.fullName);
    }
  }, [profile?.fullName]);

  // Anon Key state
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [storedKey, setStoredKey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<boolean | null>(null);

  useEffect(() => {
    const custom = getStoredAnonKey();
    setStoredKey(custom);
    if (custom) {
      setAnonKeyInput(custom);
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name.', 'Validation Error');
      return;
    }
    try {
      if (user) {
        await updateProfile(fullName.trim());
        toast.success('Developer profile and name-based avatar saved to Supabase.', 'Profile Saved');
      } else {
        toast.success('Developer profile updated locally.', 'Profile Saved');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile in Supabase.', 'Save Error');
    }
  };

  const handleTestConnection = async () => {
    const activeKey = getActiveAnonKey();
    if (!activeKey) {
      toast.error(
        'No Supabase Anon Key detected. Set VITE_SUPABASE_PUBLISHABLE_KEY or enter your key below.',
        'Connection Check'
      );
      return;
    }

    setVerifying(true);
    try {
      const result = await verifySupabaseKey(activeKey, supabaseUrl);
      if (result.valid) {
        setGoogleStatus(Boolean(result.googleAuthEnabled));
        if (result.googleAuthEnabled) {
          toast.success(
            'Supabase connection active and Google OAuth is enabled in Supabase!',
            'Backend Verified'
          );
        } else {
          toast.warning(
            'Supabase connected! Note: Google OAuth provider is not yet toggled on in Supabase dashboard.',
            'Google OAuth Pending'
          );
        }
      } else {
        toast.error(
          result.error || 'Failed to authenticate with Supabase using this key.',
          'Connection Failed'
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error pinging Supabase.', 'Verification Error');
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveAnonKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anonKeyInput.trim() || anonKeyInput.trim().length < 10) {
      toast.error('Please enter a valid Supabase anon/public key (JWT token).', 'Invalid Key');
      return;
    }

    setVerifying(true);
    try {
      const result = await verifySupabaseKey(anonKeyInput.trim(), supabaseUrl);
      if (!result.valid) {
        toast.error(
          result.error || 'Verification failed: Supabase rejected this API key.',
          'Key Invalid'
        );
        return;
      }

      setCustomAnonKey(anonKeyInput.trim());
      setStoredKey(anonKeyInput.trim());
      await refreshSession();
      setGoogleStatus(Boolean(result.googleAuthEnabled));
      toast.success(
        'Supabase Anon Key verified and connected. Real authentication is now active!',
        'Connected'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify key with Supabase.', 'Verification Error');
    } finally {
      setVerifying(false);
    }
  };

  const handleClearAnonKey = async () => {
    clearCustomAnonKey();
    setStoredKey('');
    setAnonKeyInput('');
    setGoogleStatus(null);
    await refreshSession();
    toast.info('Custom Supabase key cleared.', 'Key Removed');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Account & System Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage your developer profile, Supabase project connection, and security preferences.
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Developer Profile</CardTitle>
          <CardDescription>Your developer identity across Optic services.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Avatar & Identity Banner */}
          <div className="flex items-center gap-4 p-3.5 mb-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <img
              src={getUserAvatarUrl(user ? { ...user, fullName, name: fullName } : { fullName, name: fullName })}
              alt="Developer Avatar"
              className="w-12 h-12 rounded-xl object-cover border border-zinc-700/80 bg-zinc-800 shadow-md"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white font-sans">
                  {fullName || 'Optic Developer'}
                </span>
                <Badge variant="outline" size="sm">
                  DiceBear Notionists
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Generated deterministically from your name (<code className="font-mono text-zinc-300">{fullName || 'Optic Developer'}</code>) and stored in Supabase.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
                leftIcon={<User size={16} />}
              />
              <Input
                label="Account Email"
                value={user?.email || profile?.email || 'Not signed in'}
                disabled
                leftIcon={<Mail size={16} />}
                hint={user ? 'Managed via Supabase Auth' : 'Sign in to link email'}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500 font-mono">
                User ID: {user?.id || 'No active session'}
              </span>
              <Button type="submit" variant="primary" size="sm">
                {saved ? 'Saved Successfully' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Supabase Connection Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm">Supabase Infrastructure</CardTitle>
              <CardDescription>
                Backend database & authentication cluster configuration
              </CardDescription>
            </div>
            <Badge variant={isSupabaseConfigured ? 'success' : 'error'} dot>
              {isSupabaseConfigured ? 'Connected & Active' : 'Missing Publishable Key'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-zinc-400">Project Reference:</span>
            <span className="text-zinc-100 font-bold">dsrvkqutqxuvmfhbcuvy</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-zinc-400">Supabase URL:</span>
            <span className="text-sky-400 select-all break-all">{supabaseUrl}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-zinc-400">Auth Status:</span>
            <span className={isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              {isSupabaseConfigured
                ? 'Ready for Real OAuth & Password Authentication'
                : 'Authentication Offline (Anon Key Required)'}
            </span>
          </div>

          {/* Test connection action */}
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={verifying}
              onClick={handleTestConnection}
              icon={<RefreshCw size={13} />}
            >
              Test Supabase Connection
            </Button>

            <a
              href="https://supabase.com/dashboard/project/dsrvkqutqxuvmfhbcuvy/auth/providers"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-sans"
            >
              <span>Supabase Auth Providers</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Manual Anon Key Configuration form */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={15} className="text-sky-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Supabase Anon / Publishable Key
                </span>
              </div>
              {storedKey && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  Custom key loaded
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              If <code className="text-zinc-300 font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> is not yet set in your environment variables, paste your project Anon Key below to activate real Google Login and Supabase Auth immediately.
            </p>

            <form onSubmit={handleSaveAnonKey} className="space-y-3">
              <div className="relative">
                <input
                  type="password"
                  value={anonKeyInput}
                  onChange={(e) => setAnonKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={verifying}
                    icon={<ShieldCheck size={14} />}
                  >
                    Connect Anon Key
                  </Button>
                  {storedKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAnonKey}
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                      icon={<Trash2 size={13} />}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <a
                  href="https://supabase.com/dashboard/project/dsrvkqutqxuvmfhbcuvy/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  <span>Get Anon key from Supabase Dashboard</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Cloudflare R2 Object Storage Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Object Storage Engine</CardTitle>
          <CardDescription>Cloudflare R2 storage credentials status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-400 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">Cloudflare R2 Adapter:</span>
              <Badge variant="outline">Server-side secrets required</Badge>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              To enable direct-to-bucket signed uploads, supply{' '}
              <code className="text-zinc-300 font-mono">R2_ACCESS_KEY_ID</code>,{' '}
              <code className="text-zinc-300 font-mono">R2_SECRET_ACCESS_KEY</code>, and{' '}
              <code className="text-zinc-300 font-mono">R2_BUCKET_NAME</code> in your Project
              Environment Variables.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
