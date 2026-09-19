import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Optic platform:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full p-6 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h1 className="text-base font-semibold text-white">Something went wrong</h1>
                <p className="text-xs font-mono text-zinc-400">Optic Platform Error Boundary</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 break-words max-h-40 overflow-y-auto">
              {this.state.error?.message || 'An unexpected application error occurred.'}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReload}
                className="flex-1 text-xs"
              >
                <RefreshCw size={13} className="mr-1.5" />
                Reload Window
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleGoHome}
                className="text-xs"
              >
                <Home size={13} className="mr-1.5" />
                Return Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
