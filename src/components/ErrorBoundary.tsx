import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render/runtime errors in the 3D viewer subtree and shows a
 * recoverable message instead of a white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#263238',
            color: '#eee',
            gap: '1rem',
            zIndex: 5000,
          }}
        >
          <h2 style={{ margin: 0 }}>Something went wrong in the 3D viewer</h2>
          <p style={{ color: '#aaa', maxWidth: '60ch', textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
