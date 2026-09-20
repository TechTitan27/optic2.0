import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { ApiKeyItem, NewApiKeyResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Key, Plus, Trash2, Copy, Check, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export const ApiKeysView: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<NewApiKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (user?.id) {
      headers['x-user-id'] = user.id;
    }
    return headers;
  };

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keys/list', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      } else {
        setKeys([]);
      }
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [user, accessToken]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/keys/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.key) {
        setGeneratedKey(data.key);
        setNewKeyName('');
        fetchKeys();
      } else {
        setError(data.error || 'Failed to generate API key. Please check server logs.');
      }
    } catch {
      setError('Failed to create key. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to revoke this API key? Applications using it will immediately fail authentication.'
      )
    ) {
      return;
    }
    try {
      await fetch('/api/keys/revoke', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, status: 'revoked' as const } : k))
      );
    } catch {
      fetchKeys();
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this API key record?')) {
      return;
    }
    try {
      await fetch('/api/keys/delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      fetchKeys();
    }
  };

  const copyKey = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">API Keys</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Create and manage keys for accessing Optic APIs, SDKs, and CLI tools.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setGeneratedKey(null);
            setError(null);
            setCreateModalOpen(true);
          }}
          icon={<Plus size={14} />}
        >
          Create API key
        </Button>
      </div>

      {/* Security Architecture Info Banner */}
      <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-start gap-3">
        <ShieldCheck size={16} className="text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <span className="font-semibold text-white">Cryptographic Security Notice:</span> All API keys
          are generated using 32 bytes of cryptographic entropy on the server, SHA-256 hashed before
          storing in Supabase, and the raw key is never stored in plaintext. Sensitive operations run
          strictly server-side.
        </div>
      </div>

      {/* Keys Table Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
            <span>Loading API keys from Supabase database...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
              <Key size={16} />
            </div>
            <p className="text-sm font-semibold text-zinc-200">No API keys</p>
            <p className="text-xs text-zinc-400 max-w-sm">
              Create an API key to deploy websites using the Optic CLI or upload files through the SDK.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setGeneratedKey(null);
                setError(null);
                setCreateModalOpen(true);
              }}
              icon={<Plus size={14} />}
            >
              Create API key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-zinc-400 text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">NAME</th>
                  <th className="py-2.5 px-4 font-semibold">KEY PREFIX</th>
                  <th className="py-2.5 px-4 font-semibold">CREATED</th>
                  <th className="py-2.5 px-4 font-semibold">LAST USED</th>
                  <th className="py-2.5 px-4 font-semibold">STATUS</th>
                  <th className="py-2.5 px-4 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-zinc-200">
                      {k.name}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{k.keyPrefix}</td>
                    <td className="py-3 px-4 text-zinc-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      {k.status === 'active' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-zinc-800 text-zinc-400">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {k.status === 'active' && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="text-xs text-zinc-400 hover:text-amber-400 transition-colors font-sans"
                          >
                            Revoke
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete key record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={generatedKey ? 'API Key Created' : 'Create API Key'}
        description={
          generatedKey
            ? "Copy this key now. It will never be shown again."
            : 'Enter a descriptive name for this key.'
        }
      >
        {generatedKey ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>Important:</strong> Copy this secret key now. Because it is stored as a cryptographic
                SHA-256 hash in Supabase, Optic cannot show it to you again.
              </span>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-400 block mb-1.5 font-sans">
                Your Raw API Key
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-emerald-400 break-all select-all">
                  {generatedKey.rawKey}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyKey(generatedKey.rawKey)}
                  icon={copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setGeneratedKey(null);
                  setCreateModalOpen(false);
                }}
              >
                I have saved my key
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateKey} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Key name
              </label>
              <Input
                placeholder="e.g. CLI Production Deployment"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                required
                autoFocus
                className="text-xs"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
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
                loading={submitting}
              >
                Create API key
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
