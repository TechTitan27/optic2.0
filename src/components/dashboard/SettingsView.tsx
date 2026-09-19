import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, Key, Moon, Check, Terminal, ExternalLink } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, profile, isSupabaseConfigured, supabaseUrl } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || 'Alex Rivera');
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
          <CardDescription>Your public identity across Optic services.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User size={16} />}
              />
              <Input
                label="Account Email"
                value={user?.email || profile?.email || 'developer@optic.doy.best'}
                disabled
                leftIcon={<Mail size={16} />}
                hint="Managed via Supabase Auth"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500 font-mono">
                User ID: {user?.id || 'usr_dev_primary'}
              </span>
              <Button type="submit" variant="primary" size="sm">
                {saved ? 'Saved Successfully' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Supabase Connection Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Supabase Infrastructure</CardTitle>
              <CardDescription>Backend database & authentication cluster reference</CardDescription>
            </div>
            <Badge variant={isSupabaseConfigured ? 'success' : 'info'} dot>
              {isSupabaseConfigured ? 'Connected' : 'Project Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Project Reference:</span>
            <span className="text-zinc-100 font-bold">dsrvkqutqxuvmfhbcuvy</span>
          </div>
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Supabase URL:</span>
            <span className="text-sky-400 select-all">{supabaseUrl}</span>
          </div>
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Cross-Subdomain SSO:</span>
            <span className="text-emerald-400">Enabled (optic.doy.best)</span>
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
              To enable direct-to-bucket signed uploads, supply <code className="text-zinc-300 font-mono">R2_ACCESS_KEY_ID</code>, <code className="text-zinc-300 font-mono">R2_SECRET_ACCESS_KEY</code>, and <code className="text-zinc-300 font-mono">R2_BUCKET_NAME</code> in your Vercel Project Environment Variables.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
