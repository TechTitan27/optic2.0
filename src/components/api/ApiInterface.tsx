import React, { useState } from 'react';
import { SurfaceType } from '../../types';
import { Button } from '../common/Button';
import { CodeBlock } from '../common/CodeBlock';
import { ApiKeysView } from '../dashboard/ApiKeysView';
import { useAuth } from '../../context/AuthContext';
import {
  Key,
  Code2,
  Terminal,
  Server,
  BookOpen,
  LayoutDashboard,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Database,
  ArrowRight,
} from 'lucide-react';

interface ApiInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export const ApiInterface: React.FC<ApiInterfaceProps> = ({
  onNavigateSurface,
  onOpenAuth,
}) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'keys' | 'quickstart' | 'endpoints'>('keys');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const curlExample = `# 1. Authenticate with your Optic API Key
curl -X GET https://api.optic.doy.best/v1/keys/list \\
  -H "Authorization: Bearer opt_live_YOUR_KEY" \\
  -H "Content-Type: application/json"

# 2. Upload an object to Optic Cloud Storage
curl -X POST https://api.optic.doy.best/v1/files/upload \\
  -H "Authorization: Bearer opt_live_YOUR_KEY" \\
  -F "file=@./dist.zip" \\
  -F "isPublic=true"`;

  const nodeExample = `import { Optic } from '@optic/sdk';

const optic = new Optic({
  apiKey: process.env.OPTIC_API_KEY, // opt_live_...
  baseUrl: 'https://api.optic.doy.best/v1',
});

// List your cloud storage files
const { files } = await optic.cloud.listFiles({ limit: 20 });
console.log('Files in storage:', files);

// Trigger a new deployment on Optic Hosting
const deployment = await optic.hosting.deploy({
  projectId: 'proj_my_portfolio',
  branch: 'main',
});
console.log('Deployment URL:', deployment.url);`;

  const pythonExample = `import requests

OPTIC_API_KEY = "opt_live_YOUR_KEY"
BASE_URL = "https://api.optic.doy.best/v1"

headers = {
    "Authorization": f"Bearer {OPTIC_API_KEY}",
    "Content-Type": "application/json"
}

# Fetch deployment logs
response = requests.get(f"{BASE_URL}/deployments", headers=headers)
print(response.json())`;

  return (
    <div className="w-full space-y-8 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Main API Platform Body */}
      <div className="space-y-8">
        {/* Subdomain Notice & Hero */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Optic Developer API
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Programmatic access to Optic Cloud Storage, Deployments, and Key Management.
            Use API keys with standard Bearer authentication to integrate Optic into your CI/CD pipelines and backend workflows.
          </p>
        </div>

        {/* Surface Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'keys'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Key size={14} />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'quickstart'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Terminal size={14} />
            <span>Quickstart & SDK</span>
          </button>
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'endpoints'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Code2 size={14} />
            <span>Endpoints Reference</span>
          </button>
        </div>

        {/* Tab 1: API Keys (Existing Developer Area) */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            {!user ? (
              <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-sky-400">
                  <Key size={22} />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Sign in to generate API Keys
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Authenticate with your Optic account to create live secret keys for Optic CLI, Cloud storage uploads, and automated deployments.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenAuth ? onOpenAuth('signup') : onNavigateSurface('signup', '/signup')}
                  >
                    Create Account
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenAuth ? onOpenAuth('signin') : onNavigateSurface('login', '/login')}
                  >
                    Log In
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <ApiKeysView />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Quickstart & SDK */}
        {activeTab === 'quickstart' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Terminal size={14} className="text-emerald-400" />
                  cURL HTTP Request
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(curlExample, 'curl')}
                  icon={copiedCode === 'curl' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  className="text-xs h-7"
                >
                  {copiedCode === 'curl' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <CodeBlock code={curlExample} language="bash" />
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Code2 size={14} className="text-sky-400" />
                  TypeScript / Node.js SDK
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(nodeExample, 'node')}
                  icon={copiedCode === 'node' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  className="text-xs h-7"
                >
                  {copiedCode === 'node' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <CodeBlock code={nodeExample} language="typescript" />
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Terminal size={14} className="text-amber-400" />
                  Python Example
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(pythonExample, 'python')}
                  icon={copiedCode === 'python' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  className="text-xs h-7"
                >
                  {copiedCode === 'python' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <CodeBlock code={pythonExample} language="python" />
            </div>
          </div>
        )}

        {/* Tab 3: Endpoints Reference */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <h3 className="text-sm font-semibold text-white">Core API Endpoints</h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      POST
                    </span>
                    <span className="text-zinc-200">https://api.optic.doy.best/v1/keys/create</span>
                  </div>
                  <span className="text-zinc-500 font-sans">Generate new scoped API key</span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-bold">
                      GET
                    </span>
                    <span className="text-zinc-200">https://api.optic.doy.best/v1/keys/list</span>
                  </div>
                  <span className="text-zinc-500 font-sans">List active keys for account</span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                      POST
                    </span>
                    <span className="text-zinc-200">https://api.optic.doy.best/v1/keys/revoke</span>
                  </div>
                  <span className="text-zinc-500 font-sans">Revoke an active key</span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      POST
                    </span>
                    <span className="text-zinc-200">https://api.optic.doy.best/v1/files/upload</span>
                  </div>
                  <span className="text-zinc-500 font-sans">Stream object upload to Cloud Storage</span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-bold">
                      GET
                    </span>
                    <span className="text-zinc-200">https://api.optic.doy.best/v1/deployments</span>
                  </div>
                  <span className="text-zinc-500 font-sans">List project deployment history</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateSurface('docs', '/docs')}
                  icon={<ExternalLink size={12} />}
                  className="text-xs"
                >
                  View full documentation in Optic Docs
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
