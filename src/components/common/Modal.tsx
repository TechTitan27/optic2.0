import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthStyles[maxWidth]} rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 text-zinc-100 z-10`}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-zinc-400 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
