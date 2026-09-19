import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightElement, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-zinc-300 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-zinc-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-zinc-900 text-zinc-100 text-sm placeholder:text-zinc-500 rounded-lg border transition-all duration-150 py-2 ${
              leftIcon ? 'pl-9' : 'pl-3'
            } ${rightElement ? 'pr-10' : 'pr-3'} ${
              error
                ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                : 'border-zinc-800 hover:border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30'
            } outline-none disabled:opacity-50 disabled:bg-zinc-950 ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2.5 flex items-center text-zinc-400">
              {rightElement}
            </div>
          )}
        </div>
        {hint && !error && <span className="text-xs text-zinc-500">{hint}</span>}
        {error && <span className="text-xs text-red-400 font-medium">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
