import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home, WifiOff } from "lucide-react";
import { reportError, type ReportResult } from "@/lib/errors/errorReporter";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Clasificación y código del registro (null hasta componentDidCatch). */
  report: ReportResult | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, report: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Loguear SIEMPRE (incluso en prod) para poder diagnosticar crashes desde el
    // Web Inspector de Safari iOS conectado por USB.
    console.error("[ErrorBoundary]", error, info);
    const report = reportError(error, {
      source: "boundary",
      detail: { componentStack: info.componentStack?.slice(0, 1500) ?? null },
    });
    this.setState({ report });
  }

  reset = () => this.setState({ hasError: false, error: null, report: null });

  render() {
    if (!this.state.hasError || !this.state.error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return <DefaultErrorFallback error={this.state.error} report={this.state.report} onReset={this.reset} />;
  }
}

interface DefaultFallbackProps {
  error: Error;
  report: ReportResult | null;
  onReset: () => void;
}

const DefaultErrorFallback = ({ error, report, onReset }: DefaultFallbackProps) => {
  // Una pantalla que no cargó por falta de internet no es "algo se rompió".
  const isNetwork = report?.kind === "offline" || report?.kind === "network" || report?.kind === "timeout";
  return (
  <div className="min-h-[100dvh] w-full bg-[#050505] light:bg-surface-page flex flex-col items-center justify-center relative overflow-hidden font-sans px-6 py-12">
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#1a1410_0%,#0a0a0a_50%,#050505_100%)] light:bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#f1e7d0_0%,#f8f6f1_55%,#f8f6f1_100%)]"
    />
    <div
      aria-hidden
      className="hidden md:block absolute -top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(225,80,80,0.15),transparent_60%)] blur-3xl"
    />
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] light:bg-grid-ink bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_30%,transparent_85%)]"
    />

    <div className="relative z-10 max-w-lg w-full bg-surface-page/85 border border-line-subtle rounded-3xl p-8 sm:p-10 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] light:bg-surface-panel light:shadow-panel flex flex-col items-center text-center gap-5">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl scale-150"
        />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-red-700/10 border border-red-500/30 flex items-center justify-center">
          {isNetwork
            ? <WifiOff className="text-danger" size={28} strokeWidth={1.8} />
            : <AlertTriangle className="text-danger" size={28} strokeWidth={1.8} />}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-red-400/80 light:text-danger">
          {isNetwork ? "Problema de conexión" : "Falla de la plataforma"}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground-strong tracking-tight">
          {isNetwork ? "Tu conexión a internet falló" : "Ocurrió un error inesperado"}
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed">
          {isNetwork
            ? "No es un problema de la plataforma: la página no pudo cargar. Revisa tu internet e intenta de nuevo."
            : "No te preocupes, no se perdió tu progreso. Ya quedó registrado; intenta recargar o volver al inicio."}
        </p>
        {report?.code ? (
          <p className="text-sm text-foreground-muted">
            Si nos escribes, comparte este código:{" "}
            <span className="font-mono font-bold tracking-widest text-foreground-strong select-all">{report.code}</span>
          </p>
        ) : null}
      </div>

      {import.meta.env.DEV && (
        <pre className="w-full text-left text-xs text-red-300/80 light:text-danger bg-red-500/5 border border-red-500/20 rounded-xl p-3 overflow-auto max-h-32 font-mono">
          {error.message}
        </pre>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-bold text-sm transition-all shadow-[0_6px_22px_-6px_rgba(204,164,59,0.7)] hover:-translate-y-0.5"
        >
          <RefreshCcw size={16} /> Intentar de nuevo
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink/[0.04] hover:bg-ink/[0.08] border border-line-subtle text-fg-80 hover:text-foreground-strong font-medium text-sm transition-all"
        >
          <Home size={16} /> Volver al inicio
        </a>
      </div>
    </div>
  </div>
  );
};

export default ErrorBoundary;
