import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveStageMessageProps {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Mensaje centrado del escenario: finalizada, en pausa, error de reproducción. */
export function LiveStageMessage({ icon: Icon, iconClassName, title, children, action }: LiveStageMessageProps) {
  return (
    <div className="text-center p-8 z-10">
      <Icon size={64} className={cn("mx-auto mb-6", iconClassName)} />
      <h2 className="text-2xl font-bold text-foreground-strong mb-2">{title}</h2>
      {children && <p className={cn("text-foreground-muted max-w-md mx-auto", action && "mb-6")}>{children}</p>}
      {action}
    </div>
  );
}
