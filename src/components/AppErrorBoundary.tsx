import React from 'react';

// Top-level crash net: a render error in any tab/modal used to unmount the
// whole tree into a blank page until the next deploy. This boundary keeps
// the shell alive with a reload affordance instead.
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No backend sink for frontend errors; console keeps it debuggable.
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">😵</div>
          <h1 className="text-xl font-semibold">页面出了点问题</h1>
          <p className="text-sm opacity-60 break-all">{String(this.state.error.message || this.state.error)}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              className="px-4 py-2 rounded-lg border text-sm"
              onClick={() => this.setState({ error: null })}
            >
              重试
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-white/10 text-sm"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
