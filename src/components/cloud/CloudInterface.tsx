import React, { useState, useEffect, useRef } from 'react';
import { SurfaceType, FileItem, FolderItem, UsageStats } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { storageService } from '../../lib/storageService';
import { supabaseData } from '../../lib/supabaseData';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Upload,
  FolderPlus,
  Search,
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  HardDrive,
  Copy,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  Edit2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Info,
  ShieldCheck,
} from 'lucide-react';

interface CloudInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onOpenAuthModal?: () => void;
}

export const CloudInterface: React.FC<CloudInterfaceProps> = ({
  onNavigateSurface,
  onOpenAuthModal,
}) => {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Compute displayed folder path strictly in React from the folder hierarchy
  const currentPathDisplay =
    folderBreadcrumbs.length > 0
      ? '/' + folderBreadcrumbs.map((b) => b.name).join('/')
      : '/root';

  // Sync folder query param to URL to preserve active folder across refresh
  const updateUrlFolder = (folderId: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (folderId) {
        url.searchParams.set('folder', folderId);
      } else {
        url.searchParams.delete('folder');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore URL manipulation failures in isolated frames
    }
  };

  const handleOpenFolder = (folder: FolderItem) => {
    setFolderBreadcrumbs((prev) => [...prev, folder]);
    setCurrentFolder(folder);
    updateUrlFolder(folder.id);
  };

  const handleNavigateToRoot = () => {
    setFolderBreadcrumbs([]);
    setCurrentFolder(null);
    updateUrlFolder(null);
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    const target = folderBreadcrumbs[index];
    setFolderBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolder(target);
    updateUrlFolder(target.id);
  };

  const handleNavigateUp = () => {
    if (folderBreadcrumbs.length > 1) {
      const nextBreadcrumbs = folderBreadcrumbs.slice(0, -1);
      const parent = nextBreadcrumbs[nextBreadcrumbs.length - 1];
      setFolderBreadcrumbs(nextBreadcrumbs);
      setCurrentFolder(parent);
      updateUrlFolder(parent.id);
    } else {
      handleNavigateToRoot();
    }
  };

  // Restore folder state from URL query param on load
  useEffect(() => {
    const restoreFolderFromUrl = async () => {
      const userId = user?.id;
      if (!userId) return;
      try {
        const params = new URLSearchParams(window.location.search);
        const folderId = params.get('folder');
        if (folderId && (!currentFolder || currentFolder.id !== folderId)) {
          const hierarchy = await supabaseData.getFolderHierarchy(userId, folderId);
          if (hierarchy.length > 0) {
            setFolderBreadcrumbs(hierarchy);
            setCurrentFolder(hierarchy[hierarchy.length - 1]);
          }
        }
      } catch (err) {
        console.warn('Failed to restore folder from URL:', err);
      }
    };
    restoreFolderFromUrl();
  }, [user?.id]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'updated'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFolderModalOpen, setRenameFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedFileForDetail, setSelectedFileForDetail] = useState<FileItem | null>(null);
  const [shareModalFile, setShareModalFile] = useState<FileItem | null>(null);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Usage stats from database
  const [usageStats, setUsageStats] = useState<UsageStats>({
    storageUsedBytes: 0,
    storageLimitBytes: 10 * 1024 * 1024 * 1024,
    bandwidthUsedBytes: 0,
    bandwidthLimitBytes: 50 * 1024 * 1024 * 1024,
    deploymentsThisMonth: 1,
    deploymentsLimit: 100,
    apiRequestsThisMonth: 0,
    apiRequestsLimit: 100000,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files, folders, and usage for current folder from Supabase
  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const userId = user?.id || '';
      if (!userId) {
        setFiles([]);
        setFolders([]);
        setLoading(false);
        return;
      }

      const [dataRes, usageRes] = await Promise.all([
        supabaseData.getFilesAndFolders(userId, currentFolder?.id || null),
        supabaseData.getUserUsage(userId),
      ]);

      setFiles(dataRes.files);
      setFolders(dataRes.folders);
      if (usageRes) {
        setUsageStats(usageRes);
      }
    } catch (err: any) {
      console.error('[CloudInterface] Failed to load cloud files from Supabase:', err);
      setErrorMessage(err?.message || 'Could not fetch files from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, currentFolder]);

  // Upload handler with real storage adapter & Supabase metadata
  const handleUploadFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const userId = user?.id || '';
    if (!userId) {
      setUploadError('You must be authenticated to upload files.');
      setUploading(false);
      return;
    }

    try {
      for (const file of Array.from(selectedFiles)) {
        const meta = storageService.detectMimeType(file.name);
        // Call the isolated storage service
        const uploadResult = await storageService.uploadFile(
          file,
          currentPathDisplay !== '/root' ? currentPathDisplay : undefined
        );

        if (!uploadResult.success) {
          // Explicitly refuse to fake successful uploads
          setUploadError(uploadResult.error || 'Failed to upload object bytes to storage provider.');
          setUploading(false);
          return;
        }

        // If upload succeeded, register file metadata in Supabase `files` table
        await supabaseData.insertFileRecord(userId, {
          name: file.name,
          extension: meta.ext,
          mimeType: meta.type,
          sizeBytes: file.size,
          folderId: currentFolder?.id || null,
          storageKey: uploadResult.storageKey || `uploads/${file.name}`,
          storageProvider: uploadResult.storageProvider || 'r2',
          publicUrl: uploadResult.publicUrl || `https://cdn.optic.doy.best/uploads/${file.name}`,
          isPublic: true,
        });
      }

      setUploadModalOpen(false);
      await loadData();
      toast.success('Files uploaded successfully to storage.', 'Upload Complete');
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload file.');
      toast.error(err?.message || 'Failed to upload file.', 'Upload Failed');
    } finally {
      setUploading(false);
    }
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const userId = user?.id || '';
    if (!userId) {
      toast.error('Please sign in to create a folder.', 'Authentication Required');
      return;
    }

    try {
      await supabaseData.createFolder(
        userId,
        newFolderName.trim(),
        currentFolder?.id || null
      );
      toast.success(`Folder "${newFolderName.trim()}" created successfully.`, 'Folder Created');
      setNewFolderName('');
      setNewFolderModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create folder.', 'Folder Error');
    }
  };

  // Rename folder
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameValue.trim()) return;

    const userId = user?.id || '';
    if (!userId) return;

    try {
      await supabaseData.renameFolder(userId, folderToRename.id, renameValue.trim());
      toast.success('Folder renamed successfully.', 'Folder Renamed');
      setRenameFolderModalOpen(false);
      const newName = renameValue.trim();
      setFolderBreadcrumbs((prev) =>
        prev.map((b) => (b.id === folderToRename.id ? { ...b, name: newName } : b))
      );
      if (currentFolder?.id === folderToRename.id) {
        setCurrentFolder((prev) => (prev ? { ...prev, name: newName } : null));
      }
      setFolderToRename(null);
      setRenameValue('');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to rename folder.', 'Rename Error');
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folder: FolderItem) => {
    const userId = user?.id || '';
    if (!userId) return;

    try {
      await supabaseData.deleteFolder(userId, folder.id);
      toast.success(`Folder "${folder.name}" deleted.`, 'Folder Deleted');
      const idx = folderBreadcrumbs.findIndex((b) => b.id === folder.id);
      if (idx !== -1) {
        const remaining = folderBreadcrumbs.slice(0, idx);
        setFolderBreadcrumbs(remaining);
        const nextFolder = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        setCurrentFolder(nextFolder);
        updateUrlFolder(nextFolder?.id || null);
      } else {
        await loadData();
      }
    } catch (err: any) {
      console.error('[CloudInterface] Failed to delete folder:', err);
      toast.error(err?.message || 'Failed to delete folder.', 'Delete Error');
    }
  };

  // Delete file
  const handleDeleteFile = async (file: FileItem) => {
    const userId = user?.id || '';
    if (!userId) return;

    try {
      await supabaseData.deleteFile(userId, file.id, file.sizeBytes);
      toast.success(`File "${file.name}" deleted.`, 'File Deleted');
      setSelectedFileForDetail(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete file.', 'Delete Error');
    }
  };

  // Generate real share link from `share_links` table
  const handleOpenShareModal = async (file: FileItem) => {
    setShareModalFile(file);
    setCopiedLink(false);
    setGeneratedShareUrl(file.publicUrl || null);

    const userId = user?.id || '';
    if (userId) {
      try {
        const link = await supabaseData.createShareLink(userId, file.id, 72);
        setGeneratedShareUrl(link.shareUrl);
        setShareExpiresAt(new Date(link.expiresAt).toLocaleDateString());
      } catch (err) {
        console.warn('Share link generation notice:', err);
      }
    }
  };

  // Sort & Filter
  const filteredFiles = files
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortBy === 'size') {
        return sortOrder === 'asc' ? a.sizeBytes - b.sizeBytes : b.sizeBytes - a.sizeBytes;
      }
      if (sortBy === 'updated') {
        return sortOrder === 'asc'
          ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });

  const getFileIcon = (ext: string) => {
    const e = ext.toUpperCase();
    if (['PNG', 'JPG', 'JPEG', 'SVG', 'WEBP', 'GIF'].includes(e)) {
      return <ImageIcon size={16} className="text-sky-400 shrink-0" />;
    }
    if (['ZIP', 'TAR', 'GZ', 'RAR'].includes(e)) {
      return <FileArchive size={16} className="text-amber-400 shrink-0" />;
    }
    if (['TS', 'JS', 'JSON', 'HTML', 'CSS', 'PY', 'RS'].includes(e)) {
      return <FileCode size={16} className="text-emerald-400 shrink-0" />;
    }
    return <FileText size={16} className="text-zinc-400 shrink-0" />;
  };

  const storageUsedGB = (usageStats.storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const storageLimitGB = (usageStats.storageLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const storagePercent = Math.min(
    100,
    Math.max(0, (usageStats.storageUsedBytes / usageStats.storageLimitBytes) * 100)
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Cloud Storage
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Store and manage object files, folders, and authenticated share links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewFolderModalOpen(true)}
            icon={<FolderPlus size={14} />}
            className="text-xs"
          >
            New Folder
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setUploadModalOpen(true)}
            icon={<Upload size={14} />}
            className="text-xs"
          >
            Upload File
          </Button>
        </div>
      </div>

      {/* Storage Allocation Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block font-medium">
              Storage Allocation
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">Active Tier</span>
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {storageUsedGB} GB <span className="text-xs font-normal text-zinc-500">/ {storageLimitGB} GB</span>
          </div>
          <div className="mt-2.5 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono flex justify-between">
            <span>{storagePercent}% used</span>
            <span>{files.length} active files</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">Direct Uploads</div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload objects directly into your organization bucket with automatic chunking and instant shareable URLs.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUploadModalOpen(true)}
            icon={<Upload size={14} />}
            className="text-xs shrink-0 self-start sm:self-auto"
          >
            Select Files
          </Button>
        </div>
      </div>

        {/* Error message alert if query failed */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-red-900/60 bg-red-950/30 text-red-300 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadData} icon={<RefreshCw size={13} />}>
              Retry
            </Button>
          </div>
        )}

        {/* Navigation Breadcrumb Bar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 overflow-x-auto py-0.5">
            {folderBreadcrumbs.length > 0 && (
              <button
                onClick={handleNavigateUp}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors mr-0.5 shrink-0"
                title="Go up to parent folder"
                aria-label="Go up to parent folder"
              >
                <ArrowLeft size={13} />
              </button>
            )}
            <button
              onClick={handleNavigateToRoot}
              className={`hover:text-white transition-colors shrink-0 flex items-center gap-1 ${
                !currentFolder ? 'text-sky-400 font-semibold' : ''
              }`}
            >
              <HardDrive size={13} className={!currentFolder ? 'text-sky-400' : 'text-zinc-500'} />
              <span>Root</span>
            </button>
            {folderBreadcrumbs.map((crumb, idx) => {
              const isCurrent = idx === folderBreadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={13} className="text-zinc-600 shrink-0" />
                  <button
                    onClick={() => handleNavigateToBreadcrumb(idx)}
                    className={`flex items-center gap-1 shrink-0 hover:text-white transition-colors ${
                      isCurrent ? 'text-white font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    <Folder size={13} className={isCurrent ? 'text-sky-400' : 'text-zinc-500'} />
                    <span>{crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search & Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
                className="py-1.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
              <span className="text-zinc-500 text-[10px] uppercase font-mono px-1.5 font-semibold">
                Sort:
              </span>
              <button
                onClick={() => {
                  if (sortBy === 'updated') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('updated');
                    setSortOrder('desc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  sortBy === 'updated' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'
                }`}
              >
                Date {sortBy === 'updated' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'name') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('name');
                    setSortOrder('asc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  sortBy === 'name' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'
                }`}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'size') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('size');
                    setSortOrder('desc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  sortBy === 'size' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'
                }`}
              >
                Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>

        {/* Folders List (if any exist in current level) */}
        {folders.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
              Folders ({folders.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700/80 text-left transition-all flex items-center justify-between group"
                >
                  <button
                    onClick={() => handleOpenFolder(folder)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <Folder size={18} className="text-sky-400 group-hover:scale-105 transition-transform shrink-0" />
                    <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                      {folder.name}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToRename(folder);
                        setRenameValue(folder.name);
                        setRenameFolderModalOpen(true);
                      }}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                      title="Rename folder"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                      title="Delete folder"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Data Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
            <span>
              Files ({filteredFiles.length}) in {currentPathDisplay}
            </span>
          </div>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-zinc-500 font-mono flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-sky-400 rounded-full animate-spin" />
                <span>Loading files from Optic Cloud storage...</span>
              </div>
            ) : filteredFiles.length === 0 && folders.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
                  <HardDrive size={22} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">No files or folders</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  This directory is empty. Create a folder or upload a file using the actions above.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewFolderModalOpen(true)}
                    icon={<FolderPlus size={14} />}
                  >
                    New Folder
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setUploadModalOpen(true)}
                    icon={<Upload size={14} />}
                  >
                    Upload File
                  </Button>
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-500 font-mono">
                No files in this folder. Folders are listed above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-zinc-400 text-[11px]">
                      <th className="py-2.5 px-4 font-semibold">NAME</th>
                      <th className="py-2.5 px-4 font-semibold">TYPE</th>
                      <th className="py-2.5 px-4 font-semibold">SIZE</th>
                      <th className="py-2.5 px-4 font-semibold">UPDATED</th>
                      <th className="py-2.5 px-4 font-semibold">ACCESS</th>
                      <th className="py-2.5 px-4 font-semibold text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-200">
                    {filteredFiles.map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                        onClick={() => setSelectedFileForDetail(file)}
                      >
                        <td className="py-3 px-4 font-sans font-medium text-zinc-100 flex items-center gap-2.5">
                          {getFileIcon(file.extension)}
                          <span className="group-hover:text-sky-300 transition-colors">{file.name}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 text-[11px]">{file.extension}</td>
                        <td className="py-3 px-4 text-zinc-400 text-[11px]">
                          {storageService.formatBytes(file.sizeBytes)}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-[11px]">
                          {new Date(file.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={file.isPublic ? 'info' : 'outline'} size="sm">
                            {file.isPublic ? 'Public' : 'Private'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenShareModal(file)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                              title="Share file"
                            >
                              <Share2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                              title="Delete file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      {/* Upload Modal (Drag & Drop + Click + Error Handling) */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => {
          if (!uploading) {
            setUploadModalOpen(false);
            setUploadError(null);
          }
        }}
        title="Upload to Optic Cloud"
        description="Upload files securely to your high-performance storage bucket."
      >
        <div className="space-y-4">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-mono leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold mb-1 text-red-200">
                <AlertCircle size={14} />
                <span>Storage Adapter Notice</span>
              </div>
              {uploadError}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (!uploading) handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
            className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sky-400 mx-auto mb-3">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload size={18} />
              )}
            </div>
            <p className="text-xs font-semibold text-zinc-200">
              {uploading ? 'Processing upload...' : 'Drop files here, or '}
              {!uploading && <span className="text-sky-400 underline">browse</span>}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Supports any file type up to 5 GB.
            </p>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
            Target Destination:{' '}
            <span className="text-zinc-300">
              {currentPathDisplay}
            </span>
          </div>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        title="Create New Folder"
        description="Create a new directory in this storage path."
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            label="Folder Name"
            placeholder="e.g. static-assets"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setNewFolderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        isOpen={renameFolderModalOpen}
        onClose={() => setRenameFolderModalOpen(false)}
        title="Rename Folder"
        description="Enter a new name for this directory."
      >
        <form onSubmit={handleRenameFolder} className="space-y-4">
          <Input
            label="Folder Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameFolderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* File Detail / Metadata Modal */}
      {selectedFileForDetail && (
        <Modal
          isOpen={Boolean(selectedFileForDetail)}
          onClose={() => setSelectedFileForDetail(null)}
          title={selectedFileForDetail.name}
          description="File attributes and storage metadata"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">MIME TYPE:</span>
              <span className="text-zinc-200">{selectedFileForDetail.mimeType}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">SIZE:</span>
              <span className="text-zinc-200">
                {storageService.formatBytes(selectedFileForDetail.sizeBytes)} ({selectedFileForDetail.sizeBytes.toLocaleString()} bytes)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">STORAGE KEY:</span>
              <span className="text-zinc-300 text-[11px] truncate max-w-[200px]">
                {selectedFileForDetail.storageKey}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">PROVIDER:</span>
              <span className="text-sky-400 capitalize">{selectedFileForDetail.storageProvider || 'r2'}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">CREATED:</span>
              <span className="text-zinc-400">
                {new Date(selectedFileForDetail.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleDeleteFile(selectedFileForDetail)}
                icon={<Trash2 size={13} />}
              >
                Delete File
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const file = selectedFileForDetail;
                  setSelectedFileForDetail(null);
                  handleOpenShareModal(file);
                }}
                icon={<Share2 size={13} />}
              >
                Share Link
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Share Link Modal with table share_links */}
      {shareModalFile && (
        <Modal
          isOpen={Boolean(shareModalFile)}
          onClose={() => {
            setShareModalFile(null);
            setCopiedLink(false);
          }}
          title="Share File Link"
          description="Temporary authenticated link for secure file access"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Public URL</label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200">
                <span className="truncate flex-1 select-all">
                  {generatedShareUrl || shareModalFile.publicUrl || 'Generating link...'}
                </span>
                <button
                  onClick={async () => {
                    const url = generatedShareUrl || shareModalFile.publicUrl;
                    if (url) {
                      await navigator.clipboard.writeText(url);
                      setCopiedLink(true);
                      toast.success('CDN share link copied to clipboard.', 'Copied');
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 shrink-0"
                  title="Copy URL"
                >
                  {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {shareExpiresAt && (
              <div className="text-[11px] text-zinc-500 font-mono">
                Access expires on: <span className="text-zinc-300">{shareExpiresAt}</span>
              </div>
            )}

            <div className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              Anyone with this link can access the raw bytes via Optic edge nodes without authentication.
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setShareModalFile(null);
                setCopiedLink(false);
              }}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
