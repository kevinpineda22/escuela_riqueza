import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import MotionProvider from "@/components/providers/MotionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import "@/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <TooltipProvider delayDuration={150}>
          <App />
        </TooltipProvider>
      </MotionProvider>
    </QueryClientProvider>
  </StrictMode>
);
