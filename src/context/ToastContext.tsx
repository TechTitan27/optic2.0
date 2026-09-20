import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  error: (message: string, title?: string, duration?: number) => string;
  success: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let globalToastHandler: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export const notifyToast = (toast: Omit<ToastItem, 'id'>) => {
  if (globalToastHandler) {
    globalToastHandler(toast);
  } else {
    console.warn('[Toast fallback]:', toast.type, toast.title, toast.message);
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = type === 'error' ? 7000 : 4500 }: Omit<ToastItem, 'id'>) => {
      const id = 'toast_' + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]); // Keep maximum 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
      return id;
    },
    [dismiss]
  );

  const error = useCallback(
    (message: string, title: string = 'Error', duration?: number) => {
      return showToast({ type: 'error', title, message, duration });
    },
    [showToast]
  );

  const success = useCallback(
    (message: string, title: string = 'Success', duration?: number) => {
      return showToast({ type: 'success', title, message, duration });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title: string = 'Warning', duration?: number) => {
      return showToast({ type: 'warning', title, message, duration });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title: string = 'Information', duration?: number) => {
      return showToast({ type: 'info', title, message, duration });
    },
    [showToast]
  );

  // Bind global handler
  React.useEffect(() => {
    globalToastHandler = showToast;
    return () => {
      globalToastHandler = null;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        error,
        success,
        warning,
        info,
        dismiss,
        clear,
      }}
    >
      {children}

      {/* Floating Toast Notification Container */}
      <div
        id="toast-notification-root"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const isError = item.type === 'error';
          const isSuccess = item.type === 'success';
          const isWarning = item.type === 'warning';
          const isInfo = item.type === 'info';

          return (
            <div
              key={item.id}
              id={`toast-${item.id}`}
              className={`pointer-events-auto rounded-xl p-3.5 border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
                isError
                  ? 'bg-zinc-950/95 border-red-500/40 text-red-100 shadow-red-950/20'
                  : isSuccess
                  ? 'bg-zinc-950/95 border-emerald-500/40 text-emerald-100 shadow-emerald-950/20'
                  : isWarning
                  ? 'bg-zinc-950/95 border-amber-500/40 text-amber-100 shadow-amber-950/20'
                  : 'bg-zinc-950/95 border-sky-500/40 text-sky-100 shadow-sky-950/20'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isError && <AlertCircle size={18} className="text-red-400" />}
                {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
                {isWarning && <AlertTriangle size={18} className="text-amber-400" />}
                {isInfo && <Info size={18} className="text-sky-400" />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                {item.title && (
                  <h4
                    className={`text-xs font-semibold mb-0.5 ${
                      isError
                        ? 'text-red-300'
                        : isSuccess
                        ? 'text-emerald-300'
                        : isWarning
                        ? 'text-amber-300'
                        : 'text-sky-300'
                    }`}
                  >
                    {item.title}
                  </h4>
                )}
                <p className="text-xs text-zinc-300 leading-relaxed font-sans break-words select-text">
                  {item.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 text-zinc-400 hover:text-zinc-100 p-1 rounded-md hover:bg-zinc-800/60 transition-colors"
                title="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
