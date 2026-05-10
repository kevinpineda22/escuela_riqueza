import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import MotionProvider from "@/components/providers/MotionProvider";
import AuthBootstrap from "@/components/providers/AuthBootstrap";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import "@/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionProvider>
          <TooltipProvider delayDuration={150}>
            <AuthBootstrap>
              <App />
            </AuthBootstrap>
          </TooltipProvider>
        </MotionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
