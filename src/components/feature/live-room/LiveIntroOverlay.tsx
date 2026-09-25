import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LIVE_LOGO_URL } from "./constants";
import type { LiveStatus } from "@/lib/api/stream/lives";

interface LiveIntroOverlayProps {
  liveId: string;
  status: LiveStatus;
}

/** Intro cinemática de 3,5 s cuando la sala pasa a en vivo (sala VIP). */
export function LiveIntroOverlay({ liveId, status }: LiveIntroOverlayProps) {
  const [showIntro, setShowIntro] = useState(false);
  const [seen, setSeen] = useState<{ liveId: string; status: LiveStatus } | null>(null);

  // Se dispara en el render al detectar la transición a "live" (o al entrar a
  // una sala que ya está en vivo), sin un efecto que encadene otro render.
  if (seen?.liveId !== liveId || seen.status !== status) {
    setSeen({ liveId, status });
    if (status === "live") setShowIntro(true);
  }

  useEffect(() => {
    if (!showIntro) return;
    const t = setTimeout(() => setShowIntro(false), 3500);
    return () => clearTimeout(t);
  }, [showIntro]);

  return (
    <AnimatePresence>
      {showIntro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-brand blur-[100px] opacity-20 animate-pulse" />
            <img src={LIVE_LOGO_URL} alt="Logo" className="h-32 object-contain relative z-10" />
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-8 text-center z-10"
          >
            <h2 className="text-2xl font-bold text-accent tracking-[0.3em] uppercase mb-2">Conectando señal</h2>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="w-1 h-4 bg-brand rounded-full"
                />
              ))}
            </div>
          </motion.div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
