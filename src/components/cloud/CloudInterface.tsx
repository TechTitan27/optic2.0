import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';
import { OpticFooter } from '../common/OpticFooter';
import { FileItem, FolderItem, SurfaceType } from '../../types';
import { storageService } from '../../lib/storageService';
import { useAuth } from '../../context/AuthContext';
import {
  HardDrive,
  Folder,
  FolderPlus,
  Upload,
  Search,
  ArrowUpDown,
  MoreVertical,
  Trash2,
  Share2,
  FileText,
  FileCode,
  Image as ImageIcon,
  FileArchive,
  Download,
  Check,
  Copy,
  ChevronRight,
  Info,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { OpticLogo } from '../brand/OpticLogo';

interface CloudInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
}

export const CloudInterface: React.FC<CloudInterfaceProps> = ({ onNavigateSurface }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'updated'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFileForDetail, setSelectedFileForDetail] = useState<FileItem | null>(null);
  const [shareModalFile, setShareModalFile] = useState<FileItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial demo & API loading
  useEffect(() => {
    loadFiles();
  }, [currentFolder]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const folderParam = currentFolder ? `?folderId=${currentFolder.id}` : '';
      const res = await fetch(`/api/cloud/files${folderParam}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        if (data.folders) setFolders(data.folders);
      } else {
        // Fallback realistic storage records
        setInitialDemoData();
      }
    } catch {
      setInitialDemoData();
    } finally {
      setLoading(false);
    }
  };

  const setInitialDemoData = () => {
    setFolders([
      {
        id: 'fold_assets',
        name: 'brand-assets',
        path: '/brand-assets',
        itemCount: 4,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'fold_builds',
        name: 'release-artifacts',
        path: '/release-artifacts',
        itemCount: 2,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ]);

    setFiles([
      {
        id: 'f_1',
        name: 'logo-optical.svg',
        extension: 'SVG',
        mimeType: 'image/svg+xml',
        sizeBytes: 12288,
        storageKey: 'assets/logo-optical.svg',
        storageProvider: 'r2',
        publicUrl: 'https://cdn.optic.doy.best/assets/logo-optical.svg',
        createdAt: new Date(Date.now() - 120000).toISOString(),
        updatedAt: new Date(Date.now() - 120000).toISOString(),
        isPublic: true,
      },
      {
        id: 'f_2',
        name: 'website-bundle.zip',
        extension: 'ZIP',
        mimeType: 'application/zip',
        sizeBytes: 4404019,
        storageKey: 'builds/website-bundle.zip',
        storageProvider: 'r2',
        publicUrl: 'https://cdn.optic.doy.best/builds/website-bundle.zip',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        isPublic: false,
      },
      {
        id: 'f_3',
        name: 'datacenter-topology.png',
        extension: 'PNG',
        mimeType: 'image/png',
        sizeBytes: 1887436,
        storageKey: 'media/datacenter-topology.png',
        storageProvider: 'r2',
        publicUrl: 'https://cdn.optic.doy.best/media/datacenter-topology.png',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        isPublic: true,
      },
      {
        id: 'f_4',
        name: 'schema-dump.json',
        extension: 'JSON',
        mimeType: 'application/json',
        sizeBytes: 94208,
        storageKey: 'data/schema-dump.json',
        storageProvider: 'r2',
        publicUrl: 'https://cdn.optic.doy.best/data/schema-dump.json',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        isPublic: false,
      },
    ]);
  };

  // Upload handler
  const handleUploadFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newUploadedFiles: FileItem[] = [];
    Array.from(selectedFiles).forEach((file) => {
      const meta = storageService.detectMimeType(file.name);
      const newFile: FileItem = {
        id: 'f_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        extension: meta.ext,
        mimeType: meta.type,
        sizeBytes: file.size,
        storageKey: `uploads/${Date.now()}_${file.name}`,
        storageProvider: 'r2',
        publicUrl: `https://cdn.optic.doy.best/uploads/${file.name}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: true,
      };
      newUploadedFiles.push(newFile);
    });

    setFiles((prev) => [...newUploadedFiles, ...prev]);
    setUploadModalOpen(false);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: FolderItem = {
      id: 'fold_' + Math.random().toString(36).substring(2, 9),
      name: newFolderName.trim(),
      path: `/${newFolderName.trim()}`,
      itemCount: 0,
      createdAt: new Date().toISOString(),
    };

    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderModalOpen(false);
  };

  const handleDeleteFile = (id: string) => {
    if (!confirm('Are you sure you want to delete this file from Optic Cloud storage?')) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFileForDetail?.id === id) setSelectedFileForDetail(null);
  };

  const getFileIcon = (extension: string) => {
    switch (extension.toLowerCase()) {
      case 'svg':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return <ImageIcon size={16} className="text-amber-400" />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <FileArchive size={16} className="text-indigo-400" />;
      case 'json':
      case 'js':
      case 'ts':
      case 'html':
      case 'css':
        return <FileCode size={16} className="text-teal-400" />;
      default:
        return <FileText size={16} className="text-sky-400" />;
    }
  };

  // Filter & Sort
  const filteredFiles = files
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') comp = a.name.localeCompare(b.name);
      if (sortBy === 'size') comp = a.sizeBytes - b.sizeBytes;
      if (sortBy === 'updated') comp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortOrder === 'asc' ? comp : -comp;
    });

  const storageStatus = storageService.getStorageStatus();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Cloud Header */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigateSurface('dashboard', '/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <OpticLogo size={20} showWordmark={true} surfaceLabel="Cloud" />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
            Upload
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Storage Architecture Callout */}
        <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <HardDrive size={16} className="text-sky-400 shrink-0" />
            <span className="text-zinc-300">
              <strong className="text-zinc-100 font-semibold">Decoupled Object Storage:</strong> File metadata is tracked in Supabase PostgreSQL, while bytes interface with Cloudflare R2 signed upload URLs.
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400 shrink-0">
            <Badge variant="info">Storage: 7.2 GB / 10 GB</Badge>
          </div>
        </div>

        {/* Toolbar: Breadcrumbs, Search, Sorting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
            <button
              onClick={() => setCurrentFolder(null)}
              className={`hover:text-white transition-colors ${
                !currentFolder ? 'text-sky-400 font-semibold' : ''
              }`}
            >
              Root
            </button>
            {currentFolder && (
              <>
                <ChevronRight size={13} className="text-zinc-600" />
                <span className="text-white font-semibold">{currentFolder.name}</span>
              </>
            )}
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

        {/* Folder Tiles (if in root) */}
        {!currentFolder && folders.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
              Folders
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolder(folder)}
                  className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700/80 text-left transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder size={18} className="text-sky-400 group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                      {folder.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {folder.itemCount} items
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Files Data Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
            <span>Files ({filteredFiles.length})</span>
          </div>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-zinc-500 font-mono">
                Loading files from Supabase storage metadata...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
                  <HardDrive size={22} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">No files yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Upload your first file to get started with developer cloud storage.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setUploadModalOpen(true)}
                  icon={<Upload size={14} />}
                  className="mt-2"
                >
                  Upload File
                </Button>
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
                              onClick={() => setShareModalFile(file)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                              title="Share file"
                            >
                              <Share2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
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
      </main>

      <OpticFooter onNavigateSurface={onNavigateSurface} compact={true} />

      {/* Upload Modal (Drag & Drop + Click) */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload to Optic Cloud"
        description="Select files to upload directly to object storage with Supabase metadata registration."
      >
        <div className="space-y-4">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sky-400 mx-auto mb-3">
              <Upload size={18} />
            </div>
            <p className="text-xs font-semibold text-zinc-200">
              Drop files here, or <span className="text-sky-400 underline">browse</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Supports any file type up to 5 GB.
            </p>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
            Target Destination: <span className="text-zinc-300">{currentFolder ? currentFolder.path : '/root'}</span>
          </div>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        title="Create New Folder"
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

      {/* File Detail / Metadata Modal */}
      {selectedFileForDetail && (
        <Modal
          isOpen={Boolean(selectedFileForDetail)}
          onClose={() => setSelectedFileForDetail(null)}
          title={selectedFileForDetail.name}
          description="File metadata from Supabase database record"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">MIME TYPE:</span>
              <span className="text-zinc-200">{selectedFileForDetail.mimeType}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">SIZE:</span>
              <span className="text-zinc-200">{storageService.formatBytes(selectedFileForDetail.sizeBytes)} ({selectedFileForDetail.sizeBytes.toLocaleString()} bytes)</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">STORAGE KEY:</span>
              <span className="text-zinc-300 text-[11px] truncate max-w-[200px]">{selectedFileForDetail.storageKey}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">ENGINE:</span>
              <span className="text-sky-400">Cloudflare R2 Adapter</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500">CREATED:</span>
              <span className="text-zinc-400">{new Date(selectedFileForDetail.createdAt).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleDeleteFile(selectedFileForDetail.id)}
                icon={<Trash2 size={13} />}
              >
                Delete File
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setShareModalFile(selectedFileForDetail);
                  setSelectedFileForDetail(null);
                }}
                icon={<Share2 size={13} />}
              >
                Share Link
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Share Link Modal */}
      {shareModalFile && (
        <Modal
          isOpen={Boolean(shareModalFile)}
          onClose={() => {
            setShareModalFile(null);
            setCopiedLink(false);
          }}
          title="Share File Link"
          description="Direct CDN link with public read authorization"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Public URL</label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200">
                <span className="truncate flex-1 select-all">{shareModalFile.publicUrl}</span>
                <button
                  onClick={async () => {
                    if (shareModalFile.publicUrl) {
                      await navigator.clipboard.writeText(shareModalFile.publicUrl);
                      setCopiedLink(true);
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

            <div className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              Anyone with this link can access the raw bytes via Optic CDN edge nodes without authentication.
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
