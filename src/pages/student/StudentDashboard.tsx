import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  PlayCircle,
  Users,
  Edit3,
  Award,
  Video,
  User as UserIcon,
  Camera,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Crown,
  Radio,
  Trash2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { usePlayerStore } from "@/stores/player.store";
import { PLANS } from "@/types/user";
import { supabase } from "@/lib/supabase";
import { fetchModules, fetchLessons, type Module as DBModule, type Lesson as DBLesson } from "@/lib/api/stream/content";
import { fetchActiveLive, type LiveEvent } from "@/lib/api/stream/lives";
import { fetchAllUserProgress } from "@/lib/api/stream/progress";

type TabId = "modulos" | "notas" | "certificados" | "comunidad" | "perfil";

const getInitials = (name: string) => {
  if (!name) return "US";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const VALID_TABS: TabId[] = ["modulos", "notas", "certificados", "comunidad", "perfil"];

const BADGE_CONTENT: Record<string, { description: string; keyPhrase: string }> = {
  "inteligencia del aprendizaje": {
    description: "Abrirás los ojos y dejarás atrás las enseñanzas obsoletas del sistema educativo, para darle paso a esos aprendizajes significativos que merece tu vida. Te darás cuenta de que el empresarismo no se desarrolla desde el conocimiento, sino desde la mentalidad.",
    keyPhrase: "¡La mentalidad la determina el aprendizaje!",
  },
  "inteligencia de la riqueza": {
    description: "Descubrirás temas y realidades controversiales. Por un lado entenderás que nos han educado para ser pobres y sabrás que la riqueza se despierta porque todos llevamos un rico dentro de nosotros en espera de ser despertado. Y por otro lado entenderás por qué el concepto que tienes sobre el trabajo, el éxito y las metas no son más que creencias limitantes que te frenan y no te dejan ver más allá de tus narices.",
    keyPhrase: "¡La riqueza la produce la inteligencia y las creencias limitantes son generadoras de pobreza!",
  },
  "inteligencia emocional": {
    description: "El problema más grave en las empresas es la carencia de inteligencia emocional que deteriora la calidad de las relaciones, crea una comunicación deficiente y un trabajo en equipo bastante pobre. Sin inteligencia emocional no puede haber empresas prósperas, ni una sociedad que cree bienestar para la vida.",
    keyPhrase: "¡Además la inteligencia emocional es vital para la resolución de los problemas!",
  },
  "inteligencia comercial": {
    description: "Este eje tan disruptivo, revolucionario e importante es el que te ayudará a vender; pero no se trata vender tradicionalmente, sino de ofrecer un valor significativo. Por lo tanto aquí aprenderás cómo generar confianza y convertirte en un experto en lograr relaciones de alto valor con tus clientes.",
    keyPhrase: "¡Recuerda que solo lo que significa algo tiene valor!",
  },
  "inteligencia estratégica": {
    description: "El sinónimo de empresa es ''Problema'' y los problemas solo se manejan con estrategia, por eso el empresario tiene que volverse un pensador estratégico. Además, la vida del empresario está constantemente amenazada por la incertidumbre y por el cambio. Pensar estratégicamente es esencial para garantizar el crecimiento y la solidez de la empresa en un mundo donde reina la inestabilidad.",
    keyPhrase: "¡La estrategia no se trata de planear, sino de anticipar y responder de manera creativa a lo desconocido!",
  },
  "inteligencia espiritual": {
    description: "Este módulo es el más innovador del programa, ya que reconoce que para ser un verdadero empresario y líder se requiere de una profunda sabiduría. Entenderás que un sabio no es el que sabe, sino el que saborea el fracaso, la pérdida, la incertidumbre y los problemas, para darle el paso al disfrute de algo nuevo. Las personas espirituales son las que logran vivir la integridad.",
    keyPhrase: "Recuerda esta frase: ''La integridad y la espiritualidad son la clave del éxito empresarial''.",
  },
};

function getBadgeContent(moduleTitle: string | undefined): { description: string; keyPhrase: string } {
  if (!moduleTitle) return { description: "Has completado este módulo con éxito.", keyPhrase: "¡Felicidades por tu logro!" };
  const normalized = moduleTitle.toLowerCase().trim();
  const content = BADGE_CONTENT[normalized];
  if (content) return content;
  const matched = Object.entries(BADGE_CONTENT).find(([key]) => normalized.includes(key));
  if (matched) return matched[1];
  return { description: "Has completado este módulo con éxito.", keyPhrase: "¡Felicidades por tu logro!" };
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("modulos");

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get("tab") as TabId;
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
    setTimeout(() => window.scrollTo(0, 0), 50);
  }, [location.search]);

  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [badgeModalModule, setBadgeModalModule] = useState<DBModule | null>(null);

  const changeTab = (next: TabId) => {
    setSelectedModule(null);
    // Empuja la URL para mantener sincronizado el hamburger y poder linkear directo.
    navigate(`/dashboard?tab=${next}`, { replace: false });
  };
  const [activeLesson, setActiveLesson] = useState<DBLesson | null>(null);
  const [dbModules, setDbModules] = useState<DBModule[]>([]);
  const [dbLessonsMap, setDbLessonsMap] = useState<Record<string, DBLesson[]>>({});
  const [userProgress, setUserProgress] = useState<{ lesson_id: string, is_completed: boolean }[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);

  useEffect(() => {
    fetchActiveLive().then(active => {
      if (active && user?.plan && active.allowed_plans?.includes(user.plan)) {
        setLiveEvent(active);
      } else {
        setLiveEvent(null);
      }
    }).catch(() => setLiveEvent(null));
  }, [user?.plan]);

  // Progress calculations
  const getModuleProgress = (moduleId: string) => {
    const lessons = dbLessonsMap[moduleId] || [];
    if (lessons.length === 0) return 0;
    
    const completedCount = lessons.filter(l => 
      userProgress.some(p => p.lesson_id === l.id && p.is_completed)
    ).length;
    
    return Math.round((completedCount / lessons.length) * 100);
  };

  // Load content
  useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoadingContent(true);
        const modules = await fetchModules();
        const publishedModules = modules.filter(m => m.is_published && (!m.allowed_plans || m.allowed_plans.includes(user?.plan as any)));
        setDbModules(publishedModules);

        const lessonsMap: Record<string, DBLesson[]> = {};
        for (const mod of publishedModules) {
          const lessons = await fetchLessons(mod.id);
          lessonsMap[mod.id] = lessons.filter(l => l.is_published && (!l.allowed_plans || l.allowed_plans.includes(user?.plan as any)));
        }
        setDbLessonsMap(lessonsMap);
        
        const progress = await fetchAllUserProgress();
        setUserProgress(progress);
        
      } catch (err) {
        toast.error("Error", { description: "No se pudo cargar el contenido" });
      } finally {
        setIsLoadingContent(false);
        setTimeout(() => window.scrollTo(0, 0), 50);
      }
    };
    loadContent();
  }, [user?.plan]);

  // Sincronizar progreso en tiempo real vía Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("user-progress-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_lesson_progress",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const record = payload.new as { lesson_id: string; is_completed: boolean };
            setUserProgress((prev) => {
              const existing = prev.find((p) => p.lesson_id === record.lesson_id);
              if (existing) {
                return prev.map((p) =>
                  p.lesson_id === record.lesson_id
                    ? { lesson_id: record.lesson_id, is_completed: record.is_completed }
                    : p
                );
              }
              return [...prev, { lesson_id: record.lesson_id, is_completed: record.is_completed }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Polling fallback (cada 15s) por si Realtime no está disponible
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      try {
        const progress = await fetchAllUserProgress();
        setUserProgress(progress);
      } catch {
        // silencio
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Notes state
  const [personalNote, setPersonalNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [allNotes, setAllNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !activeLesson) return;
    const loadNote = async () => {
      try {
        const { data, error } = await supabase.from("lesson_notes").select("content").eq("user_id", user.id).eq("lesson_id", activeLesson.id).maybeSingle();
        if (data && !error) setPersonalNote(data.content || "");
        else setPersonalNote(localStorage.getItem(`note_${user.id}_${activeLesson.id}`) || "");
      } catch {
        setPersonalNote(localStorage.getItem(`note_${user.id}_${activeLesson.id}`) || "");
      }
    };
    loadNote();
  }, [activeLesson?.id, user]);

  useEffect(() => {
    if (activeTab === "notas" && user) {
      const loadAllNotes = async () => {
        try {
          const { data, error } = await supabase.from("lesson_notes").select("lesson_id, content, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
          if (data && !error) setAllNotes(data);
        } catch {
          // Fallback
          const localNotes = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(`note_${user.id}_`)) {
              localNotes.push({ lesson_id: key.replace(`note_${user.id}_`, ""), content: localStorage.getItem(key), updated_at: new Date().toISOString() });
            }
          }
          setAllNotes(localNotes);
        }
      };
      loadAllNotes();
    }
  }, [activeTab, user]);

  const handleSaveNote = async () => {
    if (!user || !activeLesson) return;
    setIsSavingNote(true);
    try {
      const { error } = await supabase.from("lesson_notes").upsert({ user_id: user.id, lesson_id: activeLesson.id, content: personalNote, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;
      toast.success("Nota guardada", { description: "Tus apuntes se han sincronizado correctamente." });
    } catch (err) {
      localStorage.setItem(`note_${user.id}_${activeLesson.id}`, personalNote);
      toast.success("Nota guardada localmente", { description: "Tus apuntes se guardaron en este dispositivo." });
    } finally {
      setIsSavingNote(false);
    }
  };

  // Profile state
  const [profileName, setProfileName] = useState(user?.fullName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;
      setUser({ ...user, avatarUrl: null });
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success("Foto eliminada", { description: "Tu perfil ahora usa la imagen por defecto." });
    } catch (err) {
      toast.error("Error al eliminar foto", { description: (err as any).message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      let finalAvatarUrl = user.avatarUrl;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
        if (uploadError) throw uploadError;
        finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({ full_name: profileName, avatar_url: finalAvatarUrl }).eq("id", user.id);
      if (error) throw error;
      setUser({ ...user, fullName: profileName, avatarUrl: finalAvatarUrl });
      setAvatarFile(null);
      toast.success("Perfil actualizado", { description: "Tus datos se guardaron correctamente." });
    } catch (err) {
      toast.error("Error al actualizar perfil", { description: (err as any).message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const isPremium = user?.plan === PLANS.INDIVIDUAL || user?.plan === PLANS.VIP;
  const isPodcastMode = usePlayerStore((s) => s.isPodcastMode && !!s.track);

  const NAV_ITEMS = useMemo(() => [
    { id: "modulos", icon: PlayCircle, label: "Módulos" },
    { id: "notas", icon: Edit3, label: "Notas personales" },
    { id: "certificados", icon: Award, label: "Certificado" },
    { id: "comunidad", icon: Users, label: "Comunidad VIP", premiumOnly: true, vipOnly: false },
    { id: "perfil", icon: UserIcon, label: "Mi Panel" }
  ], []);

  // When a module is clicked, auto-select first lesson
  const handleModuleClick = (modId: string) => {
    setSelectedModule(modId);
    if (dbLessonsMap[modId]?.length > 0) {
      setActiveLesson(dbLessonsMap[modId][0]);
    } else {
      setActiveLesson(null);
    }
    // Scroll to top when entering a module
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={cn("min-h-screen bg-darker selection:bg-gold/30 font-sans text-textMain flex flex-col overflow-x-hidden", isPodcastMode ? "pb-24 md:pb-28" : "")}>
      <Header />


      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
        {/* Desktop Sidebar */}
        <aside className="col-span-1 border-r border-white/10 pr-6 lg:flex flex-col hidden h-full sticky top-24 self-start max-h-[calc(100dvh-120px)] overflow-y-auto custom-scrollbar">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            <div className="mb-10 text-center">
              <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 mb-4 mx-auto text-3xl font-bold text-gold shadow-[0_0_15px_rgba(204,164,59,0.3)] overflow-hidden relative group">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getInitials(profileName || "Usuario")
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Camera size={24} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUpdatingProfile} />
                </label>
              </div>
              <h3 className="text-xl font-bold text-white capitalize line-clamp-1">{user?.fullName || "Estudiante"}</h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-widest uppercase">
                {user?.plan === PLANS.VIP ? <Crown size={12} className="text-gold" /> : null}
                <span className={user?.plan === PLANS.VIP ? "text-gold" : "text-white/70"}>{user?.plan || "Free"}</span>
              </div>
            </div>

            <nav className="space-y-2">
              {NAV_ITEMS.map(item => {
                if (item.premiumOnly && !isPremium) return null;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeTab(item.id as TabId)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium group",
                      isActive ? "bg-white/10 text-white shadow-sm border border-white/5" : "text-textMuted hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <item.icon size={18} className={isActive ? "text-gold" : "text-textMuted group-hover:text-white/80 transition-colors"} /> 
                    {item.label}
                  </button>
                );
              })}

              {user?.plan === PLANS.VIP && (
                <div className="pt-4 mt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => navigate("/vip-live")}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Video size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      </div>
                      Eventos en Vivo
                    </div>
                  </button>
                </div>
              )}
            </nav>
          </motion.div>
        </aside>

        {/* Contenido Principal */}
        <div className="col-span-1 lg:col-span-3 min-h-[500px]">
          {/* Live Banner — solo si hay un live relevante para el plan del usuario */}
          {liveEvent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 md:p-5 rounded-2xl border bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 border-gold/20 shadow-[0_0_30px_rgba(204,164,59,0.08)]"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-3 h-3 rounded-full shrink-0",
                    liveEvent.status === "live" ? "bg-red-500 animate-pulse shadow-[0_0_10px_red]" : "bg-gold"
                  )} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                        {liveEvent.status === "live" ? "🔴 EN VIVO AHORA" : "Próximo En Vivo"}
                      </span>
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                        {user?.plan}
                      </span>
                    </div>
                    <h4 className="text-white font-bold text-sm md:text-base mt-0.5">
                      {liveEvent.title}
                    </h4>
                    {liveEvent.starts_at && liveEvent.status !== "live" && (
                      <p className="text-[11px] text-textMuted/60 mt-0.5">
                        {new Date(liveEvent.starts_at).toLocaleDateString("es-CO", {
                          day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {liveEvent.status === "live" ? (
                  <a href="/vip-live"
                    className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 shrink-0">
                    <span className="hidden sm:inline">Ver transmisión</span><span className="sm:hidden">Ver</span> <PlayCircle size={14} />
                  </a>
                ) : liveEvent.starts_at && (new Date(liveEvent.starts_at).getTime() - Date.now()) <= 15 * 60 * 1000 ? (
                  <a href="/vip-live"
                    className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 shadow-lg shadow-gold/10 shrink-0">
                    Ver sala <Radio size={14} />
                  </a>
                ) : (
                  <span className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs bg-gold/10 text-gold border border-gold/20 whitespace-nowrap shrink-0">
                    <span className="hidden sm:inline">Disponible para tu plan</span><span className="sm:hidden">Disponible</span>
                  </span>
                )}
              </div>
            </motion.div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "modulos" && (
              <motion.div
                key="modulos"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {isLoadingContent ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    <SkeletonCard className="h-48" />
                    <SkeletonCard className="h-48" />
                    <SkeletonCard className="h-48" />
                  </div>
                ) : !selectedModule ? (
                  /* Grid de Módulos (Nivel 1) */
                  <>
                    <div className="mb-6">
                      <h2 className="text-3xl font-extrabold text-white tracking-tight">Tu Aprendizaje</h2>
                      <p className="text-textMuted mt-1">Selecciona un módulo para continuar con tus lecciones.</p>
                    </div>
                    
                    {dbModules.length === 0 ? (
                      <EmptyState 
                        icon={BookOpen}
                        title="No hay módulos disponibles"
                        description="Pronto agregaremos nuevo contenido a la plataforma."
                        className="border-dashed"
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {dbModules.map((mod, idx) => (
                          <motion.div
                            key={mod.id}
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                            onClick={() => handleModuleClick(mod.id)}
                            className="bg-black/30 border border-white/10 rounded-2xl p-6 hover:border-gold/30 hover:bg-white/5 cursor-pointer group transition-all flex flex-col h-full relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-gold/10 transition-colors" />
                            <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 text-gold flex items-center justify-center mb-5 group-hover:scale-110 transition-transform relative z-10 shadow-[0_0_15px_rgba(204,164,59,0.15)]">
                              <BookOpen size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 relative z-10 leading-tight group-hover:text-gold transition-colors">{mod.title}</h3>
                            <p className="text-textMuted text-sm mb-6 flex-1 relative z-10 line-clamp-3">
                              {mod.description || "Explora el contenido de este módulo y avanza en tu camino."}
                            </p>
                              <div className="flex items-center justify-between text-sm font-medium pt-4 border-t border-white/5 relative z-10 mt-auto">
                                <div className="flex flex-col gap-1 w-1/2">
                                  <span className="text-white/50 flex items-center gap-1.5"><PlayCircle size={14}/> {dbLessonsMap[mod.id]?.length || 0} Clases</span>
                                  {getModuleProgress(mod.id) > 0 && (
                                    <div className="flex items-center gap-2 w-full mt-1">
                                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-gold rounded-full" 
                                          style={{ width: `${getModuleProgress(mod.id)}%` }} 
                                        />
                                      </div>
                                      <span className="text-[10px] text-gold">{getModuleProgress(mod.id)}%</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-gold group-hover:underline flex items-center gap-1">Entrar <ArrowLeft size={14} className="rotate-180" /></span>
                              </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Vista de Player (Nivel 2) */
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <button 
                      onClick={() => setSelectedModule(null)} 
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-textMuted hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 -ml-3"
                    >
                      <ArrowLeft size={16} /> Volver a módulos
                    </button>

                    {dbLessonsMap[selectedModule]?.length > 0 && activeLesson ? (
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
                        {/* Zona de Video y Notas (Ocupa 2 de las 3 columnas en desktop) */}
                        <div className="xl:col-span-2 flex flex-col gap-6">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-gold text-xs font-bold tracking-wider uppercase bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                                {dbModules.find((m) => m.id === selectedModule)?.title}
                              </span>
                              <span className="text-textMuted text-sm">•</span>
                              <span className="text-white/70 text-sm font-medium">
                                Clase {dbLessonsMap[selectedModule].findIndex(l => l.id === activeLesson.id) + 1} de {dbLessonsMap[selectedModule].length}
                              </span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{activeLesson.title}</h2>
                          </div>

                          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-black">
                            <LessonPlayer 
                              videoSrc={activeLesson.stream_uid || ""} 
                              isPremium={isPremium} 
                              lesson={{
                                id: Number(activeLesson.id),
                                titulo: activeLesson.title,
                                modId: Number(activeLesson.module_id)
                              }}
                              moduleTitle={dbModules.find(m => m.id === activeLesson.module_id)?.title || ""}
                            />
                          </div>

                          {/* Notas en Desktop se quedan aquí abajo */}
                          <div className="hidden xl:block bg-black/30 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-gold/30 transition-colors">
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-colors" />
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-white font-medium flex items-center gap-2">
                                  <Edit3 size={18} className="text-gold" /> Apuntes Rápidos
                                </h4>
                              </div>
                              <textarea
                                value={personalNote}
                                onChange={(e) => setPersonalNote(e.target.value)}
                                disabled={!isPremium || isSavingNote}
                                placeholder={isPremium ? "Escribe tus reflexiones de esta lección sin pausar el video..." : "El plan Free no incluye toma de notas. ¡Mejora tu plan individual o VIP!"}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-gold/50 resize-none h-24 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-white/30"
                              ></textarea>
                              <div className="flex justify-end mt-3">
                                <button
                                  type="button"
                                  onClick={handleSaveNote}
                                  disabled={!isPremium || isSavingNote || !personalNote.trim()}
                                  className="px-5 py-2 text-sm bg-white/10 hover:bg-gold hover:text-darker border border-white/10 hover:border-gold text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {isSavingNote ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16}/>}
                                  Guardar Notas
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Zona de Lista de Lecciones */}
                        <div className="xl:col-span-1 flex flex-col gap-6">
                          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col xl:max-h-[600px] shadow-lg">
                            <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
                              <h3 className="font-bold text-white text-sm flex items-center justify-between">
                                Playlist del Módulo
                                <span className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">
                                  {dbLessonsMap[selectedModule].length} clases
                                </span>
                              </h3>
                            </div>
                            
                              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {dbLessonsMap[selectedModule].map((lesson, index) => {
                                  const isActive = activeLesson.id === lesson.id;
                                  const isCompleted = userProgress.some(p => p.lesson_id === lesson.id && p.is_completed);
                                  
                                  return (
                                  <button
                                    key={lesson.id}
                                    onClick={() => setActiveLesson(lesson)}
                                    className={cn(
                                      "w-full text-left p-3 rounded-xl transition-all flex gap-3 group relative overflow-hidden",
                                      isActive 
                                        ? "bg-gold/10 border border-gold/30" 
                                        : "bg-transparent border border-transparent hover:bg-white/5"
                                    )}
                                  >
                                    {isActive && (
                                      <motion.div layoutId="activeLessonIndicator" className="absolute left-0 top-0 bottom-0 w-1 bg-gold" />
                                    )}
                                    <div className="shrink-0 pt-0.5 relative z-10">
                                      {isActive ? (
                                        <div className="w-7 h-7 rounded-full bg-gold text-darker flex items-center justify-center shadow-[0_0_10px_rgba(204,164,59,0.5)]">
                                          <PlayCircle size={14} className="ml-0.5" />
                                        </div>
                                      ) : isCompleted ? (
                                        <div className="w-7 h-7 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center border border-green-500/20">
                                          <CheckCircle2 size={14} />
                                        </div>
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-white/5 text-textMuted flex items-center justify-center border border-white/10 group-hover:border-white/30 group-hover:text-white transition-colors">
                                          <span className="text-xs font-bold">{index + 1}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 relative z-10 flex flex-col justify-center">
                                      <h4 className={cn(
                                        "text-sm font-medium leading-snug mb-1 transition-colors",
                                        isActive ? "text-gold font-bold" : "text-white/80 group-hover:text-white"
                                      )}>
                                        {lesson.title}
                                      </h4>
                                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
                                        <span className={isActive ? "text-gold/70" : "text-textMuted"}>
                                          {lesson.allowed_plans?.[0] || "FREE"}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Notas en Mobile se apilan debajo de la playlist */}
                          <div className="xl:hidden bg-black/30 border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-white font-medium flex items-center gap-2 text-sm">
                                <Edit3 size={16} className="text-gold" /> Apuntes Rápidos
                              </h4>
                            </div>
                            <textarea
                              value={personalNote}
                              onChange={(e) => setPersonalNote(e.target.value)}
                              disabled={!isPremium || isSavingNote}
                              placeholder={isPremium ? "Tus reflexiones de esta lección..." : "Mejora tu plan para tomar notas."}
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-gold/50 resize-none h-20 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-white/30"
                            ></textarea>
                            <div className="flex justify-end mt-3">
                              <button
                                type="button"
                                onClick={handleSaveNote}
                                disabled={!isPremium || isSavingNote || !personalNote.trim()}
                                className="px-4 py-2 text-xs bg-white/10 hover:bg-gold hover:text-darker border border-white/10 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                              >
                                {isSavingNote && <Loader2 size={14} className="animate-spin" />}
                                Guardar
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    ) : (
                      <EmptyState 
                        icon={PlayCircle}
                        title="Módulo vacío"
                        description="Este módulo aún no tiene lecciones publicadas."
                        className="border-dashed"
                      />
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === "notas" && (
              <motion.div
                key="notas"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10 mb-6 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-20 w-64 h-64 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-colors" />
                  <div className="relative z-10">
                    <Edit3 size={48} className="mx-auto text-gold mb-4 drop-shadow-[0_0_15px_rgba(204,164,59,0.3)]" />
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Libreta de Aprendizaje</h2>
                    <p className="text-textMuted mt-3 max-w-lg mx-auto text-sm sm:text-base">
                      Tus apuntes rápidos organizados por lección. Úsalos para repasar los conceptos clave de tu proceso en Escuela de la Riqueza.
                    </p>
                  </div>
                </div>

                {allNotes.length === 0 ? (
                  <EmptyState 
                    icon={Edit3}
                    title="Aún no tienes notas"
                    description="Abre una lección y guarda tus primeros apuntes para verlos aquí."
                    className="border-dashed py-16"
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {allNotes.map((note, index) => {
                      let leccionTitle = "Lección Desconocida";
                      let moduloTitle = "Módulo Desconocido";
                      
                      for (const modId in dbLessonsMap) {
                        const lesson = dbLessonsMap[modId].find(l => l.id === note.lesson_id);
                        if (lesson) {
                          leccionTitle = lesson.title;
                          const mod = dbModules.find(m => m.id === modId);
                          if (mod) moduloTitle = mod.title;
                          break;
                        }
                      }
                      
                      return (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="bg-black/40 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col hover:border-gold/30 transition-colors group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-gold/5 transition-colors" />
                          <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4 relative z-10">
                            <div className="pr-4">
                              <span className="text-[10px] sm:text-xs font-bold text-gold uppercase tracking-wider block mb-1.5">
                                {moduloTitle}
                              </span>
                              <h3 className="text-white font-medium text-sm sm:text-base line-clamp-2" title={leccionTitle}>
                                {leccionTitle}
                              </h3>
                            </div>
                            <span className="text-[10px] text-white/40 whitespace-nowrap bg-white/5 px-2 py-1 rounded-md font-mono shrink-0 border border-white/5">
                              {new Date(note.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-white/80 text-sm sm:text-base flex-1 whitespace-pre-wrap leading-relaxed relative z-10 font-serif italic">
                            "{note.content}"
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "certificados" && (
                <motion.div key="certificados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <div className="mb-6">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Tus Insignias</h2>
                    <p className="text-textMuted mt-1">Completa el 100% de cada módulo para desbloquear su aval.</p>
                  </div>
                  
                  {dbModules.length === 0 ? (
                    <EmptyState 
                      icon={Award}
                      title="Logros Desbloqueados"
                      description="Termina el 100% de un módulo para obtener tu aval digital."
                      className="h-80"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {dbModules.map((mod, idx) => {
                        const isUnlocked = getModuleProgress(mod.id) === 100 && dbLessonsMap[mod.id]?.length > 0;
                        return (
                          <motion.div
                            key={mod.id}
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                            className={cn(
                              "border rounded-2xl p-6 relative overflow-hidden transition-all flex flex-col items-center text-center",
                              isUnlocked
                                ? "bg-black/40 border-gold/40 shadow-[0_0_20px_rgba(204,164,59,0.15)] cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(204,164,59,0.25)]"
                                : "bg-white/[0.02] border-white/5 opacity-50 grayscale"
                            )}
                            onClick={() => isUnlocked && setBadgeModalModule(mod)}
                          >
                            {isUnlocked && (
                              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl -mr-10 -mt-10" />
                            )}
                            <div className="w-full h-64 flex items-center justify-center mb-4 relative z-10">
                              {mod.badge_image_url ? (
                                <img
                                  src={mod.badge_image_url}
                                  alt={mod.title}
                                  className={cn(
                                    "w-56 h-56 object-contain",
                                    !isUnlocked && "opacity-40 grayscale",
                                    isUnlocked && "drop-shadow-[0_0_30px_rgba(204,164,59,0.5)]"
                                  )}
                                />
                              ) : (
                                <div className={cn(
                                  "w-16 h-16 rounded-full flex items-center justify-center border-2",
                                  isUnlocked ? "bg-gold/20 text-gold border-gold shadow-[0_0_15px_rgba(204,164,59,0.3)]" : "bg-white/10 text-white/40 border-white/10"
                                )}>
                                  {isUnlocked ? <CheckCircle2 size={28} /> : <Award size={28} />}
                                </div>
                              )}
                            </div>
                            <h3 className={cn("text-lg font-bold mb-2 relative z-10", isUnlocked ? "text-gold" : "text-white/60")}>
                              {isUnlocked ? "¡Módulo Completado!" : "Bloqueado"}
                            </h3>
                            <p className="text-sm font-medium text-white/80 line-clamp-2 relative z-10">
                              {mod.title}
                            </p>
                            
                            {!isUnlocked && (
                              <div className="mt-4 w-full relative z-10">
                                <div className="text-xs text-white/40 mb-1">{getModuleProgress(mod.id)}% completado</div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-white/30 rounded-full" style={{ width: `${getModuleProgress(mod.id)}%` }} />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              <Dialog open={!!badgeModalModule} onOpenChange={(open) => { if (!open) setBadgeModalModule(null); }}>
                <DialogContent className="bg-darker border-gold/30 sm:max-w-lg max-h-[90dvh] overflow-y-auto">
                  <DialogHeader className="text-center">
                    <DialogTitle className="text-2xl font-extrabold text-gold">
                      {badgeModalModule?.title}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {badgeModalModule?.badge_image_url ? (
                      <div className="flex justify-center">
                        <img
                          src={badgeModalModule.badge_image_url}
                          alt={badgeModalModule.title}
                          className="w-44 h-44 object-contain drop-shadow-[0_0_30px_rgba(204,164,59,0.5)]"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <div className="w-24 h-24 rounded-full bg-gold/20 text-gold border-2 border-gold flex items-center justify-center shadow-[0_0_20px_rgba(204,164,59,0.4)]">
                          <CheckCircle2 size={48} />
                        </div>
                      </div>
                    )}
                    <div className="bg-gold/5 border border-gold/20 rounded-xl p-5">
                      <p className="text-textMain text-sm leading-relaxed">
                        {getBadgeContent(badgeModalModule?.title).description}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="inline-block bg-gold/10 border border-gold/30 rounded-xl px-5 py-3">
                        <p className="text-gold font-bold text-sm">
                          {getBadgeContent(badgeModalModule?.title).keyPhrase}
                        </p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

            {activeTab === "comunidad" && (
              <motion.div 
                key="comunidad" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="p-8 sm:p-16 text-center border border-transparent rounded-3xl bg-gradient-to-br from-gold/20 to-darker min-h-[400px] flex flex-col justify-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 sm:w-80 h-64 sm:h-80 bg-gold/10 rounded-full blur-3xl mix-blend-screen" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 sm:w-80 h-64 sm:h-80 bg-gold/5 rounded-full blur-3xl mix-blend-screen" />
                
                <div className="relative z-10">
                  <Users size={56} className="mx-auto text-gold mb-6 drop-shadow-[0_0_15px_rgba(204,164,59,0.4)]" />
                  <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Red Global Privada</h3>
                  <p className="text-white/80 mt-4 max-w-md mx-auto text-lg leading-relaxed">
                    Conecta con cientos de líderes y haz networking del más alto nivel exclusivo para miembros VIP.
                  </p>
                  <button
                    type="button"
                    className="mt-8 px-8 py-3.5 bg-gold text-darker font-bold rounded-xl hover:bg-goldHover transition-all shadow-[0_0_20px_rgba(204,164,59,0.3)] hover:shadow-[0_0_30px_rgba(204,164,59,0.5)] text-lg"
                  >
                    Abrir Foro VIP
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "perfil" && (
              <motion.div
                key="perfil"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10"
              >
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3 border-b border-white/10 pb-6">
                  <UserIcon className="text-gold" /> Mi Panel
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-textMuted mb-3">Foto de Perfil</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="relative w-28 h-28 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 text-4xl font-bold text-gold shadow-[0_0_20px_rgba(204,164,59,0.15)] group overflow-hidden shrink-0">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            getInitials(profileName || "Usuario")
                          )}
                          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm">
                            <Camera size={28} className="text-white" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUpdatingProfile} />
                          </label>
                        </div>
                        <div className="text-sm text-textMuted bg-black/20 p-4 rounded-xl border border-white/5">
                          <p className="text-white/90 font-medium mb-1">Actualiza tu avatar</p>
                          <p className="text-xs">Haz clic en la imagen para subir una nueva.</p>
                          <p className="text-xs mt-1 text-white/40">Recomendado: 400x400px (JPG, PNG. Max 2MB)</p>
                          {avatarPreview && (
                            <button
                              type="button"
                              onClick={handleDeleteAvatar}
                              disabled={isUpdatingProfile}
                              className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={12} /> Eliminar foto
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-textMuted mb-2">Nombre Completo</label>
                      <input 
                        type="text" 
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-textMuted mb-2">Correo Electrónico</label>
                      <input 
                        type="email" 
                        defaultValue={user?.email}
                        disabled
                        className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed"
                      />
                    </div>

                    <button 
                      onClick={handleUpdateProfile}
                      disabled={isUpdatingProfile || !profileName.trim()}
                      className="px-6 py-3.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg"
                    >
                      {isUpdatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Edit3 size={18} />}
                      Guardar Cambios
                    </button>
                  </div>

                  <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border border-white/10 h-fit flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-bl-full -mr-10 -mt-10" />
                    <h3 className="text-xl font-bold text-white mb-6 relative z-10 flex items-center gap-2">
                      <Award className="text-gold" size={20} /> Tu Suscripción
                    </h3>
                    <div className="space-y-5 relative z-10 flex-1">
                      <div className="flex justify-between items-center pb-5 border-b border-white/5">
                        <span className="text-textMuted font-medium">Plan actual</span>
                        <span className="text-gold font-bold uppercase tracking-widest text-lg">{user?.plan || "Free"}</span>
                      </div>
                      <div className="flex justify-between items-center pb-5 border-b border-white/5">
                        <span className="text-textMuted font-medium">Estado</span>
                        <span className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-md border border-green-500/20 text-sm flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Activo
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-textMuted font-medium">Miembro desde</span>
                        <span className="text-white/90 font-medium">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Hoy"}
                        </span>
                      </div>
                    </div>
                    
                    {user?.plan === PLANS.FREE ? (
                      <button className="w-full mt-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/20 relative z-10 hover:border-gold/30 hover:text-gold">
                        Mejorar mi Plan
                      </button>
                    ) : (
                      <button className="w-full mt-8 py-3.5 bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-all border border-white/5 text-sm relative z-10">
                        Gestionar Métodos de Pago
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StudentDashboard;

