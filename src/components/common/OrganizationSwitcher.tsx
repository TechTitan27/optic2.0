import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { getOrgAvatarUrl, getDiceBearOrgAvatarUrl } from '../../lib/avatar';
import { ChevronDown, Plus, Check, Building2 } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';

interface OrganizationSwitcherProps {
  className?: string;
  compact?: boolean;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  className = '',
  compact = false,
}) => {
  const { organizations, currentOrg, setCurrentOrg, createOrg } = useOrganization();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      await createOrg(newOrgName.trim());
      setNewOrgName('');
      setCreateModalOpen(false);
      setDropdownOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (!currentOrg && organizations.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <Building2 size={14} className="text-indigo-400" />
          <span>Create Organization</span>
          <Plus size={13} className="text-zinc-400" />
        </button>

        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New Organization"
          description="Create an organization to collaborate and manage your Optic hosting projects."
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Organization Name"
              placeholder="e.g. Acme Studio"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={creating}
                disabled={!newOrgName.trim()}
              >
                Create Organization
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  const avatarUrl = getOrgAvatarUrl(currentOrg);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 transition-all text-left focus:outline-none"
        aria-label="Switch organization"
      >
        <img
          src={avatarUrl}
          alt={currentOrg?.name || 'Organization'}
          className="w-5 h-5 rounded-md object-cover border border-zinc-700/60 shrink-0 bg-zinc-800"
          loading="lazy"
        />
        {!compact && (
          <div className="flex flex-col min-w-0 pr-1 max-w-[130px] sm:max-w-[170px]">
            <span className="text-xs font-semibold text-zinc-100 truncate leading-tight">
              {currentOrg?.name || 'Organization'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono truncate leading-tight">
              {currentOrg?.slug || 'org'}
            </span>
          </div>
        )}
        <ChevronDown size={13} className="text-zinc-400 shrink-0 ml-auto" />
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-800/80">
            Organizations
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {organizations.map((org) => {
              const isSelected = currentOrg?.id === org.id;
              const orgAvatar = getOrgAvatarUrl(org);
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrg(org);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                    isSelected ? 'bg-zinc-800/90 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img
                      src={orgAvatar}
                      alt={org.name}
                      className="w-5 h-5 rounded-md object-cover border border-zinc-700/50 shrink-0 bg-zinc-800"
                      loading="lazy"
                    />
                    <div className="overflow-hidden">
                      <p className="truncate text-xs font-medium text-zinc-200">{org.name}</p>
                      <p className="truncate text-[10px] text-zinc-500 font-mono">{org.slug}</p>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-indigo-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <div className="p-1.5 border-t border-zinc-800/80">
            <button
              onClick={() => {
                setCreateModalOpen(true);
                setDropdownOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors font-medium"
            >
              <Plus size={14} />
              <span>Create New Organization</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Organization"
        description="Hosting projects belong to organizations. Creator automatically becomes the owner."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Organization Name"
            placeholder="e.g. Acme Studio"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400">
            <img
              src={getDiceBearOrgAvatarUrl(newOrgName || 'Optic Organization')}
              alt="Organization Avatar Preview"
              className="w-9 h-9 rounded-lg object-cover border border-zinc-700/60 bg-zinc-800 shrink-0 shadow-sm"
            />
            <div className="space-y-0.5 min-w-0">
              <div className="font-semibold text-zinc-200">Deterministic Glass Avatar</div>
              <div className="text-[11px] text-zinc-400">
                Generated automatically from the organization name (<span className="text-zinc-300 font-mono">{newOrgName.trim() || 'Optic Organization'}</span>).
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              disabled={!newOrgName.trim()}
            >
              Create Organization
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
