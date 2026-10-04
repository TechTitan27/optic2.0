import React, { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileCode,
  FileArchive,
  FileQuestion,
  Clock,
  User,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  HardDrive,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Unlock,
  Key,
  Globe,
  Settings,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Share2,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { SurfaceType, SharedFileData } from '../../types';
import { getShareTokenFromPath } from '../../lib/domainNavigation';
import { storageService } from '../../lib/storageService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PublicShareSkeleton } from '../common/Skeleton';
import { DashboardLayout } from '../dashboard/DashboardLayout';
import { OpticLogo } from '../brand/OpticLogo';
import { OpticFooter } from '../common/OpticFooter';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface PublicSharePageProps {
  path: string;
  onNavigate?: (surface: SurfaceType, path?: string) => void;
}

// Helper to format byte sizes
function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Detect category from mimeType or filename
type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

function getFileCategory(mimeType: string = '', filename: string = ''): FileCategory {
  const mime = mimeType.toLowerCase();
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
  ) {
    return 'image';
  }
  if (
    mime.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)
  ) {
    return 'video';
  }
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)
  ) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('xml') ||
    [
      'txt',
      'md',
      'markdown',
      'json',
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'html',
      'css',
      'scss',
      'yaml',
      'yml',
      'xml',
      'csv',
      'log',
      'env',
      'sh',
      'sql',
      'rust',
      'go',
      'c',
      'cpp',
      'h',
    ].includes(ext)
  ) {
    return 'text';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('gzip') ||
    ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)
  ) {
    return 'archive';
  }
  return 'other';
}

function getFileFriendlyType(category: FileCategory, ext: string = '', mimeType: string = ''): string {
  if (category === 'image') return `${ext.toUpperCase() || 'Image'} Image`;
  if (category === 'video') return `${ext.toUpperCase() || 'Video'} Media`;
  if (category === 'audio') return `${ext.toUpperCase() || 'Audio'} Recording`;
  if (category === 'pdf') return 'PDF Document';
  if (category === 'text') return `${ext.toUpperCase() || 'Text'} Code/File`;
  if (category === 'archive') return `${ext.toUpperCase() || 'Zip'} Archive`;
  return ext ? `${ext.toUpperCase()} File` : mimeType || 'Binary File';
}

export function PublicSharePage({ path, onNavigate }: PublicSharePageProps) {
  const { user } = useAuth();
  const toast = useToast();

  const token =
    getShareTokenFromPath(path) ||
    (typeof window !== 'undefined' ? getShareTokenFromPath(window.location.pathname) : null) ||
    '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedFileData | null>(null);
  const [errorState, setErrorState] = useState<'not_found' | 'expired' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Password Unlock state for visitors
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Settings Modal state (for owner to change access: public vs password)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [accessLevelSetting, setAccessLevelSetting] = useState<'public' | 'password'>('public');
  const [passwordSetting, setPasswordSetting] = useState('');
  const [showPasswordSetting, setShowPasswordSetting] = useState(false);
  const [expirationSetting, setExpirationSetting] = useState<'none' | '24' | '168' | '720'>('none');
  const [savingSettings, setSavingSettings] = useState(false);

  // Text preview content (for text/code files)
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Image zoom state
  const [zoomLevel, setZoomLevel] = useState(1);

  // Load shared file data
  const loadSharedFile = async (pwd?: string) => {
    if (!token) {
      setErrorState('not_found');
      setErrorMessage('No share token provided in the URL.');
      setLoading(false);
      return;
    }

    try {
      if (!pwd) {
        setLoading(true);
      }
      setErrorState(null);
      setUnlockError(null);

      // Check session storage for previously entered password if not provided
      const sessionPwd =
        pwd ||
        (typeof sessionStorage !== 'undefined'
          ? sessionStorage.getItem(`optic_share_pwd_${token}`) || undefined
          : undefined);

      const result = await storageService.getSharedFile(token, sessionPwd);

      if (result.expired) {
        setErrorState('expired');
        setErrorMessage(result.error || 'This share link has expired.');
      } else if (result.notFound) {
        setErrorState('not_found');
        setErrorMessage(result.error || 'File not found or share link is invalid.');
      } else if (!result.success && !result.file) {
        setErrorState('error');
        setErrorMessage(result.error || 'Unable to load shared file.');
      } else {
        setData(result as SharedFileData);

        // If file requires password and unlock failed
        if (result.requiresPassword && !result.isUnlocked) {
          if (sessionPwd) {
            setUnlockError('Incorrect password. Please enter the valid access password.');
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem(`optic_share_pwd_${token}`);
            }
          }
        } else if (sessionPwd && result.isUnlocked) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(`optic_share_pwd_${token}`, sessionPwd);
          }
        }

        // Initialize settings modal defaults from loaded data
        if (result.share?.accessLevel) {
          setAccessLevelSetting(result.share.accessLevel);
        }

        // If text file and unlocked, optionally fetch content preview
        if (result.isUnlocked && result.file) {
          const category = getFileCategory(result.file.mimeType, result.file.name);
          if (category === 'text' && result.previewUrl && result.file.sizeBytes < 1024 * 1024) {
            setLoadingText(true);
            fetch(result.previewUrl)
              .then((res) => (res.ok ? res.text() : ''))
              .then((txt) => {
                setTextContent(txt);
              })
              .catch(() => {})
              .finally(() => {
                setLoadingText(false);
              });
          }
        }
      }
    } catch (err: any) {
      setErrorState('error');
      setErrorMessage(err?.message || 'Failed to retrieve shared file.');
    } finally {
      setLoading(false);
      setUnlocking(false);
    }
  };

  useEffect(() => {
    loadSharedFile();
  }, [token, user?.id]);

  // Handle password submission to unlock file
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setUnlockError('Please enter the access password.');
      return;
    }

    setUnlocking(true);
    setUnlockError(null);

    try {
      const result = await storageService.getSharedFile(token, passwordInput.trim());

      if (result.requiresPassword && !result.isUnlocked) {
        setUnlockError('Incorrect access password. Please try again.');
        toast.error('Incorrect password', 'Access Denied');
        setUnlocking(false);
        return;
      }

      if (result.isUnlocked && result.file) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`optic_share_pwd_${token}`, passwordInput.trim());
        }
        setData(result as SharedFileData);
        toast.success('File unlocked successfully!', 'Access Granted');

        // Fetch text preview if applicable
        const category = getFileCategory(result.file.mimeType, result.file.name);
        if (category === 'text' && result.previewUrl && result.file.sizeBytes < 1024 * 1024) {
          setLoadingText(true);
          fetch(result.previewUrl)
            .then((res) => (res.ok ? res.text() : ''))
            .then((txt) => setTextContent(txt))
            .catch(() => {})
            .finally(() => setLoadingText(false));
        }
      } else {
        setUnlockError(result.error || 'Failed to unlock file.');
      }
    } catch (err: any) {
      setUnlockError(err?.message || 'Failed to verify password.');
    } finally {
      setUnlocking(false);
    }
  };

  // Handle saving access settings (Public vs Password Protected)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.file) return;

    if (accessLevelSetting === 'password' && !passwordSetting.trim()) {
      toast.error('Please specify a password for password-protected access.', 'Missing Password');
      return;
    }

    setSavingSettings(true);
    try {
      const hours = expirationSetting === 'none' ? null : parseInt(expirationSetting, 10);
      const res = await storageService.updateShareSettings({
        token,
        fileId: data.file.id,
        accessLevel: accessLevelSetting,
        password: accessLevelSetting === 'password' ? passwordSetting.trim() : undefined,
        expiresInHours: hours,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to update share settings.');
      }

      toast.success(
        accessLevelSetting === 'password'
          ? 'File is now private and password protected.'
          : 'File is now accessible to anyone with the link.',
        'Access Settings Updated'
      );

      setSettingsModalOpen(false);
      // Reload file state
      loadSharedFile();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settings.', 'Error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Helper: Generate Random Password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasswordSetting(res);
    setShowPasswordSetting(true);
    toast.info('Secure random password generated.');
  };

  // Handle Download trigger
  const handleDownload = async () => {
    if (!data?.downloadUrl || !data.file) return;

    try {
      setDownloading(true);
      toast.info(`Starting download for ${data.file.name}...`);

      const anchor = document.createElement('a');
      anchor.href = data.downloadUrl;
      anchor.download = data.file.name;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => {
        setDownloading(false);
      }, 1200);
    } catch (err) {
      console.error('Download error:', err);
      window.open(data.downloadUrl, '_blank');
      setDownloading(false);
    }
  };

  // Copy public URL
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success('Share link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  // Copy text content
  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopiedText(true);
      toast.success('Code copied to clipboard.');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast.error('Unable to copy text.');
    }
  };

  const file = data?.file;
  const share = data?.share;
  const uploader = data?.uploader;
  const isOwner = Boolean(data?.isOwner || (user?.id && file?.userId && user.id === file.userId));
  const isPasswordProtected = Boolean(share?.accessLevel === 'password' || share?.hasPassword || data?.isProtected);
  const requiresUnlock = Boolean(data?.requiresPassword && !data?.isUnlocked);

  const category = file ? getFileCategory(file.mimeType, file.name) : 'other';
  const friendlyType = file ? getFileFriendlyType(category, file.extension, file.mimeType) : '';

  // Formatted date
  const formattedUploadDate = file?.createdAt
    ? new Date(file.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' · ' +
      new Date(file.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const formattedExpiry = share?.expiresAt
    ? new Date(share.expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  // =========================================================================
  // CORE INNER CONTENT (Rendered for both Logged In & Logged Out states)
  // =========================================================================
  const renderMainContent = () => {
    // 1. Loading State
    if (loading) {
      return (
        <div className="py-8 w-full max-w-5xl mx-auto">
          <PublicShareSkeleton />
        </div>
      );
    }

    // 2. Expired State
    if (errorState === 'expired') {
      return (
        <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 shadow-inner">
            <Clock size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            This Link Has Expired
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            The owner set an expiration limit for this share link. Please ask the owner to generate an updated access link.
          </p>
          <div className="pt-4 border-t border-zinc-800/80 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (user ? onNavigate?.('cloud', '/cloud') : onNavigate?.('main', '/'))}
              icon={<ArrowLeft size={13} />}
            >
              {user ? 'Back to Cloud Storage' : 'Return to Home'}
            </Button>
          </div>
        </div>
      );
    }

    // 3. Not Found State
    if (errorState === 'not_found') {
      return (
        <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-5 shadow-inner">
            <FileQuestion size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            File Not Found
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            This shared file does not exist, has been deleted from Cloud Storage, or the token in your URL is invalid.
          </p>
          <div className="pt-4 border-t border-zinc-800/80 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (user ? onNavigate?.('cloud', '/cloud') : onNavigate?.('main', '/'))}
              icon={<ArrowLeft size={13} />}
            >
              {user ? 'Back to Cloud Storage' : 'Go to Optic'}
            </Button>
          </div>
        </div>
      );
    }

    // 4. General Error State
    if (errorState === 'error') {
      return (
        <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-5 shadow-inner">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Unable to Access File
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            {errorMessage || 'A network error occurred while accessing this object.'}
          </p>
          <div className="pt-4 border-t border-zinc-800/80 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSharedFile()}
              icon={<RotateCcw size={13} />}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // 5. Password Protected / Locked State (Requires Password)
    if (requiresUnlock && file) {
      return (
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6">
            {/* Header Icon & Title */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Lock size={26} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Password Protected File
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                The owner of this file requires a password to view or download its contents.
              </p>
            </div>

            {/* Target File Overview Pill */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <Key size={18} className="text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span>•</span>
                  <span>Shared by {uploader?.name || 'Optic User'}</span>
                </div>
              </div>
            </div>

            {/* Unlock Form */}
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span>Access Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                  >
                    {showPasswordInput ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showPasswordInput ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInput ? 'text' : 'password'}
                    placeholder="Enter file password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono transition-all outline-none"
                  />
                </div>
              </div>

              {unlockError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={unlocking}
                className="w-full justify-center text-xs py-2.5 font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                icon={<Unlock size={14} />}
              >
                Unlock File
              </Button>
            </form>

            {/* Hint for owner / logged in user */}
            <div className="pt-4 border-t border-zinc-800/60 text-center text-xs text-zinc-500">
              {!user ? (
                <p>
                  Are you the owner of this file?{' '}
                  <button
                    onClick={() => onNavigate?.('login', '/login')}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    Sign in to Optic
                  </button>{' '}
                  to access without entering a password.
                </p>
              ) : (
                <p>
                  Signed in as <span className="font-mono text-zinc-300">{user.email}</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 6. Active Unlocked Shared File View
    if (file) {
      return (
        <div className="space-y-6 w-full max-w-5xl mx-auto">
          {/* Top File Summary & Actions Bar */}
          <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-300 shrink-0 shadow-inner">
                {category === 'image' && <ImageIcon size={24} className="text-cyan-400" />}
                {category === 'video' && <Film size={24} className="text-indigo-400" />}
                {category === 'audio' && <Music size={24} className="text-purple-400" />}
                {category === 'pdf' && <FileText size={24} className="text-red-400" />}
                {category === 'text' && <FileCode size={24} className="text-emerald-400" />}
                {category === 'archive' && <FileArchive size={24} className="text-amber-400" />}
                {category === 'other' && <HardDrive size={24} className="text-zinc-400" />}
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate select-all" title={file.name}>
                    {file.name}
                  </h1>

                  {/* Access Status Badge */}
                  {isPasswordProtected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      <Lock size={10} />
                      Password Protected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                      <Globe size={10} />
                      Anyone with link
                    </span>
                  )}

                  {/* Owner Badge */}
                  {isOwner && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                      <ShieldCheck size={11} className="text-purple-400" />
                      Owner
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span className="font-mono text-zinc-300 font-semibold">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <span>•</span>
                  <span>{friendlyType}</span>
                  {formattedExpiry && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400 flex items-center gap-1 font-mono text-[11px]">
                        <Clock size={11} />
                        Expires {formattedExpiry}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Download, Share Settings, Copy Link */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Owner Access Settings Button */}
              {isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAccessLevelSetting(isPasswordProtected ? 'password' : 'public');
                    setPasswordSetting('');
                    setSettingsModalOpen(true);
                  }}
                  icon={<Settings size={13} />}
                  className="text-xs border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200"
                >
                  Access Settings
                </Button>
              )}

              {/* Copy Share Link */}
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
                title="Copy share link"
              >
                {copiedLink ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-zinc-400" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              {/* Download CTA */}
              <Button
                variant="primary"
                onClick={handleDownload}
                loading={downloading}
                disabled={downloading || !data?.downloadUrl}
                icon={<Download size={14} />}
                className="text-xs font-semibold px-4 py-2"
              >
                Download
              </Button>
            </div>
          </div>

          {/* Direct File Preview Section */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
            {/* IMAGE PREVIEW */}
            {category === 'image' && data?.previewUrl && (
              <div className="relative flex flex-col items-center justify-center p-4 sm:p-8 min-h-[380px] max-h-[720px] bg-zinc-950/80 overflow-hidden">
                {/* Zoom controls */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-1 backdrop-blur-md shadow-lg">
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <a
                    href={data.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 transition-colors"
                    title="Open Original Image"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="overflow-auto max-w-full max-h-[640px] flex items-center justify-center p-2">
                  <img
                    src={data.previewUrl}
                    alt={file.name}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
                    className="max-h-[600px] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150"
                  />
                </div>
              </div>
            )}

            {/* VIDEO PREVIEW */}
            {category === 'video' && data?.previewUrl && (
              <div className="p-4 sm:p-8 bg-zinc-950 flex items-center justify-center">
                <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-black border border-zinc-800">
                  <video
                    src={data.previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[600px] object-contain"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                </div>
              </div>
            )}

            {/* AUDIO PREVIEW */}
            {category === 'audio' && data?.previewUrl && (
              <div className="p-8 sm:p-14 bg-zinc-950/80 flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                  <Music size={36} />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-semibold text-base text-white">{file.name}</h3>
                  <p className="text-xs text-zinc-400 font-mono">{formatBytes(file.sizeBytes)}</p>
                </div>
                <div className="w-full max-w-md">
                  <audio
                    src={data.previewUrl}
                    controls
                    className="w-full filter invert hue-rotate-180 brightness-95"
                  >
                    Your browser does not support HTML5 audio.
                  </audio>
                </div>
              </div>
            )}

            {/* PDF PREVIEW */}
            {category === 'pdf' && data?.previewUrl && (
              <div className="flex flex-col">
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 px-4">
                  <span>PDF Document Viewer</span>
                  <a
                    href={data.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="h-[640px] w-full bg-zinc-950">
                  <iframe
                    src={data.previewUrl}
                    title={file.name}
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}

            {/* TEXT / CODE PREVIEW */}
            {category === 'text' && (
              <div className="flex flex-col">
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 px-4">
                  <span className="font-mono text-[11px] text-zinc-300">
                    {file.name}
                  </span>
                  <button
                    onClick={handleCopyText}
                    disabled={!textContent}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                  >
                    {copiedText ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="max-h-[600px] overflow-auto p-4 sm:p-6 bg-zinc-950 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                  {loadingText && (
                    <div className="py-12 text-center text-zinc-500">Loading code contents...</div>
                  )}
                  {!loadingText && textContent !== null && textContent}
                  {!loadingText && textContent === null && (
                    <div className="py-12 text-center text-zinc-500">
                      Preview not rendered. Click Download to inspect file contents.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OTHER / BINARY / ARCHIVE */}
            {(category === 'other' || category === 'archive' || (!data?.previewUrl && category !== 'text')) && (
              <div className="py-16 px-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shadow-inner">
                  {category === 'archive' ? <FileArchive size={32} /> : <HardDrive size={32} />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">{file.name}</h3>
                  <p className="text-xs text-zinc-400">
                    Direct browser preview is not available for this binary format. Click Download to retrieve the file.
                  </p>
                </div>
                <div>
                  <Button
                    variant="primary"
                    onClick={handleDownload}
                    icon={<Download size={14} />}
                    className="text-xs"
                  >
                    Download {friendlyType}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* File Metadata & Access Security Overview */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs text-zinc-400">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <User size={13} />
                <span>Uploaded By</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {uploader?.name || 'Optic User'}
              </div>
              <div className="text-[11px] text-zinc-400">
                {formattedUploadDate}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <HardDrive size={13} />
                <span>Object Details</span>
              </div>
              <div className="font-mono text-zinc-300">
                Size: {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} B)
              </div>
              <div className="font-mono text-zinc-400 truncate" title={file.mimeType}>
                Type: {file.mimeType || 'application/octet-stream'}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                <Clock size={13} />
                <span>Access Security</span>
              </div>
              <div className="text-zinc-300 flex items-center gap-1.5">
                {isPasswordProtected ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <Lock size={12} />
                    Password Required for Guests
                  </span>
                ) : (
                  <span className="text-sky-400 flex items-center gap-1 font-medium">
                    <Globe size={12} />
                    Open Public Link
                  </span>
                )}
              </div>
              {formattedExpiry ? (
                <div className="text-amber-400 font-mono text-[11px]">
                  Expires: {formattedExpiry}
                </div>
              ) : (
                <div className="text-zinc-500 font-mono text-[11px]">
                  Permanent link (no expiry)
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // =========================================================================
  // ACCESS SETTINGS MODAL (For Owner to change Public vs Password Protection)
  // =========================================================================
  const renderSettingsModal = () => {
    if (!settingsModalOpen || !file) return null;

    return (
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="File Access Settings"
        description={`Manage access permissions and password protection for "${file.name}"`}
      >
        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* Access Level Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-200">Who can access this file?</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAccessLevelSetting('public')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  accessLevelSetting === 'public'
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Globe size={14} className={accessLevelSetting === 'public' ? 'text-emerald-400' : 'text-zinc-400'} />
                  <span>Anyone with link</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Public access. Anyone who has the link can view &amp; download.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAccessLevelSetting('password')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  accessLevelSetting === 'password'
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Lock size={14} className={accessLevelSetting === 'password' ? 'text-emerald-400' : 'text-zinc-400'} />
                  <span>Password Protected</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Private access. Anyone apart from you must enter a password.
                </p>
              </button>
            </div>
          </div>

          {/* Password Input (Visible when Password Protected is selected) */}
          {accessLevelSetting === 'password' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Key size={13} className="text-emerald-400" />
                  <span>Access Password</span>
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <Sparkles size={11} />
                  <span>Generate Password</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPasswordSetting ? 'text' : 'password'}
                  placeholder="Set an access password..."
                  value={passwordSetting}
                  onChange={(e) => setPasswordSetting(e.target.value)}
                  required={accessLevelSetting === 'password'}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordSetting(!showPasswordSetting)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                >
                  {showPasswordSetting ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Visitors who open the share link will be prompted to enter this password. As the owner, you will never be locked out while signed in.
              </p>
            </div>
          )}

          {/* Link Expiration */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Link Expiration</label>
            <select
              value={expirationSetting}
              onChange={(e) => setExpirationSetting(e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer font-mono"
            >
              <option value="none">No expiration (Permanent link)</option>
              <option value="24">Expires in 24 hours (1 day)</option>
              <option value="168">Expires in 7 days</option>
              <option value="720">Expires in 30 days</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSettingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingSettings}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold"
            >
              Save Settings
            </Button>
          </div>
        </form>
      </Modal>
    );
  };

  // =========================================================================
  // VIEW VARIANT A: LOGGED IN USER (Has Side Nav via DashboardLayout)
  // =========================================================================
  if (user) {
    return (
      <DashboardLayout
        currentSurface="cloud"
        onNavigateSurface={onNavigate || (() => {})}
      >
        <div className="space-y-6 max-w-6xl mx-auto py-2">
          {/* Breadcrumb / Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <button
                onClick={() => onNavigate?.('cloud', '/cloud')}
                className="hover:text-zinc-200 transition-colors flex items-center gap-1"
              >
                <ArrowLeft size={13} />
                <span>Cloud Storage</span>
              </button>
              <span>/</span>
              <span className="text-zinc-500">Shared Files</span>
              <span>/</span>
              <span className="text-zinc-200 font-medium truncate max-w-xs">
                {file?.name || 'File Preview'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate?.('cloud', '/cloud')}
                className="text-xs"
              >
                Back to Storage
              </Button>
            </div>
          </div>

          {/* Render Main Content inside Logged-In Layout */}
          {renderMainContent()}

          {/* Access Settings Modal */}
          {renderSettingsModal()}
        </div>
      </DashboardLayout>
    );
  }

  // =========================================================================
  // VIEW VARIANT B: LOGGED OUT USER (Standalone Modern Header with Sign In/Sign Up)
  // =========================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Header for Logged-Out Visitors */}
      <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Optic Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate?.('main', '/')}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              title="Optic Home"
            >
              <OpticLogo size={22} showWordmark={true} />
            </button>
            <span className="text-zinc-700 font-mono">/</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Share
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Cloud
              </span>
            </div>
          </div>

          {/* Right Header Controls: Copy Link + Sign In + Sign Up */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors"
              title="Copy share link"
            >
              {copiedLink ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-zinc-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate?.('login', '/login')}
              icon={<LogIn size={13} />}
              className="text-xs text-zinc-300 hover:text-white"
            >
              Sign In
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => onNavigate?.('signup', '/signup')}
              icon={<UserPlus size={13} />}
              className="text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950"
            >
              Create Account
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full flex flex-col justify-center space-y-8">
        {renderMainContent()}

        {/* Logged Out Developer CTA Banner */}
        {!loading && !errorState && file && (
          <div className="mt-8 p-6 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/60 via-zinc-900/30 to-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Developer Cloud Storage
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Store, share, and deploy your files with Optic
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl">
                S3-compatible bucket storage, instant presigned links, and custom password protection with zero configuration.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => onNavigate?.('signup', '/signup')}
                className="text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
              >
                Get Started Free
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Access Settings Modal (if owner is logged in) */}
      {renderSettingsModal()}

      {/* Optic Footer */}
      <OpticFooter onNavigateSurface={onNavigate || (() => {})} compact={false} />
    </div>
  );
}
