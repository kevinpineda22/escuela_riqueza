import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Headphones, ShieldAlert, X } from 'lucide-react';

const LessonPlayer = ({ videoSrc, isPremium }) => {
  const videoRef = useRef(null);
  const adRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPodcastMode, setIsPodcastMode] = useState(false);
  
  // Lógica de Anuncios
  const [showAd, setShowAd] = useState(false);
  const [lastAdPlayedAt, setLastAdPlayedAt] = useState(0); // Rastrear el último minuto de anuncio
  const [adTimeLeft, setAdTimeLeft] = useState(41); // Inicial a 41 segundos
  
  const AD_INTERVAL = 120; // 120 segundos = 2 minutos
  const AD_VIDEO_SRC = '/publicidad.mp4'; // <- Tu video de publicidad (41s)

  const togglePlay = () => {
    if (showAd) return; // Bloquear play si el anuncio está rodando
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (isPremium) return; // Premium no ve anuncios
    if (!videoRef.current) return;

    const currentTime = videoRef.current.currentTime;

    // Verificar si es momento de un anuncio (cada 120 segundos)
    if (currentTime >= lastAdPlayedAt + AD_INTERVAL && !showAd) {
      // Pausar video y mostrar anuncio
      videoRef.current.pause();
      setIsPlaying(false);
      setShowAd(true);
      setAdTimeLeft(41); // Reiniciamos el medidor al iniciar
    }
  };

  const handleAdEnd = () => {
    setShowAd(false);
    setLastAdPlayedAt(lastAdPlayedAt + AD_INTERVAL); // Preparar siguiente bloque
    // Opcional: Auto-reproducir video después de la publicidad
    // videoRef.current.play(); setIsPlaying(true);
  };

  const handleAdTimeUpdate = () => {
    if (!adRef.current) return;
    const remaining = 41 - Math.floor(adRef.current.currentTime);
    setAdTimeLeft(remaining > 0 ? remaining : 0);
  };

  const toggleMute = () => {
    if (showAd) {
      adRef.current.muted = !isMuted;
    } else {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      {/* Indicador de Plan */}
      <div className={`p-3 rounded-xl border flex items-center justify-between ${isPremium ? 'bg-gold/10 border-gold/30 text-gold' : 'bg-white/5 border-white/10 text-white/70'}`}>
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert size={18} />
          {isPremium ? 'Plan Individual - Sin Interrupciones' : 'Plan Gratuito - Reproducción con Publicidad'}
        </div>
        
        {isPremium && (
          <button 
            onClick={() => setIsPodcastMode(!isPodcastMode)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all ${isPodcastMode ? 'bg-gold text-darker' : 'bg-transparent border border-gold hover:bg-gold/10'}`}
          >
            <Headphones size={18} /> Modo Podcast {isPodcastMode ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {/* Contenedor de Video Principal */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
        
        {/* Layer del Anuncio en Video Real */}
        {showAd && (
          <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center">
            {/* Overlay informativo */}
            <div className="absolute top-4 left-4 z-30 bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-sm font-bold text-white uppercase tracking-widest rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              Publicidad de Aliado
            </div>

            {/* Video del anuncio */}
            <video 
              ref={adRef}
              src={AD_VIDEO_SRC}
              autoPlay
              className="w-full h-full object-contain pointer-events-none"
              onTimeUpdate={handleAdTimeUpdate}
              onEnded={handleAdEnd}
            />

            {/* Contador / Mensaje final (Opcional, el 'onEnded' se encarga de cerrarlo) */}
            <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-2">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-medium text-white rounded-lg">
                El video se reanudará en {adTimeLeft}s...
              </div>
              <div className="w-32 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gold transition-all duration-300"
                  style={{ width: `${((41 - adTimeLeft) / 41) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Pseudo-Podcast Mode Layer (Oculta el video, deja solo audio y visualizer estático) */}
        {isPodcastMode && isPremium && (
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-darker to-[#1a1a1a] flex flex-col items-center justify-center pointer-events-none">
            <img src="/LOGO-ESCUELA.webp" alt="Modo Podcast" className="h-24 md:h-32 object-contain mb-6 opacity-80 animate-pulse drop-shadow-[0_0_15px_rgba(204,164,59,0.3)]" />
            <div className="flex items-center gap-3">
              <Headphones size={24} className="text-gold" />
              <h3 className="text-2xl font-bold text-white">Escuchando en Modo Podcast</h3>
            </div>
            <p className="text-sm text-textMuted mt-2">Ahorrando datos y batería</p>
          </div>
        )}

        {/* Video Element */}
        <video 
          ref={videoRef}
          src={videoSrc || "https://www.w3schools.com/html/mov_bbb.mp4"} // Placeholder
          className={`w-full h-full object-contain ${isPodcastMode && isPremium ? 'opacity-0' : 'opacity-100'}`}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Custom Controls (Ocultos durante el anuncio) */}
        {!showAd && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4 z-10">
            <button onClick={togglePlay} className="text-white hover:text-gold transition-colors">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            
            <button onClick={toggleMute} className="text-white hover:text-gold transition-colors">
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            
            <div className="flex-1"></div>
            
            <button onClick={() => {
                if (videoRef.current.requestFullscreen) {
                  videoRef.current.requestFullscreen();
                }
              }} 
              className="text-white hover:text-gold transition-colors"
            >
              <Maximize size={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonPlayer;