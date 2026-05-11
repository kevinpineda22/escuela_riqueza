import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import LiveChat from "@/components/feature/LiveChat";
import { Stream } from "@cloudflare/stream-react";
import { Sparkles, MonitorPlay, Calendar, Clock, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";

interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
}

const INITIAL_COUNTDOWN: CountdownState = { hours: 0, minutes: 0, seconds: 15 };

const VIPLiveRoom = () => {
  const [isLive, setIsLive] = useState(false);
  const [timeLeft, setTimeLeft] = useState<CountdownState>(INITIAL_COUNTDOWN);
  const [showIntro, setShowIntro] = useState(false);
  const { clearPlayer } = usePlayerStore();

  // Apagar el reproductor podcast global al entrar a una sala en vivo
  useEffect(() => {
    clearPlayer();
  }, [clearPlayer]);

  useEffect(() => {
    if (isLive) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        
        // Si todo llega a 0, activa la intro cinemática
        handleStartLive();
        return { hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  const handleStartLive = () => {
    setShowIntro(true);
    setTimeout(() => {
      setIsLive(true);
      setShowIntro(false);
    }, 3500); // 3.5s de transición cinemática
  };

  return (
    <div className="min-h-screen bg-black text-textMain flex flex-col md:flex-row overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative h-[60vh] md:h-screen">
        
        {/* Cinematic Intro Overlay */}
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
                <div className="absolute inset-0 bg-gold blur-[100px] opacity-20 animate-pulse" />
                <img src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public" alt="Logo" className="h-32 object-contain relative z-10" />
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="mt-8 text-center z-10"
              >
                <h2 className="text-2xl font-bold text-gold tracking-[0.3em] uppercase mb-2">Conectando señal</h2>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ scaleY: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                      className="w-1 h-4 bg-gold rounded-full"
                    />
                  ))}
                </div>
              </motion.div>

              {/* Scanlines effect */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Overlay */}
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="absolute top-0 left-0 w-full p-6 md:p-8 z-40 flex justify-between items-start pointer-events-none"
        >
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl">
              <img src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public" alt="Logo" className="h-10 object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-extrabold text-xl leading-tight text-white tracking-tight drop-shadow-2xl">
                Sesión de Riqueza <span className="text-gold">VIP</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles size={12} className="text-gold" />
                <span className="text-[10px] text-white/60 uppercase font-black tracking-[0.2em]">Encuentro con Iván Mazo</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 pointer-events-auto">
            {isLive ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2.5 bg-red-600/20 backdrop-blur-md border border-red-600/50 text-red-500 px-4 py-2 rounded-2xl text-xs font-black tracking-widest shadow-[0_0_30px_rgba(220,38,38,0.2)]"
              >
                <motion.span 
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"
                />
                EN VIVO
              </motion.div>
            ) : (
              <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md border border-white/10 text-white/70 px-4 py-2 rounded-2xl text-[10px] font-bold tracking-wider">
                <Clock size={14} className="text-gold" />
                SALA DE ESPERA
              </div>
            )}
            
            {!isLive && (
              <button 
                onClick={handleStartLive}
                className="text-[10px] text-white/30 hover:text-gold uppercase font-bold tracking-tighter transition-all"
              >
                [ Forzar Conexión ]
              </button>
            )}
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-hidden">
          
          {/* Background Ambience */}
          <div className="absolute inset-0 z-0">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.05)_0%,transparent_70%)]" />
             <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
             
             <AnimatePresence>
               {!isLive && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 1 }}
                   className="absolute inset-0 bg-cover bg-center"
                   style={{ backgroundImage: "url('https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/1f8c5d3a-402d-4729-0e17-f179f416f900/public')" }}
                 >
                   <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
                 </motion.div>
               )}
             </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {!isLive ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.8 }}
                className="text-center z-10 px-6 max-w-4xl mx-auto"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12 inline-flex items-center gap-3 px-6 py-2.5 bg-gold/5 border border-gold/20 rounded-full"
                >
                  <Calendar size={16} className="text-gold" />
                  <span className="text-sm font-bold text-gold/80 tracking-widest uppercase">Próximo Encuentro VIP</span>
                </motion.div>

                <h2 className="text-4xl md:text-7xl font-black mb-8 text-white tracking-tighter leading-[1.1]">
                  El conocimiento es la <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-goldHover to-gold shadow-gold/20">moneda definitiva</span>
                </h2>
                
                <p className="text-textMuted mb-16 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
                  Estás a punto de entrar a una experiencia transformadora. <br />
                  <span className="text-white/40 italic">Asegúrate de no tener interrupciones.</span>
                </p>

                {/* Countdown Cards */}
                <div className="flex justify-center gap-4 md:gap-10">
                  {[
                    { val: timeLeft.hours, label: "Horas" },
                    { val: timeLeft.minutes, label: "Minutos" },
                    { val: timeLeft.seconds, label: "Segundos", highlight: true }
                  ].map((unit, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className={cn(
                        "relative w-20 h-28 md:w-36 md:h-44 flex items-center justify-center rounded-3xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-500",
                        unit.highlight ? "bg-gold/10 border-gold/30" : "bg-white/5"
                      )}>
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                        <span className={cn(
                          "text-4xl md:text-8xl font-black font-mono tracking-tighter",
                          unit.highlight ? "text-gold" : "text-white"
                        )}>
                          {unit.val.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <span className="text-[10px] text-textMuted uppercase tracking-[0.3em] mt-5 font-black">{unit.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5 }}
                className="w-full h-full z-10 bg-black flex items-center justify-center group"
              >
                {!import.meta.env.VITE_CLOUDFLARE_LIVE_INPUT_ID ? (
                  <div className="text-white text-center p-12 bg-darker rounded-3xl border border-white/5">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Tv size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Señal no configurada</h3>
                    <p className="text-textMuted max-w-sm mx-auto">Contacta al soporte técnico para vincular el Stream ID de Cloudflare.</p>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <Stream
                      src={import.meta.env.VITE_CLOUDFLARE_LIVE_INPUT_ID}
                      controls
                      autoplay
                      className="w-full h-full object-contain border-none shadow-[0_0_100px_rgba(0,0,0,1)]"
                    />
                    
                    {/* Signal status overlay (only visible on hover or mobile tap) */}
                    <div className="absolute bottom-10 left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-2xl">
                        <MonitorPlay size={20} className="text-gold" />
                        <div>
                          <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Señal de origen</p>
                          <p className="text-sm font-bold text-white tracking-tight">Cloudflare Stream Global 4K</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-full md:w-80 lg:w-[400px] h-[45vh] md:h-screen bg-darker shrink-0 z-50 overflow-hidden">
        <LiveChat liveId="00000000-0000-0000-0000-000000000000" />
      </div>
    </div>
  );
};

export default VIPLiveRoom;
