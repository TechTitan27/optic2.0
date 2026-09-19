import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] duration-150 rounded-lg';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-9',
    lg: 'text-sm px-5 py-2.5 gap-2.5 h-10',
  };

  const variantStyles = {
    primary:
      'bg-zinc-100 text-zinc-950 hover:bg-white border border-zinc-200 shadow-sm font-semibold',
    secondary:
      'bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/60 shadow-sm',
    outline:
      'bg-transparent text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700',
    ghost:
      'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
    danger:
      'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/40',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
};
