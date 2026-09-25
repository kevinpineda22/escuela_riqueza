import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LiveRoomLayout } from "./liveRoomLayout";

interface LiveChatPanelProps {
  layout: LiveRoomLayout;
  open: boolean;
  children: ReactNode;
}

/**
 * Contenedor del chat según el layout. Hay un solo montaje por layout, para
 * no duplicar la suscripción. Lado a lado queda montado aunque esté plegado
 * (sigue contando no leídos), pero `inert`: cerrado no se puede enfocar ni lo
 * recorre un lector de pantalla (F25).
 */
export function LiveChatPanel({ layout, open, children }: LiveChatPanelProps) {
  if (layout === "stacked") {
    return (
      <div className="flex-1 min-h-0 bg-surface-page border-t border-brand/30 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.7)] light:shadow-[0_-16px_32px_-18px_rgba(60,45,15,0.3)]">
        {children}
      </div>
    );
  }

  return (
    <div
      inert={!open}
      className={cn(
        "bg-surface-page shrink-0 z-50 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
        !open
          ? "w-0 opacity-0"
          : layout === "compact"
            ? "w-[min(20rem,45vw)] opacity-100"
            : "w-80 lg:w-[400px] opacity-100"
      )}
    >
      {children}
    </div>
  );
}
