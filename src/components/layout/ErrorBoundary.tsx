import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError || !this.state.error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />;
  }
}

interface DefaultFallbackProps {
  error: Error;
  onReset: () => void;
}

const DefaultErrorFallback = ({ error, onReset }: DefaultFallbackProps) => (
  <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden font-sans px-6 py-12">
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#1a1410_0%,#0a0a0a_50%,#050505_100%)]"
    />
    <div
      aria-hidden
      className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(225,80,80,0.15),transparent_60%)] blur-3xl"
    />
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_30%,transparent_85%)]"
    />

    <div className="relative z-10 max-w-lg w-full bg-darker/85 border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-5">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl scale-150"
        />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-red-700/10 border border-red-500/30 flex items-center justify-center">
          <AlertTriangle className="text-red-400" size={28} strokeWidth={1.8} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-red-400/80">
          Algo se rompió
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ocurrió un error inesperado
        </h1>
        <p className="text-sm text-textMuted leading-relaxed">
          No te preocupes, no se perdió tu progreso. Probá recargar o volver al
          inicio. Si el problema persiste, contáctanos.
        </p>
      </div>

      {import.meta.env.DEV && (
        <pre className="w-full text-left text-xs text-red-300/80 bg-red-500/5 border border-red-500/20 rounded-xl p-3 overflow-auto max-h-32 font-mono">
          {error.message}
        </pre>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm transition-all shadow-[0_6px_22px_-6px_rgba(204,164,59,0.7)] hover:-translate-y-0.5"
        >
          <RefreshCcw size={16} /> Intentar de nuevo
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 hover:text-white font-medium text-sm transition-all"
        >
          <Home size={16} /> Volver al inicio
        </a>
      </div>
    </div>
  </div>
);

export default ErrorBoundary;
