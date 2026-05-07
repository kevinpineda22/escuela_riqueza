import { Link } from "react-router-dom";
import { PlayCircle, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { cn } from "@/lib/utils";

interface UpcomingLesson {
  id: number;
  title: string;
  duration: string;
  locked: boolean;
}

const upcomingLessons: UpcomingLesson[] = [
  { id: 2, title: "Mentalidad de abundancia", duration: "32:15 min", locked: false },
  { id: 3, title: "Sistematización de ingresos", duration: "1h 10 min", locked: true },
  { id: 4, title: "Networking de alto valor", duration: "45:00 min", locked: true },
  { id: 5, title: "Hábitos atómicos para CEOs", duration: "25:30 min", locked: true },
];

const VIDEO_FILENAME = "https://www.w3schools.com/html/mov_bbb.mp4"; // Placeholder hasta conectar Cloudflare Stream

const LessonViewer = () => {
  const isUserPremium = false;

  return (
    <div className="min-h-screen bg-darker selection:bg-gold/30 font-sans text-textMain flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Reproductor */}
        <div className="flex-1">
          <div className="mb-6">
            <span className="text-gold text-sm font-semibold tracking-wider flex items-center gap-2 uppercase mb-2">
              Módulo 1 <div className="w-1 h-1 rounded-full bg-white/50"></div> Lección 1
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">El camino a la libertad financiera</h1>
            <p className="text-textMuted text-lg max-w-3xl">
              En este módulo, Iván explica las bases psicológicas y estratégicas para transformar tu relación con el
              dinero.
            </p>
          </div>

          <LessonPlayer videoSrc={VIDEO_FILENAME} isPremium={isUserPremium} />

          <div className="mt-8 p-6 bg-gradient-to-r from-darker to-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_0_30px_rgba(204,164,59,0.05)]">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="text-gold" size={20} /> Desbloquea toda la experiencia
              </h3>
              <p className="text-sm text-textMuted mt-1 max-w-md">
                Elimina la publicidad emergente, obtén certificado digital, habilita modo podcast y acceso a comunidad.
              </p>
            </div>
            <Link
              to="/login"
              className="whitespace-nowrap px-8 py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(204,164,59,0.3)] hover:scale-105"
            >
              Hacer Upgrade
            </Link>
          </div>
        </div>

        {/* Playlist */}
        <aside className="w-full lg:w-[400px] flex flex-col gap-4">
          <h3 className="text-lg font-bold text-white flex items-center justify-between mb-2">
            Contenido del Módulo
            <span className="text-xs font-normal text-textMuted bg-white/10 px-2 py-1 rounded">1 / 5</span>
          </h3>

          <div className="group flex gap-4 p-3 rounded-2xl bg-white/10 border border-gold/30 cursor-pointer overflow-hidden relative">
            <div className="w-32 h-20 bg-black rounded-xl overflow-hidden shrink-0 relative">
              <img
              src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                className="w-full h-full object-cover opacity-50 blur-sm scale-150"
                alt="thumb"
              />
              <div className="absolute inset-0 bg-gold/20 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gold text-darker flex items-center justify-center pl-1">
                  <PlayCircle size={16} />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <h4 className="text-sm font-bold text-white leading-tight line-clamp-2">
                El camino a la libertad financiera
              </h4>
              <p className="text-xs text-gold mt-1">Reproduciendo • 45:00 min</p>
            </div>
          </div>

          {upcomingLessons.map((lesson) => (
            <div
              key={lesson.id}
              className={cn(
                "group flex gap-4 p-3 rounded-2xl transition-all border border-transparent hover:bg-white/5 cursor-pointer",
                lesson.locked && "opacity-60 grayscale-[50%] hover:opacity-80"
              )}
            >
              <div className="w-32 h-20 bg-black rounded-xl overflow-hidden shrink-0 relative">
                <img
                  src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                  className="w-full h-full object-cover opacity-20 blur-sm scale-150"
                  alt="thumb"
                />
                {lesson.locked ? (
                  <div className="absolute inset-0 bg-darker/60 flex items-center justify-center">
                    <Lock size={20} className="text-white/50" />
                  </div>
                ) : (
                  <div className="absolute bottom-2 right-2 bg-black/80 px-1 rounded text-[10px] text-white font-medium">
                    {lesson.duration}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center pr-2">
                <h4 className="text-sm font-medium text-white/80 leading-tight line-clamp-2 group-hover:text-white transition-colors">
                  {lesson.title}
                </h4>
                <p className="text-xs text-textMuted mt-1 flex items-center gap-1">
                  {lesson.locked ? (
                    <span className="text-gold flex items-center gap-1">
                      <Lock size={10} /> Pro
                    </span>
                  ) : (
                    lesson.duration
                  )}
                </p>
              </div>
            </div>
          ))}
        </aside>
      </main>

      <Footer />
    </div>
  );
};

export default LessonViewer;
