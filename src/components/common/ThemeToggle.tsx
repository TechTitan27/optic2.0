import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-700 ${className}`}
      title={theme === 'dark' ? 'Switch to light mode (uses light logo)' : 'Switch to dark mode (uses dark logo)'}
      aria-label="Toggle color theme"
    >
      {theme === 'dark' ? (
        <Sun size={15} className="text-zinc-400 hover:text-amber-300 transition-colors" />
      ) : (
        <Moon size={15} className="text-zinc-600 hover:text-zinc-900 transition-colors" />
      )}
    </button>
  );
};
