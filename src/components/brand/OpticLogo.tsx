import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface OpticLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  surfaceLabel?: string;
  mode?: 'dark' | 'light' | 'auto';
  rounded?: boolean;
}

export const OpticLogo: React.FC<OpticLogoProps> = ({
  className = '',
  size = 24,
  showWordmark = true,
  surfaceLabel,
  mode = 'auto',
  rounded = true,
}) => {
  const { theme } = useTheme();

  // Determine effective theme: explicit prop or context-driven
  const effectiveMode = mode === 'auto' ? theme : mode;
  const isDark = effectiveMode === 'dark';

  // Selected logo asset according to user instruction:
  // Dark background logo for dark mode, light background logo with blue gradient for light mode
  const logoSrc = isDark ? '/assets/logo-dark.png' : '/assets/logo-light.png';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
      {/* Precision Logo Image (Dark or Light) */}
      <div
        className={`shrink-0 overflow-hidden flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${
          rounded ? 'rounded-md' : 'rounded-none'
        } ${
          isDark
            ? 'bg-black border border-zinc-800/80 shadow-sm shadow-black/40'
            : 'bg-white border border-zinc-200 shadow-sm shadow-zinc-200/60'
        }`}
        style={{ width: size, height: size }}
      >
        <img
          src={logoSrc}
          alt={isDark ? 'Optic Dark Logo' : 'Optic Light Logo'}
          width={size}
          height={size}
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </div>

      {/* Wordmark and optional surface label */}
      {showWordmark && (
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-semibold tracking-tight text-[17px] font-sans transition-colors duration-200 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}
          >
            OPTIC
          </span>
          {surfaceLabel && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors duration-200 ${
                isDark
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                  : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
              }`}
            >
              {surfaceLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
