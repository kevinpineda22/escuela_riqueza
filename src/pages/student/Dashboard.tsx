import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Target,
  Heart,
  Briefcase,
  Map,
  Lightbulb,
  PlayCircle,
  Trophy,
  Users,
  Edit3,
  Award,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { cn } from "@/lib/utils";

interface ModuloItem {
  id: number;
  titulo: string;
  icono: ReactNode;
}

interface Leccion {
  id: number;
  titulo: string;
  duracion: string;
  modId: number;
  video: string;
}

const modulosData: ModuloItem[] = [
  { id: 1, titulo: "Inteligencia del aprendizaje", icono: <BookOpen className="text-gold w-6 h-6" /> },
  { id: 2, titulo: "Inteligencia de la riqueza", icono: <Target className="text-gold w-6 h-6" /> },
  { id: 3, titulo: "Inteligencia emocional", icono: <Heart className="text-gold w-6 h-6" /> },
  { id: 4, titulo: "Inteligencia Comercial y Negociadora", icono: <Briefcase className="text-gold w-6 h-6" /> },
  { id: 5, titulo: "Inteligencia Estratégica", icono: <Map className="text-gold w-6 h-6" /> },
  { id: 6, titulo: "Inteligencia Espiritual", icono: <Lightbulb className="text-gold w-6 h-6" /> },
];

const lecciones: Leccion[] = [
  { id: 1, titulo: "El camino a la libertad financiera", duracion: "45 min", modId: 2, video: "/clase1.mp4" },
  { id: 2, titulo: "Estrategias de inversión acelerada", duracion: "1h 15 min", modId: 2, video: "/clase1.mp4" },
  { id: 3, titulo: "Gestión de caja y presupuestos", duracion: "50 min", modId: 2, video: "/clase1.mp4" },
];

type TabId = "modulos" | "notas" | "certificados" | "comunidad";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>("modulos");
  const [selectedModule, setSelectedModule] = useState<number>(2);
  const [activeLesson] = useState<Leccion>(lecciones[0]!);
  const [personalNote, setPersonalNote] = useState("");

  const filteredLessons = lecciones.filter((l) => l.modId === selectedModule);

  return (
    <div className="min-h-screen bg-darker selection:bg-gold/30 font-sans text-textMain flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar / Profile */}
        <aside className="col-span-1 border-r border-white/10 pr-6 lg:block hidden">
          <div className="mb-10 text-center">
            <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 mb-4 mx-auto text-3xl font-bold text-gold shadow-[0_0_15px_rgba(204,164,59,0.3)]">
              DP
            </div>
            <h3 className="text-xl font-bold text-white">David Premium</h3>
            <p className="text-xs text-gold mt-1 font-medium tracking-widest uppercase">Plan Individual</p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-textMuted">Progreso General</span>
              <span className="text-white font-medium">34%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-goldHover" style={{ width: "34%" }}></div>
            </div>
          </div>

          <nav className="space-y-2">
            {(
              [
                { id: "modulos" as const, lbl: "Módulos y Clases", icon: <PlayCircle size={18} /> },
                { id: "notas" as const, lbl: "Notas Personales", icon: <Edit3 size={18} /> },
                { id: "certificados" as const, lbl: "Certificados", icon: <Award size={18} /> },
                { id: "comunidad" as const, lbl: "Comunidad VIP", icon: <Users size={18} /> },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                  activeTab === tab.id ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
                )}
              >
                {tab.icon} {tab.lbl}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido Principal */}
        <div className="col-span-1 lg:col-span-3">
          {activeTab === "modulos" && (
            <>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide mb-8">
                {modulosData.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedModule(mod.id)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-3 px-5 py-3 border rounded-full transition-all whitespace-nowrap",
                      selectedModule === mod.id
                        ? "bg-gold/10 border-gold shadow-[0_0_10px_rgba(204,164,59,0.3)] text-white font-bold"
                        : "bg-white/5 border-white/10 text-textMuted hover:bg-white/10"
                    )}
                  >
                    {mod.icono} <span className="text-sm">{mod.titulo}</span>
                  </button>
                ))}
              </div>

              {filteredLessons.length > 0 ? (
                <>
                  <div className="mb-6 flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">{activeLesson.titulo}</h2>
                      <span className="text-textMuted flex items-center gap-2 text-sm">
                        <Trophy size={16} className="text-gold" /> Módulo actualizado. Tú eres Premium.
                      </span>
                    </div>
                  </div>

                  <LessonPlayer videoSrc={activeLesson.video} isPremium={true} />

                  <div className="mt-8 bg-black/30 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Edit3 size={18} /> Apuntes Rápidos
                    </h4>
                    <textarea
                      value={personalNote}
                      onChange={(e) => setPersonalNote(e.target.value)}
                      placeholder="Escribe tus reflexiones de esta lección sin pausar el video..."
                      className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-gold resize-none h-24 transition-all"
                    ></textarea>
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        className="px-5 py-2 text-sm bg-white/10 hover:bg-gold hover:text-darker border border-white/10 text-white font-medium rounded-lg transition-all"
                      >
                        Guardar Notas
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center border border-white/10 rounded-3xl bg-white/5">
                  <PlayCircle size={48} className="mx-auto text-white/30 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Aún no hay lecciones aquí</h3>
                  <p className="text-textMuted">Pronto agregaremos nuevo contenido a este módulo.</p>
                </div>
              )}
            </>
          )}

          {activeTab === "notas" && (
            <div className="p-6 text-center border border-white/10 rounded-3xl bg-white/5 h-64 flex flex-col justify-center">
              <Edit3 size={40} className="mx-auto text-gold mb-4" />
              <h3 className="text-xl font-bold text-white">Libreta de Aprendizaje</h3>
              <p className="text-textMuted mt-2">Aquí aparecerán todas tus notas divididas por módulo.</p>
            </div>
          )}

          {activeTab === "certificados" && (
            <div className="p-6 text-center border border-white/10 rounded-3xl bg-white/5 h-64 flex flex-col justify-center">
              <Award size={40} className="mx-auto text-gold mb-4" />
              <h3 className="text-xl font-bold text-white">Logros Desbloqueados</h3>
              <p className="text-textMuted mt-2">Termina el 100% de un módulo para obtener tu aval digital.</p>
            </div>
          )}

          {activeTab === "comunidad" && (
            <div className="p-6 text-center border border-transparent rounded-3xl bg-gradient-to-br from-gold/20 to-darker h-64 flex flex-col justify-center relative overflow-hidden">
              <div className="relative z-10">
                <Users size={40} className="mx-auto text-gold mb-4" />
                <h3 className="text-2xl font-bold text-white">Red Global Privada</h3>
                <p className="text-white/80 mt-2 max-w-md mx-auto">
                  Conecta con cientos de líderes y haz networking del más alto nivel.
                </p>
                <button
                  type="button"
                  className="mt-6 px-6 py-2 bg-gold text-darker font-bold rounded-lg hover:scale-105 transition-transform shadow-lg"
                >
                  Abrir Foro
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
