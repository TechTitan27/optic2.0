import React, { useState } from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { SurfaceType } from '../../types';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigateSurface,
  onOpenAuth,
}) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Optic Logo + Name */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => onNavigateSurface('main', '/')}
            className="flex items-center focus:outline-none"
            aria-label="Optic home"
          >
            <OpticLogo size={22} showWordmark={true} />
          </button>

          {/* Center Navigation: Cloud, Hosting, Docs, Pricing */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            <button
              onClick={() => onNavigateSurface('cloud', '/')}
              className="hover:text-zinc-100 transition-colors"
            >
              Cloud
            </button>
            <button
              onClick={() => onNavigateSurface('hosting', '/')}
              className="hover:text-zinc-100 transition-colors"
            >
              Hosting
            </button>
            <button
              onClick={() => onNavigateSurface('docs', '/')}
              className="hover:text-zinc-100 transition-colors"
            >
              Docs
            </button>
            <a
              href="#pricing"
              className="hover:text-zinc-100 transition-colors"
            >
              Pricing
            </a>
          </nav>
        </div>

        {/* Right Actions: Log in, Get started + Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateSurface('dashboard', '/dashboard')}
                className="text-xs"
              >
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenAuth('signin')}
                className="text-xs text-zinc-300 hover:text-white"
              >
                Log in
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenAuth('signup')}
                className="text-xs"
              >
                Get started
              </Button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateSurface('dashboard', '/dashboard')}
              className="text-xs"
            >
              Dashboard
            </Button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3">
          <nav className="flex flex-col gap-1 text-sm text-zinc-300">
            <button
              onClick={() => {
                onNavigateSurface('cloud', '/');
                setMobileMenuOpen(false);
              }}
              className="p-2 rounded-md hover:bg-zinc-900 text-left font-medium"
            >
              Cloud
            </button>
            <button
              onClick={() => {
                onNavigateSurface('hosting', '/');
                setMobileMenuOpen(false);
              }}
              className="p-2 rounded-md hover:bg-zinc-900 text-left font-medium"
            >
              Hosting
            </button>
            <button
              onClick={() => {
                onNavigateSurface('docs', '/');
                setMobileMenuOpen(false);
              }}
              className="p-2 rounded-md hover:bg-zinc-900 text-left font-medium"
            >
              Docs
            </button>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-md hover:bg-zinc-900 text-left font-medium"
            >
              Pricing
            </a>
          </nav>

          <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
            {user ? (
              <>
                <Button
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => {
                    onNavigateSurface('dashboard', '/dashboard');
                    setMobileMenuOpen(false);
                  }}
                >
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-xs text-zinc-400"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => {
                    onOpenAuth('signin');
                    setMobileMenuOpen(false);
                  }}
                >
                  Log in
                </Button>
                <Button
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => {
                    onOpenAuth('signup');
                    setMobileMenuOpen(false);
                  }}
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
