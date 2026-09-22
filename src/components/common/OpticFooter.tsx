import React from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { SurfaceType } from '../../types';

interface OpticFooterProps {
  onNavigateSurface: (
    surface: SurfaceType,
    path?: string,
    tab?: 'overview' | 'keys' | 'settings'
  ) => void;
  compact?: boolean;
}

export const OpticFooter: React.FC<OpticFooterProps> = ({
  onNavigateSurface,
  compact = false,
}) => {
  if (compact) {
    return (
      <footer className="border-t border-zinc-800/80 bg-black text-zinc-400 py-6 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <OpticLogo size={18} showWordmark={true} />
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500 text-[11px]">Developer Cloud & Hosting</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-400">
            <button
              onClick={() => onNavigateSurface('cloud', '/')}
              className="hover:text-zinc-200 transition-colors"
            >
              Cloud
            </button>
            <button
              onClick={() => onNavigateSurface('hosting', '/')}
              className="hover:text-zinc-200 transition-colors"
            >
              Hosting
            </button>
            <button
              onClick={() => onNavigateSurface('docs', '/')}
              className="hover:text-zinc-200 transition-colors"
            >
              Docs
            </button>
            <span>•</span>
            <button
              onClick={() => onNavigateSurface('privacy', '/privacy')}
              className="hover:text-zinc-200 transition-colors"
            >
              Privacy
            </button>
            <button
              onClick={() => onNavigateSurface('terms', '/terms')}
              className="hover:text-zinc-200 transition-colors"
            >
              Terms
            </button>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">
            © 2026 Optic. All rights reserved.
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-zinc-800/80 bg-black text-zinc-400 py-14 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        {/* Brand Col */}
        <div className="col-span-2 space-y-4">
          <OpticLogo size={24} showWordmark={true} />
          <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
            Developer-first cloud storage and high-performance static hosting platform. S3-compatible buckets, edge deployment network, instant rollbacks, and zero configuration workflows.
          </p>
        </div>

        {/* Product */}
        <div>
          <h4 className="text-[11px] font-mono text-zinc-300 font-semibold uppercase tracking-wider mb-3">
            PRODUCTS
          </h4>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li>
              <button
                onClick={() => onNavigateSurface('cloud', '/')}
                className="hover:text-zinc-200 transition-colors"
              >
                Optic Cloud (S3 Storage)
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('hosting', '/')}
                className="hover:text-zinc-200 transition-colors"
              >
                Optic Hosting
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('cloud', '/')}
                className="hover:text-zinc-200 transition-colors"
              >
                Buckets &amp; Folders
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('hosting', '/')}
                className="hover:text-zinc-200 transition-colors"
              >
                Deployments &amp; Domains
              </button>
            </li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h4 className="text-[11px] font-mono text-zinc-300 font-semibold uppercase tracking-wider mb-3">
            DEVELOPERS
          </h4>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li>
              <button
                onClick={() => onNavigateSurface('docs', '/')}
                className="hover:text-zinc-200 transition-colors"
              >
                Documentation
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('docs', '/api')}
                className="hover:text-zinc-200 transition-colors"
              >
                API Reference
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('docs', '/cli')}
                className="hover:text-zinc-200 transition-colors"
              >
                CLI &amp; SDKs
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('dashboard', '/dashboard/keys', 'keys')}
                className="hover:text-zinc-200 transition-colors"
              >
                API Keys
              </button>
            </li>
          </ul>
        </div>

        {/* Legal & Account */}
        <div>
          <h4 className="text-[11px] font-mono text-zinc-300 font-semibold uppercase tracking-wider mb-3">
            COMPANY &amp; LEGAL
          </h4>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li>
              <button
                onClick={() => onNavigateSurface('privacy', '/privacy')}
                className="hover:text-zinc-200 transition-colors"
              >
                Privacy Policy
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('terms', '/terms')}
                className="hover:text-zinc-200 transition-colors"
              >
                Terms of Service
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('login', '/login')}
                className="hover:text-zinc-200 transition-colors"
              >
                Developer Login
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateSurface('signup', '/signup')}
                className="hover:text-zinc-200 transition-colors"
              >
                Create Account
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-xs">
        <div>© 2026 Optic Inc. Cloud infrastructure &amp; hosting engineered for developers.</div>
        <div className="flex items-center gap-4 text-[11px]">
          <button
            onClick={() => onNavigateSurface('privacy', '/privacy')}
            className="hover:text-zinc-300 transition-colors"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            onClick={() => onNavigateSurface('terms', '/terms')}
            className="hover:text-zinc-300 transition-colors"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button
            onClick={() => onNavigateSurface('docs', '/')}
            className="hover:text-zinc-300 transition-colors"
          >
            Documentation
          </button>
        </div>
      </div>
    </footer>
  );
};
