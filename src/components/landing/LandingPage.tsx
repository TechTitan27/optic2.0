import React, { useState } from 'react';
import { Button } from '../common/Button';
import { OpticFooter } from '../common/OpticFooter';
import { SurfaceType } from '../../types';
import { Navbar } from './Navbar';
import { OpticLogo } from '../brand/OpticLogo';
import {
  HardDrive,
  Globe,
  Code2,
  Terminal,
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
  Shield,
  Layers,
  Zap,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateSurface,
  onOpenAuth,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'sdk' | 'cli' | 'curl'>('sdk');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const codeSnippets = {
    sdk: {
      lang: 'typescript',
      label: 'TypeScript SDK (Example)',
      code: `import { Optic } from '@optic/sdk';

const optic = new Optic({
  apiKey: process.env.OPTIC_API_KEY
});

// Upload a release bundle or asset
const file = await optic.files.upload('./image.png', {
  isPublic: true
});

console.log('Public CDN URL:', file.publicUrl);`,
    },
    cli: {
      lang: 'bash',
      label: 'Optic CLI',
      code: `# Deploy the current project directory to Optic Hosting
npx optic deploy

# Check active deployments
npx optic deployments --project my-portfolio`,
    },
    curl: {
      lang: 'bash',
      label: 'cURL HTTP API',
      code: `curl -X POST https://api.optic.doy.best/v1/files \\
  -H "Authorization: Bearer $OPTIC_API_KEY" \\
  -F "file=@./image.png"`,
    },
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const faqs = [
    {
      q: 'Is Optic one account or separate services?',
      a: 'Optic is one unified platform for developers. You have one login, one dashboard, and one API key system that manages both your Cloud storage and Hosting projects.',
    },
    {
      q: 'How does Optic Cloud storage work?',
      a: 'Optic Cloud combines structured database metadata in Supabase with high-performance decoupled object storage (Cloudflare R2/S3). Files are served through global CDN endpoints with instant upload presigned URLs.',
    },
    {
      q: 'Can I connect custom domains to Optic Hosting?',
      a: 'Yes. Every project receives an immediate production subdomain, and you can map any custom domain with automated SSL certificate validation.',
    },
    {
      q: 'How do developer API keys work?',
      a: 'API keys are generated securely in the Dashboard with zero-trust SHA-256 storage. The raw secret is only displayed once and can be used to authenticate the Optic CLI and automated CI/CD pipelines.',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* 1. Navbar */}
      <Navbar onNavigateSurface={onNavigateSurface} onOpenAuth={onOpenAuth} />

      {/* 2. Hero Section */}
      <section className="pt-16 pb-12 sm:pt-24 sm:pb-16 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-[1.15]">
          Cloud infrastructure for developers.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
          Store files, host websites and manage deployments from one place.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            variant="primary"
            onClick={() => onOpenAuth('signup')}
            className="text-sm px-6 py-2.5"
          >
            Get started
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onNavigateSurface('cloud', '/')}
            className="text-sm px-6 py-2.5 border-zinc-800 hover:bg-zinc-900"
          >
            Explore Cloud
          </Button>
        </div>
      </section>

      {/* 3. Optic Platform Intro */}
      <section className="py-14 px-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/20">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <h2 className="text-xs uppercase font-mono tracking-widest text-zinc-400 font-semibold">
            One platform. Your infrastructure.
          </h2>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight max-w-2xl mx-auto">
            Optic gives developers a single place to store files, host projects and manage the infrastructure around them.
          </p>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed pt-1">
            No fragmented accounts. No separate logins. Cloud and Hosting work together under a unified developer identity.
          </p>
        </div>
      </section>

      {/* 4. Cloud + Hosting Product Introduction */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cloud Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-zinc-400 text-xs font-mono font-medium mb-3">
                <HardDrive size={16} className="text-sky-400" />
                <span>CLOUD</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Optic Cloud</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Store, organize and share your files.
              </p>

              <div className="mt-6 pt-6 border-t border-zinc-800/80">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block mb-3">
                  Core capabilities
                </span>
                <ul className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Files
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Folders
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Storage
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Previews
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Sharing
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Storage API
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-800/80">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigateSurface('cloud', '/')}
                className="w-full text-xs"
                icon={<ArrowRight size={14} />}
              >
                Open Cloud
              </Button>
            </div>
          </div>

          {/* Hosting Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-zinc-400 text-xs font-mono font-medium mb-3">
                <Globe size={16} className="text-emerald-400" />
                <span>HOSTING</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Optic Hosting</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Deploy and manage websites and projects.
              </p>

              <div className="mt-6 pt-6 border-t border-zinc-800/80">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block mb-3">
                  Core capabilities
                </span>
                <ul className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Projects
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Deployments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Logs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Domains
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Deployment history
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    Instant Rollbacks
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-800/80">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigateSurface('hosting', '/')}
                className="w-full text-xs"
                icon={<ArrowRight size={14} />}
              >
                Open Hosting
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Developer Code Examples */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Built for developers.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Automate deployments and storage workflows with our CLI and developer SDKs.
            </p>
          </div>

          {/* Code Window */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
            {/* Window Header / Tabs */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCodeTab('sdk')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeCodeTab === 'sdk'
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  TypeScript SDK
                </button>
                <button
                  onClick={() => setActiveCodeTab('cli')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeCodeTab === 'cli'
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Optic CLI
                </button>
                <button
                  onClick={() => setActiveCodeTab('curl')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    activeCodeTab === 'curl'
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  cURL
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                  {codeSnippets[activeCodeTab].label}
                </span>
                <button
                  onClick={() => handleCopyCode(codeSnippets[activeCodeTab].code)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                  aria-label="Copy snippet"
                >
                  {copiedSnippet ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-4 sm:p-5 overflow-x-auto text-xs font-mono leading-relaxed bg-zinc-950 text-zinc-300">
              <pre>
                <code>{codeSnippets[activeCodeTab].code}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Small FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-white tracking-tight text-center mb-8">
          Frequently asked questions
        </h2>

        <div className="divide-y divide-zinc-800/80 border-y border-zinc-800/80">
          {faqs.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div key={index} className="py-4">
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : index)}
                  className="w-full flex items-center justify-between text-left text-sm font-medium text-zinc-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-zinc-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-zinc-300' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed pr-6">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Final CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/40 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Ready to build?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 mb-6">
            Get started with Optic developer infrastructure today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => onOpenAuth('signup')}
              className="text-xs px-5 py-2"
            >
              Get started
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => onNavigateSurface('cloud', '/')}
              className="text-xs px-5 py-2 border-zinc-800 hover:bg-zinc-900"
            >
              Open Cloud
            </Button>
          </div>
        </div>
      </section>

      {/* 8. Proper Optic Global Footer */}
      <OpticFooter onNavigateSurface={onNavigateSurface} />
    </div>
  );
};
