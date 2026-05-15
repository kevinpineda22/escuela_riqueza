import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Lock, Sparkles, ArrowLeft, UserPlus, LogIn, BookOpen, PlayCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchModules, fetchLessons, type Module as DBModule, type Lesson as DBLesson } from "@/lib/api/stream/content";
import { useAuthStore } from "@/stores/auth.store";

const INTELLIGENCE_LABELS: Record<number, string> = {
  1: "Inteligencia del Aprendizaje",
  2: "Inteligencia de la Riqueza",
  3: "Inteligencia Emocional",
  4: "Inteligencia Comercial",
  5: "Inteligencia Estratégica",
  6: "Inteligencia Espiritual",
};

const ModulePreview = () => {
  const { intelligenceId } = useParams<{ intelligenceId: string }>();
  const { user } = useAuthStore();
  const id = parseInt(intelligenceId || "1", 10);

  const [moduleData, setModuleData] = useState<DBModule | null>(null);
  const [lessons, setLessons] = useState<DBLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => window.scrollTo(0, 0), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(false);
        const modules = await fetchModules();
        const label = INTELLIGENCE_LABELS[id];

        let mod = modules.find(m => m.is_published && m.title === label);

        if (!mod && label) {
          const keyword = label.replace("Inteligencia ", "").toLowerCase();
          mod = modules.find(m => m.is_published && m.title.toLowerCase().includes(keyword));
        }

        if (!mod) {
          const published = modules.filter(m => m.is_published).sort((a, b) => a.order_index - b.order_index);
          mod = published[id - 1];
        }

        if (!mod) {
          setError(true);
          return;
        }
        setModuleData(mod);
        const allLessons = await fetchLessons(mod.id);
        setLessons(allLessons.filter(l => l.is_published));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const intelligenceTitle = INTELLIGENCE_LABELS[id] || `Inteligencia ${id}`;
  const firstLesson = lessons[0];
  const remainingLessons = lessons.slice(1);
  const isLoggedIn = !!user;

  return (
    <div className="min-h-[100dvh] relative bg-darker selection:bg-gold/30 font-sans text-textMain">
      <div aria-hidden className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div aria-hidden className="hidden md:block fixed top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-gold opacity-[0.08] blur-[150px] pointer-events-none" />

      <Header />

      <main className="relative pt-24 sm:pt-32 pb-16 sm:pb-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-textMuted hover:text-gold transition-colors mb-6">
            <ArrowLeft size={14} /> Volver al inicio
          </Link>

          {loading && (
            <div className="space-y-6">
              <SkeletonCard className="h-16 w-3/4" />
              <SkeletonCard className="h-8 w-1/2" />
              <SkeletonCard className="h-64 w-full rounded-2xl" />
            </div>
          )}

          {error && !loading && (
            <EmptyState
              icon={BookOpen}
              title="Módulo no disponible"
              description="Este módulo aún no tiene contenido publicado. Vuelve pronto."
              action={
                <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-darker font-bold text-sm hover:bg-goldHover transition-colors">
                  <ArrowLeft size={14} /> Volver al inicio
                </Link>
              }
            />
          )}

          {moduleData && !loading && (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/5 border border-gold/20 mb-6">
                <Sparkles size={12} className="text-gold" />
                <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-bold text-gold/80">
                  {intelligenceTitle}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-10">
                <div>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4 text-balance">
                    {moduleData.title || "Módulo"}
                  </h1>
                  <p className="text-base sm:text-lg text-textMuted max-w-2xl leading-relaxed">
                    {moduleData.description || "Explora el contenido de este módulo."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-textMuted shrink-0">
                  <PlayCircle size={16} className="text-gold" />
                  <span className="text-white font-semibold">{lessons.length}</span> lecciones
                </div>
              </div>

              {!isLoggedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-3 mb-10 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-gold/10 to-darker border border-gold/20"
                >
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                    <UserPlus size={18} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm sm:text-base">¿Quieres más contenido?</p>
                    <p className="text-textMuted text-xs sm:text-sm">Regístrate gratis y desbloquea más lecciones. Los planes de pago te dan acceso total sin anuncios.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link to="/login" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-colors">
                      <LogIn size={14} /> Entrar
                    </Link>
                    <Link to="/registro" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-darker text-sm font-bold hover:bg-goldHover transition-colors">
                      <UserPlus size={14} /> Crear cuenta gratis
                    </Link>
                  </div>
                </motion.div>
              )}

              {lessons.length === 0 ? (
                <EmptyState
                  icon={PlayCircle}
                  title="Este módulo no tiene lecciones"
                  description="El contenido aún no está disponible. Vuelve más tarde."
                  className="my-8"
                />
              ) : (
                <>
                  {firstLesson && (
                    <div className="group relative rounded-3xl bg-gradient-to-br from-gold/[0.06] to-white/[0.02] border border-gold/40 overflow-hidden transition-all duration-300">
                      <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl opacity-50 pointer-events-none" />
                      <div className="relative z-10 p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-widest text-gold/80 font-bold">
                          <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                            <span className="text-gold font-bold text-[10px]">1</span>
                          </span>
                          <span>Lección disponible</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                          {firstLesson.title}
                        </h3>
                        {firstLesson.description && (
                          <p className="text-sm text-textMuted mb-4 line-clamp-2">{firstLesson.description}</p>
                        )}
                        <LessonPlayer
                          videoSrc={firstLesson.stream_uid || ""}
                          isPremium={false}
                        />
                      </div>
                    </div>
                  )}

                  {remainingLessons.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Lock size={16} className="text-textMuted" />
                        Más lecciones del módulo
                      </h3>
                      <div className="space-y-4">
                        {remainingLessons.map((lesson, index) => (
                          <motion.div
                            key={lesson.id}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            <div className="group relative rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] backdrop-blur-md overflow-hidden transition-colors duration-300 hover:border-gold/40">
                              <div aria-hidden className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-gold/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                              <div className="relative z-10 p-5 sm:p-6 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                  <span className="text-white/40 font-bold text-sm">{index + 2}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                                    {lesson.title}
                                  </h4>
                                  {lesson.description && (
                                    <p className="text-textMuted text-xs sm:text-sm line-clamp-1 mt-0.5">
                                      {lesson.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                                    Bloqueado
                                  </span>
                                  <Lock size={14} className="text-white/30" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mt-10 relative bg-gradient-to-br from-gold/10 via-darker to-darker border border-gold/20 rounded-3xl p-8 sm:p-12 text-center overflow-hidden"
                  >
                    <div aria-hidden className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gold/10 blur-3xl pointer-events-none hidden sm:block" />
                    <Sparkles className="text-gold mx-auto mb-4" size={28} />
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3 text-balance">
                      {isLoggedIn ? "Continúa tu aprendizaje" : "Sigue explorando"}
                    </h3>
                    <p className="text-sm sm:text-base text-textMuted max-w-md mx-auto mb-6">
                      {isLoggedIn
                        ? "Sigue explorando el contenido completo desde tu dashboard."
                        : "Crea tu cuenta gratis para acceder a más módulos. Los planes de pago desbloquean todo el contenido sin anuncios."
                      }
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {isLoggedIn ? (
                        <Link
                          to="/dashboard?tab=modulos"
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm sm:text-base transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)]"
                        >
                          <BookOpen size={16} /> Ir a mi dashboard
                        </Link>
                      ) : (
                        <>
                          <Link
                            to="/registro"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm sm:text-base transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)]"
                          >
                            <UserPlus size={16} /> Crear mi cuenta gratis
                          </Link>
                          <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white font-medium text-sm sm:text-base hover:bg-white/5 transition-colors"
                          >
                            <LogIn size={16} /> Ya tengo cuenta
                          </Link>
                        </>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ModulePreview;
