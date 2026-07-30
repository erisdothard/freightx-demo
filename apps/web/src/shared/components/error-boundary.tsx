import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-dvh bg-fx-bg flex items-center justify-center px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fx-text mb-1">Something went wrong</h2>
              <p className="text-sm text-fx-text-dim">
                {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fx-orange text-white text-sm font-medium transition-opacity hover:opacity-90"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
