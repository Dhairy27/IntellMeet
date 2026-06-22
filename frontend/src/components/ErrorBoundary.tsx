import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden text-slate-100">
          {/* Background gradients */}
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-rose-900/10 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-slate-900/20 blur-[120px]" />

          <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative border border-rose-500/20 bg-slate-900/30 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 rounded-2xl mb-4 border border-rose-500/20">
              <ShieldAlert className="h-8 w-8 text-rose-400" />
            </div>
            
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              Application Runtime Error
            </h1>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              A critical React runtime crash was intercepted. The error details have been logged. Please try reloading the workspace.
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-left text-xs mb-6 overflow-x-auto font-mono text-rose-300 max-h-40">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
