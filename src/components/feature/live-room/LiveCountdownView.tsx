import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountdown } from "./useCountdown";
import type { LiveEvent } from "@/lib/api/stream/lives";

interface LiveCountdownViewProps {
  live: LiveEvent;
  label?: string;
  titleFallback: ReactNode;
  /**
   * Poca altura (celular en horizontal). Los tamaños `sm:`/`md:` se disparan
   * por ancho: en un 844×390 armaban cajas de 176 px y un título de 72 px que
   * no entraban. En compacto se usan los de celular.
   */
  compact?: boolean;
}

/** Espera antes del inicio: título, descripción y cuenta regresiva. */
export function LiveCountdownView({ live, label, titleFallback, compact = false }: LiveCountdownViewProps) {
  const timeLeft = useCountdown(live.starts_at ? new Date(live.starts_at).getTime() : 0);

  return (
    <>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "inline-flex items-center gap-2 bg-brand/5 border border-brand/20 rounded-full",
            compact ? "mb-3 px-4 py-1.5" : "mb-6 sm:mb-12 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5"
          )}
        >
          <Calendar size={14} className="text-accent" />
          <span className={cn("font-bold text-accent/80 tracking-widest uppercase", compact ? "text-[11px]" : "text-[11px] sm:text-sm")}>
            {label}
          </span>
        </motion.div>
      )}

      <h2
        className={cn(
          "font-black text-foreground-strong tracking-tight leading-[1.1] text-balance",
          compact ? "text-2xl mb-3" : "text-3xl sm:text-5xl md:text-7xl mb-6 sm:mb-8 md:tracking-tighter"
        )}
      >
        {live.title || titleFallback}
      </h2>

      {live.description && (
        <p
          className={cn(
            "text-foreground-muted max-w-2xl mx-auto font-medium leading-relaxed text-balance",
            compact ? "text-sm mb-4 line-clamp-2" : "mb-10 sm:mb-16 text-sm sm:text-lg md:text-xl"
          )}
        >
          {live.description}
        </p>
      )}

      {live.starts_at ? (
        <div className={cn("flex justify-center", compact ? "gap-2" : "gap-2 sm:gap-4 md:gap-10")}>
          {[
            { val: timeLeft.hours, label: "Horas" },
            { val: timeLeft.minutes, label: "Minutos" },
            { val: timeLeft.seconds, label: "Segundos", highlight: true },
          ].map((unit) => (
            <div key={unit.label} className="flex flex-col items-center">
              <div
                className={cn(
                  "relative flex items-center justify-center border border-line-subtle overflow-hidden shadow-2xl transition-all duration-500",
                  compact ? "w-14 h-16 rounded-2xl" : "w-16 h-20 sm:w-24 sm:h-32 md:w-36 md:h-44 rounded-2xl sm:rounded-3xl",
                  unit.highlight ? "bg-brand/10 border-brand/30" : "bg-ink/5"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <span
                  className={cn(
                    "font-black font-mono tracking-tighter",
                    compact ? "text-2xl" : "text-3xl sm:text-5xl md:text-8xl",
                    unit.highlight ? "text-accent" : "text-foreground-strong"
                  )}
                >
                  {unit.val.toString().padStart(2, "0")}
                </span>
              </div>
              <span
                className={cn(
                  "text-[9px] text-foreground-muted uppercase font-black",
                  compact ? "tracking-[0.25em] mt-2" : "sm:text-[10px] tracking-[0.25em] sm:tracking-[0.3em] mt-3 sm:mt-5"
                )}
              >
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={cn("text-fg-60 font-bold", compact ? "text-lg" : "text-xl sm:text-2xl")}>Próximamente</p>
      )}
    </>
  );
}
