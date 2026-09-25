import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIVE_LOGO_URL } from "./constants";
import type { LiveRoomBackLink } from "./types";

interface LiveRoomHeaderProps {
  title: string;
  titleSuffix?: ReactNode;
  subtitle?: string;
  backTo: LiveRoomBackLink;
  badge: ReactNode;
  /** 0 oculta el botón de conectados. */
  viewersCount: number;
  onOpenViewers: () => void;
  /**
   * `overlay` flota sobre el escenario (escritorio). `bar` es una barra propia
   * arriba del video (celular vertical): con el video a su proporción real ya
   * no hay franja negra que la aloje, y flotando taparía la clase (F12).
   * `compact` flota con lo mínimo — volver, estado, conectados — para no
   * comerse la poca altura de un celular en horizontal.
   */
  variant: "overlay" | "bar" | "compact";
}

/** Header de la sala: volver, logo, título, estado y conectados. */
export function LiveRoomHeader({ title, titleSuffix, subtitle, backTo, badge, viewersCount, onOpenViewers, variant }: LiveRoomHeaderProps) {
  const navigate = useNavigate();
  const isOverlay = variant === "overlay";
  const isCompact = variant === "compact";

  return (
    <motion.div
      initial={isOverlay ? { y: -100 } : false}
      animate={{ y: 0 }}
      className={cn(
        "w-full z-40 flex justify-between gap-3",
        isOverlay && "absolute top-0 left-0 p-3 sm:p-5 md:p-8 items-start pointer-events-none",
        isCompact && "absolute top-0 left-0 p-2 items-start pointer-events-none",
        variant === "bar" && "relative shrink-0 px-3 py-2 items-center bg-black border-b border-line-subtle"
      )}
    >
      <div className={cn("flex items-center gap-2 sm:gap-4 pointer-events-auto min-w-0", !isCompact && "flex-1")}>
        <button
          onClick={() => navigate(backTo.path)}
          aria-label={backTo.label}
          className={cn(
            "flex items-center justify-center bg-black/50 backdrop-blur-md border border-line-subtle text-fg-80 hover:text-foreground-strong hover:bg-black/70 transition-colors shrink-0",
            // En la barra del celular, objetivo táctil de 44 px (F13).
            variant === "bar" ? "w-11 h-11 rounded-xl" : "p-2 sm:p-2.5 rounded-xl sm:rounded-2xl"
          )}
        >
          <ArrowLeft size={18} />
        </button>
        {variant === "overlay" && (
          <div className="p-2 sm:p-2.5 bg-black/40 backdrop-blur-md border border-line-subtle rounded-xl sm:rounded-2xl shrink-0">
            <img src={LIVE_LOGO_URL} alt="Logo" className="h-7 sm:h-10 object-contain" />
          </div>
        )}
        {isCompact ? (
          // El título no entra en compacto: queda disponible para lectores.
          <h1 className="sr-only">{title}</h1>
        ) : variant === "bar" ? (
          // F13: en celular el título estaba oculto y el alumno no veía qué
          // clase miraba. Ocupa el lugar del logo, en una línea.
          <h1 className="min-w-0 truncate text-sm font-bold leading-tight text-foreground-strong">
            {title}
            {titleSuffix && <> <span className="text-accent">{titleSuffix}</span></>}
          </h1>
        ) : (
          <div className="hidden md:block min-w-0">
            <h1 className="font-extrabold text-base lg:text-xl leading-tight text-foreground-strong tracking-tight drop-shadow-2xl truncate">
              {title}
              {titleSuffix && <> <span className="text-accent">{titleSuffix}</span></>}
            </h1>
            {subtitle && (
              <div className="flex items-center gap-2 mt-1">
                <Sparkles size={12} className="text-accent" />
                <span className="text-[10px] text-fg-60 uppercase font-black tracking-[0.2em]">{subtitle}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex pointer-events-auto shrink-0", isOverlay ? "flex-col items-end gap-2 sm:gap-3" : "items-center gap-2")}>
        {badge}
        {viewersCount > 0 && (
          <button
            onClick={onOpenViewers}
            aria-label={`${viewersCount} conectados`}
            className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md border border-brand/20 text-fg-85 hover:text-accent hover:border-brand/50 hover:bg-black/70 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-wide active:scale-95 transition-all"
          >
            <Users size={12} className="text-accent" />
            <span>{viewersCount}</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
