import { useState, useEffect } from "react";
import LiveChat from "@/components/feature/LiveChat";
import { Stream } from "@cloudflare/stream-react";

interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
}

const INITIAL_COUNTDOWN: CountdownState = { hours: 0, minutes: 15, seconds: 0 };

const VIPLiveRoom = () => {
  const [isLive, setIsLive] = useState(false);
  const [timeLeft, setTimeLeft] = useState<CountdownState>(INITIAL_COUNTDOWN);

  useEffect(() => {
    if (isLive) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        
        // Si todo llega a 0, activa el live
        setIsLive(true);
        return { hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  return (
    <div className="min-h-screen bg-darker text-textMain flex flex-col md:flex-row overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative h-[60vh] md:h-screen">
        {/* Cabecera */}
        <div className="absolute top-0 left-0 w-full p-4 md:p-6 z-10 flex justify-between items-center bg-gradient-to-b from-darker/90 to-transparent">
          <div className="flex items-center gap-3">
            <img src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public" alt="Logo" className="h-10 object-contain drop-shadow-md" />
            <div>
              <h1 className="font-bold text-lg leading-tight shadow-black drop-shadow-md text-white">
                Escuela de la Riqueza
              </h1>
              <span className="text-xs text-gold uppercase tracking-widest font-bold drop-shadow-md">Acceso VIP</span>
            </div>
          </div>
          {isLive && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsLive(false)}
                className="text-xs text-white/40 hover:text-white underline transition-colors"
                title="Volver al contador (solo desarrollo)"
              >
                Volver al contador
              </button>
              <div className="flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                EN VIVO
              </div>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 flex items-center justify-center bg-dark relative overflow-hidden">
          {!isLive && (
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
              style={{ backgroundImage: "url('https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/1f8c5d3a-402d-4729-0e17-f179f416f900/public')" }}
            >
              <div className="absolute inset-0 bg-darker/50"></div>
            </div>
          )}

          <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute m-auto h-[400px] w-[400px] rounded-full bg-gold opacity-[0.07] blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0"></div>

          {!isLive ? (
            <div className="text-center z-10 px-4 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-gold to-[#f0e0a0]">
                El evento exclusivo comenzará pronto
              </h2>
              <p className="text-textMuted mb-10 text-lg">
                Prepara tu cuaderno, un vaso de agua y aléjate de distracciones. Esta inmersión profunda cambiará tu
                perspectiva.
              </p>

              <div className="flex justify-center gap-4 md:gap-8 mb-12">
                <div className="flex flex-col items-center">
                  <div className="text-5xl md:text-7xl font-mono font-bold bg-darker border border-white/10 text-white w-20 h-24 md:w-32 md:h-36 flex items-center justify-center rounded-xl shadow-[0_0_20px_rgba(204,164,59,0.1)]">
                    {timeLeft.hours.toString().padStart(2, "0")}
                  </div>
                  <span className="text-textMuted uppercase tracking-widest text-xs mt-3 font-semibold">Horas</span>
                </div>
                <div className="text-4xl md:text-6xl font-light text-white/20 mt-4 md:mt-8">:</div>
                <div className="flex flex-col items-center">
                  <div className="text-5xl md:text-7xl font-mono font-bold bg-darker border border-white/10 text-white w-20 h-24 md:w-32 md:h-36 flex items-center justify-center rounded-xl shadow-[0_0_20px_rgba(204,164,59,0.1)]">
                    {timeLeft.minutes.toString().padStart(2, "0")}
                  </div>
                  <span className="text-textMuted uppercase tracking-widest text-xs mt-3 font-semibold">Minutos</span>
                </div>
                <div className="text-4xl md:text-6xl font-light text-white/20 mt-4 md:mt-8">:</div>
                <div className="flex flex-col items-center">
                  <div className="text-5xl md:text-7xl font-mono font-bold bg-darker border border-white/10 text-gold w-20 h-24 md:w-32 md:h-36 flex items-center justify-center rounded-xl shadow-[0_0_20px_rgba(204,164,59,0.15)]">
                    {timeLeft.seconds.toString().padStart(2, "0")}
                  </div>
                  <span className="text-textMuted uppercase tracking-widest text-xs mt-3 font-semibold">Segundos</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLive(true)}
                className="text-xs text-white/20 hover:text-white/50 underline transition-colors"
                title="Simular inicio (solo desarrollo)"
              >
                Forzar inicio de transmisión
              </button>
            </div>
          ) : (
            <div className="w-full h-full z-10 bg-black flex items-center justify-center relative">
              {!import.meta.env.VITE_CLOUDFLARE_LIVE_INPUT_ID ? (
                <div className="text-white text-center">
                  <p className="text-red-500 mb-2">Error: Falta el ID del video.</p>
                  <p className="text-sm text-gray-400">Por favor, reinicia el servidor de desarrollo (corta con Ctrl+C y vuelve a correr npm run dev) para que tome los cambios en el archivo .env.</p>
                </div>
              ) : (
                <Stream
                  src={import.meta.env.VITE_CLOUDFLARE_LIVE_INPUT_ID}
                  controls
                  autoplay
                  className="w-full h-full object-contain border-none"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-80 lg:w-96 h-[40vh] md:h-screen border-t md:border-t-0 md:border-l border-white/10 bg-darker shrink-0 z-20 overflow-hidden">
        <LiveChat />
      </div>
    </div>
  );
};

export default VIPLiveRoom;
