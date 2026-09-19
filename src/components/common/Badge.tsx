import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
  dot = false,
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    outline: 'bg-transparent text-zinc-400 border-zinc-800',
  };

  const dotColors = {
    default: 'bg-zinc-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-red-400',
    info: 'bg-sky-400',
    outline: 'bg-zinc-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border whitespace-nowrap select-none font-mono ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} />}
      <span>{children}</span>
    </span>
  );
};
