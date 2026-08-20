'use client';

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    const tag = this.props.moduleName ? ' - ' + this.props.moduleName : '';
    console.error('[ErrorBoundary]' + tag + ':', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 m-4 bg-[#18181c] border border-[#ef4444]/30 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider">
              {(this.props.moduleName || 'Module') + ' Error'}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mb-3">
            Something went wrong while rendering this module. The error has been logged.
          </p>
          <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-2 mb-3">
            <code className="text-[10px] text-[#f97316] font-mono-data">
              {(this.state.error && this.state.error.message) || 'Unknown error'}
            </code>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444] rounded text-xs font-medium hover:bg-[#ef4444]/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
