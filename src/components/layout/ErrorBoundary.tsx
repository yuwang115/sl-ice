/**
 * React Error Boundary — catches render errors and shows a fallback UI.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center"
          style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
        >
          <div className="text-4xl">&#x26A0;</div>
          <h2 className="text-lg font-medium">Something went wrong</h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="pill-btn active text-sm px-4 py-2"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
