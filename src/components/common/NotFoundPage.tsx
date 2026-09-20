import React from 'react';
import { Button } from './Button';
import { OpticLogo } from '../brand/OpticLogo';
import { ArrowLeft, Home, Compass, BookOpen } from 'lucide-react';
import type { SurfaceType } from '../../types';

interface NotFoundPageProps {
  onNavigate: (surface: SurfaceType, path?: string) => void;
  path?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate, path }) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center mb-2">
          <OpticLogo size={40} showWordmark={true} />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            HTTP 404 • Endpoint Not Found
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Page Not Found
          </h1>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            The endpoint <code className="text-zinc-200 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{path || window.location.pathname}</code> does not exist on Optic or may have moved.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="text-xs text-zinc-400 text-left font-mono mb-2">
            Available surfaces:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs font-mono"
              onClick={() => onNavigate('dashboard', '/dashboard')}
              icon={<Compass size={14} />}
            >
              /dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs font-mono"
              onClick={() => onNavigate('cloud', '/cloud')}
              icon={<Compass size={14} />}
            >
              /cloud
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs font-mono"
              onClick={() => onNavigate('hosting', '/hosting')}
              icon={<Compass size={14} />}
            >
              /hosting
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs font-mono"
              onClick={() => onNavigate('docs', '/docs')}
              icon={<BookOpen size={14} />}
            >
              /docs
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('main', '/')}
            icon={<Home size={14} />}
          >
            Return to Homepage
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            icon={<ArrowLeft size={14} />}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};
