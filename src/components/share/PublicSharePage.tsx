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
  Calendar,
  HardDrive,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { SurfaceType, SharedFileData } from '../../types';
import { getShareTokenFromPath } from '../../lib/domainNavigation';
import { OpticStorageService } from '../../lib/storageService';
import { useToast } from '../../context/ToastContext';
import { PublicShareSkeleton } from '../common/Skeleton';

interface PublicSharePageProps {
  path: string;
  onNavigate?: (surface: SurfaceType, path?: string) => void;
}

const storageService = new OpticStorageService();

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
  if (category === 'text') return `${ext.toUpperCase() || 'Text'} File`;
  if (category === 'archive') return `${ext.toUpperCase() || 'Zip'} Archive`;
  return ext ? `${ext.toUpperCase()} File` : mimeType || 'File';
}

export function PublicSharePage({ path, onNavigate }: PublicSharePageProps) {
  const toast = useToast();
  const token =
    getShareTokenFromPath(path) ||
    (typeof window !== 'undefined' ? getShareTokenFromPath(window.location.pathname) : null) ||
    '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedFileData | null>(null);
  const [errorState, setErrorState] = useState<'not_found' | 'expired' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Text preview content (for text/code files)
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Image zoom state
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    let isMounted = true;

    async function loadSharedFile() {
      if (!token) {
        setErrorState('not_found');
        setErrorMessage('No share token provided in the URL.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorState(null);

      try {
        const result = await storageService.getSharedFile(token);

        if (!isMounted) return;

        if (result.expired) {
          setErrorState('expired');
          setErrorMessage(result.error || 'This link has expired.');
        } else if (result.notFound) {
          setErrorState('not_found');
          setErrorMessage(result.error || 'File not found or share link is invalid.');
        } else if (!result.success || !result.file) {
          setErrorState('error');
          setErrorMessage(result.error || 'Unable to load shared file.');
        } else {
          setData(result as SharedFileData);

          // If text file, optionally fetch content preview
          const category = getFileCategory(result.file.mimeType, result.file.name);
          if (category === 'text' && result.previewUrl && result.file.sizeBytes < 1024 * 1024) {
            setLoadingText(true);
            fetch(result.previewUrl)
              .then((res) => (res.ok ? res.text() : ''))
              .then((txt) => {
                if (isMounted) setTextContent(txt);
              })
              .catch(() => {})
              .finally(() => {
                if (isMounted) setLoadingText(false);
              });
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorState('error');
        setErrorMessage(err?.message || 'Failed to retrieve shared file.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSharedFile();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle Download trigger
  const handleDownload = async () => {
    if (!data?.downloadUrl || !data.file) return;

    try {
      setDownloading(true);
      toast.info(`Starting download for ${data.file.name}...`);

      // Trigger download via anchor element with explicit filename
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
      // Fallback: direct window location or link
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate?.('main', '/')}
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-90"
            title="Optic Home"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-sm tracking-wider text-white shadow-inner">
              <span className="bg-gradient-to-tr from-white to-zinc-400 bg-clip-text text-transparent">
                O
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">Optic</span>
              <span className="text-[10px] uppercase font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                Cloud Share
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors"
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

          <button
            onClick={() => onNavigate?.('login', '/login')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>Sign in to Optic</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* Loading State: Polished Skeleton preview matching final shared card and content */}
        {loading && (
          <div className="py-6 w-full">
            <PublicShareSkeleton />
          </div>
        )}

        {/* Expired State */}
        {!loading && errorState === 'expired' && (
          <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5">
              <Clock size={28} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              This link has expired
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              The owner configured an expiration date for this share link or it has reached its access limit. Please request a new link from the owner.
            </p>
            <div className="pt-2 border-t border-zinc-800/60 flex justify-center gap-3">
              <button
                onClick={() => onNavigate?.('main', '/')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
              >
                <ArrowLeft size={14} />
                Return to Optic
              </button>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {!loading && errorState === 'not_found' && (
          <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-5">
              <FileQuestion size={28} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              File not found
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              This shared link does not exist, has been removed by the owner, or the URL is incorrect.
            </p>
            <div className="pt-2 border-t border-zinc-800/60 flex justify-center gap-3">
              <button
                onClick={() => onNavigate?.('main', '/')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
              >
                <ArrowLeft size={14} />
                Go to Optic
              </button>
            </div>
          </div>
        )}

        {/* General Error State */}
        {!loading && errorState === 'error' && (
          <div className="max-w-md mx-auto w-full text-center py-16 px-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-5">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              Unable to load shared file
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              {errorMessage || 'A network error occurred while accessing this object.'}
            </p>
            <div className="pt-2 border-t border-zinc-800/60 flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Active File Shared View */}
        {!loading && !errorState && file && (
          <div className="space-y-6">
            {/* Top File Summary & Actions Bar */}
            <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-300 shrink-0 shadow-inner">
                  {category === 'image' && <ImageIcon size={22} className="text-cyan-400" />}
                  {category === 'video' && <Film size={22} className="text-indigo-400" />}
                  {category === 'audio' && <Music size={22} className="text-purple-400" />}
                  {category === 'pdf' && <FileText size={22} className="text-red-400" />}
                  {category === 'text' && <FileCode size={22} className="text-emerald-400" />}
                  {category === 'archive' && <FileArchive size={22} className="text-amber-400" />}
                  {category === 'other' && <HardDrive size={22} className="text-zinc-400" />}
                </div>

                <div className="min-w-0 space-y-1">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate select-all" title={file.name}>
                    {file.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span className="font-mono text-zinc-300 font-medium">
                      {formatBytes(file.sizeBytes)}
                    </span>
                    <span>•</span>
                    <span>{friendlyType}</span>
                    {formattedExpiry && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400/90 flex items-center gap-1 font-mono text-[11px]">
                          <Clock size={11} />
                          Expires {formattedExpiry}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Download CTA Button */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleDownload}
                  disabled={downloading || !data?.downloadUrl}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download size={16} />
                  <span>{downloading ? 'Downloading...' : `Download (${formatBytes(file.sizeBytes)})`}</span>
                </button>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg">
              {/* IMAGE PREVIEW */}
              {category === 'image' && data?.previewUrl && (
                <div className="relative flex flex-col items-center justify-center p-4 sm:p-8 min-h-[360px] max-h-[680px] bg-zinc-950/80 overflow-hidden">
                  {/* Zoom controls overlay */}
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-zinc-900/80 border border-zinc-700/60 rounded-lg p-1 backdrop-blur-md">
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                      title="Reset Zoom"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <a
                      href={data.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                      title="Open Original Image"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  <div className="overflow-auto max-w-full max-h-[620px] flex items-center justify-center p-2">
                    <img
                      src={data.previewUrl}
                      alt={file.name}
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
                      className="max-h-[580px] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150"
                    />
                  </div>
                </div>
              )}

              {/* VIDEO PREVIEW */}
              {category === 'video' && data?.previewUrl && (
                <div className="p-4 sm:p-8 bg-zinc-950/90 flex items-center justify-center">
                  <div className="w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl bg-black border border-zinc-800">
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
                <div className="p-8 sm:p-12 bg-zinc-950/80 flex flex-col items-center justify-center space-y-6">
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
                    <span>PDF Document Preview</span>
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
                  <div className="h-[620px] w-full bg-zinc-950">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                    >
                      {copiedText ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Content</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="max-h-[580px] overflow-auto p-4 sm:p-6 bg-zinc-950 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                    {loadingText && (
                      <div className="py-12 text-center text-zinc-500">Loading file content...</div>
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

              {/* OTHER / BINARY / ARCHIVE FILES */}
              {(category === 'other' || category === 'archive' || (!data?.previewUrl && category !== 'text')) && (
                <div className="py-16 px-6 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shadow-inner">
                    {category === 'archive' ? <FileArchive size={32} /> : <HardDrive size={32} />}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">{file.name}</h3>
                    <p className="text-xs text-zinc-400">
                      Preview is not available for this binary format. Click Download to retrieve the file.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      Download {friendlyType}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* File Information & Uploader Metadata Card */}
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
                  Size: {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} bytes)
                </div>
                <div className="font-mono text-zinc-400 truncate" title={file.mimeType}>
                  Type: {file.mimeType || 'binary/octet-stream'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                  <Clock size={13} />
                  <span>Security & Access</span>
                </div>
                <div className="text-zinc-300">
                  Private Cloudflare R2 bucket with short-lived presigned edge access
                </div>
                {formattedExpiry ? (
                  <div className="text-amber-400 font-mono text-[11px]">
                    Expires: {formattedExpiry}
                  </div>
                ) : (
                  <div className="text-zinc-500 font-mono text-[11px]">
                    Permanent share link (no expiry)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-zinc-900 text-center text-xs text-zinc-600">
        <p>
          Powered by <span className="text-zinc-400 font-medium">Optic</span> Cloud Object Infrastructure
        </p>
      </footer>
    </div>
  );
}
