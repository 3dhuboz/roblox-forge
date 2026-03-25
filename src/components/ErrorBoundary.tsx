import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
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
    console.error("RobloxForge crashed:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHardReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-3 text-gray-400">
              RobloxForge hit an unexpected error. Your projects are safe — this
              is just a UI issue.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-gray-900 p-3 text-left text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500"
              >
                <RefreshCw size={16} /> Try Again
              </button>
              <button
                onClick={this.handleHardReset}
                className="rounded-lg border border-gray-700 bg-gray-800 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
              >
                Reset App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
