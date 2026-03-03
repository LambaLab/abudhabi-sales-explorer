import { Component } from 'react'

/**
 * ErrorBoundary — catches render errors so the whole app doesn't go blank.
 * React 18 requires a class component for getDerivedStateFromError.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message:  error?.message ?? String(error),
      stack:    error?.stack   ?? '',
    }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
          <div className="text-center space-y-4 px-6 max-w-lg w-full">
            <div className="text-5xl select-none">🐙</div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              An unexpected error occurred. Try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
            {/* Error details — helps diagnose the root cause */}
            {this.state.message && (
              <details className="text-left mt-4">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                  Error details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-red-500 dark:text-red-400 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {this.state.message}
                  {this.state.stack ? `\n\n${this.state.stack}` : ''}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
