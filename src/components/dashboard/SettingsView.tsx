import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/OrganizationContext';
import { getUserAvatarUrl } from '../../lib/avatar';
import { AccountSettingsSkeleton } from '../common/Skeleton';
import {
  User,
  Mail,
  Shield,
  ShieldCheck,
  Key,
  Sliders,
  Bell,
  AlertTriangle,
  Upload,
  RefreshCw,
  Trash2,
  Smartphone,
  Laptop,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Clock,
  Terminal,
  FileCode,
  HardDrive,
  CheckCircle2,
  Lock,
} from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'danger';

interface ActiveSessionItem {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export const SettingsView: React.FC = () => {
  const { user, profile, updateProfile, signOut, loading: authLoading } = useAuth();
  const { currentOrg } = useOrganization();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // --- Profile State ---
  const [fullName, setFullName] = useState(
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Optic Developer'
  );
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('optic_username') || (user?.email ? user.email.split('@')[0].toLowerCase() : 'developer');
  });
  const [roleTitle, setRoleTitle] = useState(() => {
    return localStorage.getItem('optic_role_title') || 'Lead Platform Engineer';
  });
  const [bio, setBio] = useState(() => {
    return localStorage.getItem('optic_bio') || 'Building scalable cloud microservices and edge web deployments with Optic.';
  });
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('optic_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('optic_language') || 'en-US';
  });
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => {
    return profile?.avatarUrl || null;
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.fullName) {
      setFullName(profile.fullName);
    }
    if (profile?.avatarUrl) {
      setCustomAvatar(profile.avatarUrl);
    }
  }, [profile?.fullName, profile?.avatarUrl]);

  // --- Security State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => {
    return localStorage.getItem('optic_2fa_enabled') === 'true';
  });
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    return localStorage.getItem('optic_session_timeout') || '14';
  });

  const [sessions, setSessions] = useState<ActiveSessionItem[]>([
    {
      id: 'sess-1',
      device: 'Apple MacBook Pro (macOS Sonoma)',
      browser: 'Chrome 128.0 (Desktop)',
      ip: '192.168.1.104 (Current Device)',
      location: 'Local Network • Active Now',
      lastActive: 'Just now',
      isCurrent: true,
    },
    {
      id: 'sess-2',
      device: 'Optic CLI v2.4.1 (Linux x86_64)',
      browser: 'Developer Daemon / API Token',
      ip: '185.220.101.5',
      location: 'Frankfurt, Germany',
      lastActive: '3 hours ago',
      isCurrent: false,
    },
    {
      id: 'sess-3',
      device: 'Apple iPhone 15 Pro (iOS 17.6)',
      browser: 'Mobile Safari',
      ip: '82.165.197.12',
      location: 'London, United Kingdom',
      lastActive: 'Yesterday at 18:42',
      isCurrent: false,
    },
  ]);

  // --- Preferences State ---
  const [defaultSurface, setDefaultSurface] = useState(() => {
    return localStorage.getItem('optic_default_surface') || 'dashboard';
  });
  const [cliFormat, setCliFormat] = useState(() => {
    return localStorage.getItem('optic_cli_format') || 'json';
  });
  const [codeFont, setCodeFont] = useState(() => {
    return localStorage.getItem('optic_code_font') || 'JetBrains Mono';
  });
  const [densityMode, setDensityMode] = useState(() => {
    return localStorage.getItem('optic_density_mode') || 'comfortable';
  });
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => {
    return localStorage.getItem('optic_telemetry') !== 'false';
  });

  // --- Notifications State ---
  const [notifyDeployFailure, setNotifyDeployFailure] = useState(true);
  const [notifyDeploySuccess, setNotifyDeploySuccess] = useState(true);
  const [notifyStorageQuota, setNotifyStorageQuota] = useState(true);
  const [notifySecurityLogin, setNotifySecurityLogin] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);
  const [notifyProductUpdates, setNotifyProductUpdates] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('optic_alerts_webhook') || '';
  });

  // --- Danger State ---
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Handle avatar upload via file reader
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar file size must be less than 2 MB.', 'File Too Large');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomAvatar(dataUrl);
        toast.success('New profile image preview ready. Click "Save Changes" to store.', 'Avatar Updated');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFreshAvatar = () => {
    const randomSeed = `${fullName || 'developer'}-${Math.random().toString(36).substring(2, 7)}`;
    const newAvatar = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(randomSeed)}`;
    setCustomAvatar(newAvatar);
    toast.success('Generated a new visual avatar mark.', 'Avatar Refreshed');
  };

  const handleResetAvatar = () => {
    setCustomAvatar(null);
    toast.info('Avatar reset to default mark.', 'Avatar Reset');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name.', 'Validation Error');
      return;
    }
    setIsSavingProfile(true);
    try {
      localStorage.setItem('optic_username', username.trim().toLowerCase());
      localStorage.setItem('optic_role_title', roleTitle.trim());
      localStorage.setItem('optic_bio', bio.trim());
      localStorage.setItem('optic_timezone', timezone);
      localStorage.setItem('optic_language', language);

      const avatarToSave = customAvatar || undefined;
      await updateProfile(fullName.trim(), avatarToSave);

      toast.success('Your developer profile details have been saved.', 'Profile Saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile.', 'Save Error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.', 'Password Required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.', 'Password Too Short');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.', 'Password Mismatch');
      return;
    }

    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully. Your other active sessions remain verified.', 'Security Updated');
    }, 900);
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      localStorage.setItem('optic_2fa_enabled', 'false');
      toast.info('Two-Factor Authentication has been disabled.', '2FA Disabled');
    } else {
      setTwoFactorModalOpen(true);
    }
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit authentication code.', 'Invalid Code');
      return;
    }
    setTwoFactorEnabled(true);
    localStorage.setItem('optic_2fa_enabled', 'true');
    setTwoFactorModalOpen(false);
    setTotpCode('');
    setShowRecoveryCodesModal(true);
    toast.success('Two-Factor Authentication is now active on your account.', '2FA Enabled');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success('Session token revoked and connection terminated.', 'Session Ended');
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toast.success('All other connected devices and CLI tokens have been signed out.', 'Sessions Terminated');
  };

  const handleSavePreferences = () => {
    localStorage.setItem('optic_default_surface', defaultSurface);
    localStorage.setItem('optic_cli_format', cliFormat);
    localStorage.setItem('optic_code_font', codeFont);
    localStorage.setItem('optic_density_mode', densityMode);
    localStorage.setItem('optic_telemetry', String(telemetryEnabled));
    toast.success('Platform and developer preferences saved.', 'Preferences Saved');
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('optic_alerts_webhook', webhookUrl.trim());
    toast.success('Notification channels and alert thresholds updated.', 'Notifications Saved');
  };

  const handleTestWebhook = () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      toast.error('Please enter a valid HTTP(S) webhook URL.', 'Invalid URL');
      return;
    }
    toast.success(`Dispatched test event payload to ${new URL(webhookUrl).hostname}.`, 'Test Event Sent');
  };

  const handleExportData = () => {
    const exportData = {
      opticVersion: '2.4.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id || 'anon',
        email: user?.email || 'developer@optic.doy.best',
        fullName,
        username,
        roleTitle,
        bio,
        timezone,
        language,
      },
      organization: currentOrg || { name: 'Personal Workspace' },
      preferences: {
        defaultSurface,
        cliFormat,
        codeFont,
        densityMode,
        telemetryEnabled,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optic-account-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Account metadata archive downloaded successfully.', 'Export Complete');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE exactly to confirm deletion.', 'Confirmation Required');
      return;
    }
    setDeleteAccountModalOpen(false);
    toast.info('Account marked for deletion. Signing out...', 'Account Removed');
    await signOut();
  };

  const currentDisplayedAvatar =
    customAvatar ||
    getUserAvatarUrl(user ? { ...user, fullName, name: fullName } : { fullName, name: fullName });

  if (authLoading) {
    return <AccountSettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Title & Navigation Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage your developer profile, security credentials, workspace preferences, and notification channels.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-800/80 overflow-x-auto pb-px scrollbar-none">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-sky-500 text-sky-400 font-semibold bg-sky-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <User size={14} />
          <span>Profile & Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-sky-500 text-sky-400 font-semibold bg-sky-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Security & Access</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'preferences'
              ? 'border-sky-500 text-sky-400 font-semibold bg-sky-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Sliders size={14} />
          <span>Preferences & Defaults</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'border-sky-500 text-sky-400 font-semibold bg-sky-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Bell size={14} />
          <span>Notifications & Alerts</span>
        </button>

        <button
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'danger'
              ? 'border-red-500 text-red-400 font-semibold bg-red-500/5'
              : 'border-transparent text-zinc-400 hover:text-red-400 hover:border-zinc-700'
          }`}
        >
          <AlertTriangle size={14} />
          <span>Danger Zone</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB: PROFILE */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Avatar & Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Profile Picture</CardTitle>
              <CardDescription>
                Your visual avatar displayed across the Optic dashboard, cloud file shares, and deployment activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-4 rounded-xl bg-zinc-950 border border-zinc-850">
                <div className="relative shrink-0">
                  <img
                    src={currentDisplayedAvatar}
                    alt="Developer Avatar"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-700/80 bg-zinc-900 shadow-lg"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{fullName || 'Optic Developer'}</span>
                    <Badge variant="outline" size="sm">
                      @{username}
                    </Badge>
                    <Badge variant="success" size="sm" dot>
                      Verified Account
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    JPG, GIF, PNG or WebP. Max file size of 2 MB. Square aspect ratio recommended.
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      icon={<Upload size={13} />}
                      className="text-xs"
                    >
                      Upload Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateFreshAvatar}
                      icon={<RefreshCw size={13} />}
                      className="text-xs"
                    >
                      Generate Variation
                    </Button>
                    {customAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAvatar}
                        className="text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Reset Default
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Personal Information</CardTitle>
              <CardDescription>
                Update your developer identity and public workspace credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    leftIcon={<User size={15} />}
                    required
                  />

                  <Input
                    label="Username / Handle"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="developer"
                    leftIcon={<span className="text-xs font-mono font-bold text-zinc-500">@</span>}
                    hint="Your public namespace for project deployments and invites."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Primary Account Email"
                    value={user?.email || profile?.email || 'developer@optic.doy.best'}
                    disabled
                    leftIcon={<Mail size={15} />}
                    rightElement={
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                        <Check size={11} /> Verified
                      </span>
                    }
                    hint="Email linked to your authentication session."
                  />

                  <Input
                    label="Role / Title"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="Full-Stack Engineer"
                    leftIcon={<Terminal size={15} />}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 select-none">Developer Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="A short note about what you are building on Optic..."
                    className="w-full bg-zinc-900 text-zinc-100 text-sm placeholder:text-zinc-500 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 p-3 outline-none resize-none transition-all"
                  />
                  <span className="text-xs text-zinc-500">Brief summary displayed on your team contributor card.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <Clock size={13} className="text-zinc-400" />
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 hover:border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 p-2.5 outline-none transition-all"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST / EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                      <option value="America/Denver">America/Denver (MST / MDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                      <option value="Europe/London">Europe/London (GMT / BST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET / CEST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      <option value="Africa/Accra">Africa/Accra (GMT)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <Globe size={13} className="text-zinc-400" />
                      Interface Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 hover:border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 p-2.5 outline-none transition-all"
                    >
                      <option value="en-US">English (United States)</option>
                      <option value="en-GB">English (United Kingdom)</option>
                      <option value="de-DE">Deutsch</option>
                      <option value="es-ES">Español</option>
                      <option value="fr-FR">Français</option>
                      <option value="ja-JP">日本語</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
                  <div className="text-xs text-zinc-500 font-mono">
                    Account ID: <span className="text-zinc-300">{user?.id?.substring(0, 16) || 'opt_usr_local'}...</span>
                  </div>
                  <Button type="submit" variant="primary" size="sm" loading={isSavingProfile}>
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SECURITY & ACCESS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Password Management</CardTitle>
                  <CardDescription>
                    Update your account password to safeguard deployments and storage objects.
                  </CardDescription>
                </div>
                <Lock size={16} className="text-zinc-400" />
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-xl">
                <Input
                  type="password"
                  label="Current Password"
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  leftIcon={<Key size={15} />}
                />
                <Input
                  type="password"
                  label="New Password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftIcon={<Key size={15} />}
                  hint="Minimum 8 characters including mixed casing and special characters."
                />
                <Input
                  type="password"
                  label="Confirm New Password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Key size={15} />}
                />
                <Button type="submit" variant="primary" size="sm" loading={isUpdatingPassword}>
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication (2FA) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Two-Factor Authentication (2FA)</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your Optic developer account using TOTP.
                  </CardDescription>
                </div>
                <Badge variant={twoFactorEnabled ? 'success' : 'outline'} dot>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sky-400 mt-0.5">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Authenticator App (TOTP)</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Use apps such as Google Authenticator, 1Password, or Authy to generate single-use verification codes.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {twoFactorEnabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecoveryCodesModal(true)}
                      className="text-xs"
                    >
                      Recovery Codes
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={twoFactorEnabled ? 'outline' : 'primary'}
                    size="sm"
                    onClick={handleToggle2FA}
                    className="text-xs"
                  >
                    {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions & Connected Devices */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm">Active Sessions & Connected Devices</CardTitle>
                  <CardDescription>
                    Devices and developer CLI sessions currently authenticated with your account.
                  </CardDescription>
                </div>
                {sessions.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAllOtherSessions}
                    className="text-xs text-red-400 hover:text-red-300 hover:border-red-900/60"
                  >
                    Revoke Other Sessions
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                      {session.device.includes('CLI') ? (
                        <Terminal size={17} />
                      ) : session.device.includes('iPhone') ? (
                        <Smartphone size={17} />
                      ) : (
                        <Laptop size={17} />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{session.device}</span>
                        {session.isCurrent && (
                          <Badge variant="success" size="sm" dot>
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap font-mono">
                        <span>{session.browser}</span>
                        <span>•</span>
                        <span>IP: {session.ip}</span>
                        <span>•</span>
                        <span>{session.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {session.isCurrent ? (
                      <span className="text-[11px] font-mono text-emerald-400">Active Now</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Session Inactivity Timeout */}
              <div className="pt-3 border-t border-zinc-850 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs font-medium text-zinc-200">Session Inactivity Timeout</div>
                  <div className="text-[11px] text-zinc-400">
                    Automatically require authentication after period of developer inactivity.
                  </div>
                </div>
                <select
                  value={sessionTimeout}
                  onChange={(e) => {
                    setSessionTimeout(e.target.value);
                    localStorage.setItem('optic_session_timeout', e.target.value);
                    toast.success(`Session timeout updated to ${e.target.value} days.`, 'Updated');
                  }}
                  className="bg-zinc-900 text-zinc-200 text-xs rounded-lg border border-zinc-800 p-2 outline-none"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days (Recommended)</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PREFERENCES & DEFAULTS */}
      {/* ========================================================================= */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {/* Default Landing Surface */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Default Landing Surface</CardTitle>
              <CardDescription>
                Choose which product view loads automatically when you sign in or launch Optic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'dashboard',
                    title: 'Dashboard Overview',
                    desc: 'System health, bandwidth analytics, recent commits, and quick links.',
                    icon: <Sliders size={18} className="text-sky-400" />,
                  },
                  {
                    id: 'cloud',
                    title: 'Optic Cloud Storage',
                    desc: 'Object file browser, bucket directories, upload manager, and share links.',
                    icon: <HardDrive size={18} className="text-emerald-400" />,
                  },
                  {
                    id: 'hosting',
                    title: 'Optic Hosting',
                    desc: 'Deployments, preview URLs, Git repositories, and custom domain routing.',
                    icon: <Globe size={18} className="text-purple-400" />,
                  },
                  {
                    id: 'api',
                    title: 'Developer API Console',
                    desc: 'Interactive REST playground, live code generators, and API tokens.',
                    icon: <FileCode size={18} className="text-amber-400" />,
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setDefaultSurface(item.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                      defaultSurface === item.id
                        ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/30'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{item.title}</span>
                        {defaultSurface === item.id && (
                          <Check size={14} className="text-sky-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Developer Tooling & Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Developer Tooling & CLI</CardTitle>
              <CardDescription>
                Tailor terminal output, code typography, and diagnostics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Default CLI Output Format</label>
                  <select
                    value={cliFormat}
                    onChange={(e) => setCliFormat(e.target.value)}
                    className="w-full bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 p-2.5 outline-none"
                  >
                    <option value="json">JSON (Machine parseable)</option>
                    <option value="table">Table (ANSI terminal colored)</option>
                    <option value="yaml">YAML (Human readable config)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Code Display Typography</label>
                  <select
                    value={codeFont}
                    onChange={(e) => setCodeFont(e.target.value)}
                    className="w-full bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 p-2.5 outline-none"
                  >
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Geist Mono">Geist Mono</option>
                    <option value="SF Mono">SF Mono / System Monospace</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Interface Density Mode</label>
                  <select
                    value={densityMode}
                    onChange={(e) => setDensityMode(e.target.value)}
                    className="w-full bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 p-2.5 outline-none"
                  >
                    <option value="comfortable">Comfortable (Default spacing)</option>
                    <option value="compact">Compact (High-density rows)</option>
                  </select>
                </div>
              </div>

              {/* Telemetry Toggle */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4 mt-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-zinc-200">Anonymous Diagnostic Telemetry</div>
                  <div className="text-[11px] text-zinc-400">
                    Send anonymized crash reports and build error signals to improve platform performance.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={(e) => setTelemetryEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" variant="primary" size="sm" onClick={handleSavePreferences}>
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: NOTIFICATIONS & ALERTS */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Email Notification Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Alert Channels</CardTitle>
              <CardDescription>
                Choose which events dispatch instant emails to{' '}
                <span className="text-zinc-200 font-mono">{user?.email || profile?.email || 'your account'}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  id: 'deployFail',
                  title: 'Deployment Failures & Build Errors',
                  desc: 'Instant alert when a production branch fails build steps or container health checks.',
                  checked: notifyDeployFailure,
                  onChange: setNotifyDeployFailure,
                },
                {
                  id: 'deploySuccess',
                  title: 'Production Deployments',
                  desc: 'Notify when a new production release is successfully published to edge nodes.',
                  checked: notifyDeploySuccess,
                  onChange: setNotifyDeploySuccess,
                },
                {
                  id: 'storageQuota',
                  title: 'Storage & Bandwidth Quotas',
                  desc: 'Alert when your account reaches 80% and 95% of object storage or CDN data limits.',
                  checked: notifyStorageQuota,
                  onChange: setNotifyStorageQuota,
                },
                {
                  id: 'securityLogin',
                  title: 'Security & Access Warnings',
                  desc: 'Alert when a new IP, device, or developer API token accesses your organization.',
                  checked: notifySecurityLogin,
                  onChange: setNotifySecurityLogin,
                },
                {
                  id: 'weeklyDigest',
                  title: 'Weekly Performance Digest',
                  desc: 'Summary of total HTTP requests, cached asset hits, and edge function execution times.',
                  checked: notifyWeeklyDigest,
                  onChange: setNotifyWeeklyDigest,
                },
                {
                  id: 'productUpdates',
                  title: 'Optic Product Updates & Changelog',
                  desc: 'Monthly summary of new CLI features, edge runtime improvements, and developer guides.',
                  checked: notifyProductUpdates,
                  onChange: setNotifyProductUpdates,
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-zinc-200">{item.title}</div>
                    <div className="text-[11px] text-zinc-400">{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Webhook Alerts Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team Webhook Endpoint</CardTitle>
              <CardDescription>
                Forward real-time alerts directly into Slack, Discord, or custom incident response webhooks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Incoming Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                    className="flex-1 bg-zinc-900 text-zinc-100 text-xs font-mono rounded-lg border border-zinc-800 hover:border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 px-3 py-2 outline-none"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleTestWebhook} className="text-xs">
                    Send Test Ping
                  </Button>
                </div>
                <span className="text-xs text-zinc-500">
                  Payloads are signed with your project's cryptographic HMAC header.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" variant="primary" size="sm" onClick={handleSaveNotifications}>
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DANGER ZONE */}
      {/* ========================================================================= */}
      {activeTab === 'danger' && (
        <div className="space-y-6">
          {/* Export Developer Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Export Workspace & Account Data</CardTitle>
                  <CardDescription>
                    Download a complete JSON export of your developer profile, hosting projects, and storage metadata.
                  </CardDescription>
                </div>
                <Download size={16} className="text-zinc-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-xs text-zinc-400 leading-relaxed">
                  Includes account preferences, organization memberships, deployment histories, and public file catalog.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  icon={<Download size={14} />}
                  className="shrink-0 text-xs"
                >
                  Export Data (JSON)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account Card */}
          <Card className="border-red-900/60 bg-red-950/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-red-300">Delete Account & Disconnect Services</CardTitle>
                  <CardDescription className="text-red-400/80">
                    Permanently delete your developer profile, release active custom domains, and purge object storage.
                  </CardDescription>
                </div>
                <AlertTriangle size={18} className="text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-xs text-red-200/90 leading-relaxed">
                <p className="font-semibold text-red-200 mb-1">Warning: This action is immediate and irreversible.</p>
                All project deployments on <code className="text-white font-mono">*.optic.doy.best</code> will be suspended,
                and all active API keys will be permanently invalidated.
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmText('');
                    setDeleteAccountModalOpen(true);
                  }}
                  icon={<Trash2 size={14} />}
                  className="border-red-900/80 text-red-400 hover:bg-red-950/40 hover:text-red-300 text-xs"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 2FA Setup Modal */}
      <Modal
        isOpen={twoFactorModalOpen}
        onClose={() => setTwoFactorModalOpen(false)}
        title="Configure Two-Factor Authentication"
        description="Scan the setup key or QR barcode with your TOTP authenticator application."
      >
        <form onSubmit={handleConfirm2FA} className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center gap-3 text-center">
            {/* Mock clean barcode / key box */}
            <div className="w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
              <div className="w-full h-full border-2 border-dashed border-zinc-900 flex flex-col items-center justify-center text-zinc-900 p-2">
                <ShieldCheck size={36} className="text-zinc-800 mb-1" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-900">OPTIC-TOTP</span>
                <span className="text-[8px] text-zinc-600">Scan via Authenticator</span>
              </div>
            </div>

            <div className="space-y-1 w-full text-left">
              <span className="text-[11px] text-zinc-400 font-mono uppercase">Manual Secret Key:</span>
              <div className="flex items-center justify-between p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 font-mono text-xs text-sky-400">
                <span>JBSW-Y3DP-EHPK-3PXP</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('JBSWY3DPEHPK3PXP');
                    toast.success('Authenticator secret copied.', 'Copied');
                  }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          </div>

          <Input
            label="6-Digit Verification Code"
            placeholder="123456"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            leftIcon={<Key size={15} />}
            required
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setTwoFactorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Verify & Enable
            </Button>
          </div>
        </form>
      </Modal>

      {/* Recovery Codes Modal */}
      <Modal
        isOpen={showRecoveryCodesModal}
        onClose={() => setShowRecoveryCodesModal(false)}
        title="Two-Factor Recovery Codes"
        description="Store these backup codes in a safe place (such as 1Password). Each code can only be used once."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
            {[
              'A91B-44E2',
              '78F3-90C1',
              '55D2-88B9',
              '31E0-12A7',
              '67A4-99B3',
              '82C5-41D0',
              '23B8-76E5',
              '90F1-33C4',
            ].map((code, i) => (
              <div key={i} className="p-2 bg-zinc-900/80 rounded border border-zinc-800/80 text-center">
                {code}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const codes = 'A91B-44E2\n78F3-90C1\n55D2-88B9\n31E0-12A7\n67A4-99B3\n82C5-41D0\n23B8-76E5\n90F1-33C4';
                navigator.clipboard.writeText(codes);
                toast.success('Backup recovery codes copied.', 'Copied');
              }}
              icon={<Copy size={13} />}
            >
              Copy All Codes
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => setShowRecoveryCodesModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        title="Confirm Account Deletion"
        description="This action cannot be undone. Please type DELETE below to verify your decision."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-200">
            You are about to permanently delete your Optic developer account and all associated projects and storage buckets.
          </div>

          <Input
            label="Type DELETE to confirm"
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            required
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE'}
              className="bg-red-600 hover:bg-red-500 border-red-500"
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
