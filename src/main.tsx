import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import MotionProvider from "@/components/providers/MotionProvider";
import AuthBootstrap from "@/components/providers/AuthBootstrap";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import PodcastEngine from "@/components/feature/PodcastEngine";
import ThemeSync from "@/components/providers/ThemeSync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { installGlobalErrorCapture } from "@/lib/errors/errorReporter";
import "@/index.css";

installGlobalErrorCapture();

// Las páginas se descargan al visitarlas. Si se publicó una versión nueva con la
// pestaña abierta, los archivos de la vieja ya no existen y la navegación caería
// en el ErrorBoundary: recargar trae la versión nueva. Una vez por minuto como
// mucho, para no entrar en bucle si la falla es la red y no el deploy.
const RELOAD_GUARD_KEY = "chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY));
    if (last && Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return; // sin sessionStorage no hay cómo evitar el bucle: que lo maneje el ErrorBoundary
  }
  event.preventDefault();
  window.location.reload();
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    {/* Hermano, no envoltorio: el fallback de error también recibe el tema. */}
    <ThemeSync />
    <ErrorBoundary>
      <>
        <PodcastEngine />
        <QueryClientProvider client={queryClient}>
          <MotionProvider>
            <TooltipProvider delayDuration={150}>
              <AuthBootstrap>
                <App />
              </AuthBootstrap>
            </TooltipProvider>
          </MotionProvider>
        </QueryClientProvider>
      </>
    </ErrorBoundary>
  </StrictMode>
);
