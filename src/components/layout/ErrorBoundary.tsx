/**
 * React Error Boundary — catches render errors and shows a fallback UI.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useUIStore } from '../../store/ui-store';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Messages browsers use when a dynamically imported chunk fails to load. */
const CHUNK_LOAD_ERROR =
  /dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    // React.lazy caches a failed import, so re-rendering would only throw it
    // again; a reload fetches the chunk anew.
    if (this.state.error && CHUNK_LOAD_ERROR.test(this.state.error.message)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isZh = useUIStore.getState().language === 'zh';
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center"
          style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
        >
          <div className="text-4xl">&#x26A0;</div>
          <h2 className="text-lg font-medium">{isZh ? '出错了' : 'Something went wrong'}</h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
            {this.state.error?.message || (isZh ? '发生了意外错误。' : 'An unexpected error occurred.')}
          </p>
          <button
            onClick={this.handleReset}
            className="pill-btn active text-sm px-4 py-2"
          >
            {isZh ? '重试' : 'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
