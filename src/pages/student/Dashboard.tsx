import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  PlayCircle,
  Trophy,
  Users,
  Edit3,
  Award,
  Video,
  User as UserIcon,
  Camera,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LessonPlayer from "@/components/feature/LessonPlayer";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { PLANS } from "@/types/user";
import { supabase } from "@/lib/supabase";
import { fetchModules, fetchLessons, type Module as DBModule, type Lesson as DBLesson } from "@/lib/api/stream/content";

type TabId = "modulos" | "notas" | "certificados" | "comunidad" | "live" | "perfil";

const getInitials = (name: string) => {
  if (!name) return "US";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("modulos");

  // Efecto para leer el parámetro '?tab=perfil' de la URL (desde el Header)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("tab") === "perfil") {
      setActiveTab("perfil");
    } else if (searchParams.get("tab") === "modulos") {
      setActiveTab("modulos");
    }
  }, [location.search]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<DBLesson | null>(null);
  const [dbModules, setDbModules] = useState<DBModule[]>([]);
  const [dbLessonsMap, setDbLessonsMap] = useState<Record<string, DBLesson[]>>({});
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  // Load content from Supabase
  useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoadingContent(true);
        const modules = await fetchModules();
        const publishedModules = modules.filter(m => m.is_published);
        setDbModules(publishedModules);
        
        const lessonsMap: Record<string, DBLesson[]> = {};
        for (const mod of publishedModules) {
          const lessons = await fetchLessons(mod.id);
          lessonsMap[mod.id] = lessons.filter(l => l.is_published);
        }
        setDbLessonsMap(lessonsMap);

        if (publishedModules.length > 0) {
          const firstModId = publishedModules[0].id;
          setSelectedModule(firstModId);
          if (lessonsMap[firstModId]?.length > 0) {
            setActiveLesson(lessonsMap[firstModId][0]);
          }
        }
      } catch (error) {
        console.error("Error loading content from DB:", error);
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, []);
  
  // Estado para Notas
  const [personalNote, setPersonalNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  
  // Estado para todas las notas (para la pestaña Libreta)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allNotes, setAllNotes] = useState<any[]>([]);

  // Cargar nota de la lección activa
  useEffect(() => {
    const loadNote = async () => {
      if (!user || !activeLesson) return;
      setNoteMessage(null);
      try {
        const { data, error } = await supabase
          .from("lesson_notes")
          .select("content")
          .eq("user_id", user.id)
          .eq("lesson_id", activeLesson.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setPersonalNote(data.content || "");
        } else {
          setPersonalNote("");
        }
      } catch {
        // Fallback local si no existe tabla en dev
        const localNote = localStorage.getItem(`note_${user.id}_${activeLesson.id}`);
        setPersonalNote(localNote || "");
      }
    };
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id, user]);

  // Cargar todas las notas cuando se abre la pestaña de Libreta
  useEffect(() => {
    if (activeTab === "notas" && user) {
      const loadAllNotes = async () => {
        try {
          const { data, error } = await supabase
            .from("lesson_notes")
            .select("lesson_id, content, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });
          
          if (error) throw error;
          if (data) setAllNotes(data);
        } catch {
          // Fallback a localStorage si la tabla no existe en desarrollo
          const localNotes = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(`note_${user.id}_`)) {
              const lessonId = key.replace(`note_${user.id}_`, "");
              const content = localStorage.getItem(key);
              if (content) {
                localNotes.push({
                  lesson_id: lessonId,
                  content,
                  updated_at: new Date().toISOString()
                });
              }
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
    setNoteMessage(null);
    try {
      const { error } = await supabase
        .from("lesson_notes")
        .upsert(
          { 
            user_id: user.id, 
            lesson_id: activeLesson.id, 
            content: personalNote,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,lesson_id' }
        );

      if (error) throw error;
      setNoteMessage({ type: "success", text: "Nota guardada correctamente" });
      
      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setNoteMessage(null), 3000);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMsg = (err as any).message;
      setNoteMessage({ type: "error", text: "Error: " + errorMsg });
      // Si la tabla no existe (desarrollo), usamos localStorage como fallback
      if (errorMsg?.includes("relation") || errorMsg?.includes("not exist")) {
        localStorage.setItem(`note_${user.id}_${activeLesson.id}`, personalNote);
        setNoteMessage({ type: "success", text: "Guardado localmente (tabla no existe)" });
        setTimeout(() => setNoteMessage(null), 3000);
      }
    } finally {
      setIsSavingNote(false);
    }
  };

  // Estado para el panel de perfil
  const [profileName, setProfileName] = useState(user?.fullName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file)); // Muestra la vista previa instantáneamente
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      let finalAvatarUrl = user.avatarUrl;

      // Si hay un archivo seleccionado, lo subimos primero
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        finalAvatarUrl = publicUrl;
      }

      // Actualizamos los datos en la base de datos
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profileName, avatar_url: finalAvatarUrl })
        .eq("id", user.id);
        
      if (error) throw error;
      
      setUser({ ...user, fullName: profileName, avatarUrl: finalAvatarUrl });
      setAvatarFile(null); // Limpiamos el archivo temporal
      setProfileMessage({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProfileMessage({ type: "error", text: "Error al actualizar: " + (err as any).message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const filteredLessons = selectedModule ? (dbLessonsMap[selectedModule] || []) : [];

  // Al cambiar de módulo, seleccionar la primera lección por defecto
  useEffect(() => {
    if (filteredLessons.length > 0) {
      // Solo cambiar si la lección actual no pertenece al módulo seleccionado
      if (!activeLesson || activeLesson.module_id !== selectedModule) {
        setActiveLesson(filteredLessons[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule]);

  // Helper para saber si el usuario tiene beneficios premium
  const isPremium = user?.plan === PLANS.INDIVIDUAL || user?.plan === PLANS.VIP;

  // Detectar si estamos en modo podcast general (no importamos el componente, solo chequeamos estado para el padding)
  const isPodcastMode = localStorage.getItem("podcast_active") === "true"; // o sacarlo del store si se importa

  return (
    <div className={cn("min-h-screen bg-darker selection:bg-gold/30 font-sans text-textMain flex flex-col", isPodcastMode ? "pb-24 md:pb-28" : "")}>
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar / Profile */}
        <aside className="col-span-1 border-r border-white/10 pr-6 lg:block hidden">
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
            <h3 className="text-xl font-bold text-white capitalize">{user?.fullName || "Estudiante"}</h3>
            <p className="text-xs text-gold mt-1 font-medium tracking-widest uppercase">
              Plan {user?.plan || "Free"}
            </p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-textMuted">Progreso General</span>
              <span className="text-white font-medium">0%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-goldHover" style={{ width: "0%" }}></div>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => { navigate("/dashboard?tab=modulos"); setActiveTab("modulos"); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "modulos" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <PlayCircle size={18} /> Módulos y Clases
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notas")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "notas" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <Edit3 size={18} /> Notas Personales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("certificados")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === "certificados" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
              )}
            >
              <Award size={18} /> Certificados
            </button>

            {isPremium && (
              <button
                type="button"
                onClick={() => setActiveTab("comunidad")}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                  activeTab === "comunidad" ? "bg-white/10 text-white" : "text-textMuted hover:text-white hover:bg-white/5"
                )}
              >
                <Users size={18} /> Comunidad VIP
              </button>
            )}

            {user?.plan === PLANS.VIP && (
              <div className="pt-4 mt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => navigate("/vip-live")}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Video size={18} />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </div>
                    Eventos en Vivo
                  </div>
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* Contenido Principal */}
        <div className="col-span-1 lg:col-span-3">
          {activeTab === "modulos" && (
            <>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide mb-8">
                {isLoadingContent ? (
                  <div className="flex items-center justify-center py-4 w-full text-white/50">
                    <Loader2 className="animate-spin w-5 h-5 mr-2" /> Cargando Módulos...
                  </div>
                ) : (
                  dbModules.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setSelectedModule(mod.id);
                        if (dbLessonsMap[mod.id]?.length > 0) {
                          setActiveLesson(dbLessonsMap[mod.id][0]);
                        }
                      }}
                      className={cn(
                        "flex-shrink-0 flex items-center gap-3 px-5 py-3 border rounded-full transition-all whitespace-nowrap",
                        selectedModule === mod.id
                          ? "bg-gold/10 border-gold shadow-[0_0_10px_rgba(204,164,59,0.3)] text-white font-bold"
                          : "bg-white/5 border-white/10 text-textMuted hover:bg-white/10"
                      )}
                    >
                      <BookOpen className="text-gold w-5 h-5" /> <span className="text-sm">{mod.title}</span>
                    </button>
                  ))
                )}
              </div>

              {selectedModule && dbLessonsMap[selectedModule]?.length > 0 && activeLesson ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Zona de Video y Notas (Ocupa 2 de las 3 columnas en desktop) */}
                  <div className="lg:col-span-2">
                    <div className="mb-6 flex justify-between items-end">
                      <div>
                        <span className="text-gold text-sm font-semibold tracking-wider flex items-center gap-2 uppercase mb-2">
                          {dbModules.find((m) => m.id === selectedModule)?.title} <div className="w-1 h-1 rounded-full bg-white/50"></div> Lección {dbLessonsMap[selectedModule].findIndex(l => l.id === activeLesson.id) + 1}
                        </span>
                        <h2 className="text-3xl font-bold text-white mb-2">{activeLesson.title}</h2>
                        {isPremium ? (
                          <span className="text-textMuted flex items-center gap-2 text-sm">
                            <Trophy size={16} className="text-gold" /> Módulo actualizado. Tú eres Premium.
                          </span>
                        ) : (
                          <span className="text-textMuted flex items-center gap-2 text-sm">
                            <PlayCircle size={16} className="text-gray-400" /> Viendo versión gratuita con anuncios.
                          </span>
                        )}
                      </div>
                    </div>

                    <LessonPlayer 
                      videoSrc={activeLesson.stream_uid || ""} 
                      isPremium={isPremium} 
                      lesson={{
                        id: activeLesson.id as unknown as number, // Temp cast para no romper tipado de LessonPlayer
                        titulo: activeLesson.title,
                        modId: activeLesson.module_id as unknown as number
                      }}
                      moduleTitle={dbModules.find(m => m.id === activeLesson.module_id)?.title || ""}
                    />

                    <div className="mt-8 bg-black/30 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium flex items-center gap-2">
                          <Edit3 size={18} /> Apuntes Rápidos
                        </h4>
                        {noteMessage && (
                          <span className={cn("text-xs font-semibold px-2 py-1 rounded", noteMessage.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                            {noteMessage.text}
                          </span>
                        )}
                      </div>
                      <textarea
                        value={personalNote}
                        onChange={(e) => setPersonalNote(e.target.value)}
                        disabled={!isPremium || isSavingNote}
                        placeholder={isPremium ? "Escribe tus reflexiones de esta lección sin pausar el video..." : "El plan Free no incluye toma de notas. ¡Mejora tu plan!"}
                        className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-gold resize-none h-24 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      ></textarea>
                      <div className="flex justify-end mt-3">
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={!isPremium || isSavingNote || !personalNote.trim()}
                          className="px-5 py-2 text-sm bg-white/10 hover:bg-gold hover:text-darker border border-white/10 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isSavingNote ? <Loader2 size={16} className="animate-spin" /> : null}
                          Guardar Notas
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Zona de Lista de Lecciones (Ocupa 1 de las 3 columnas en desktop) */}
                  <div className="lg:col-span-1">
                    <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full max-h-[600px]">
                      <div className="p-4 border-b border-white/10 bg-white/5">
                        <h3 className="font-bold text-white flex items-center justify-between">
                          Contenido del Módulo
                          <span className="text-xs font-normal text-textMuted bg-black/50 px-2 py-1 rounded">
                            {dbLessonsMap[selectedModule].findIndex(l => l.id === activeLesson.id) + 1} / {dbLessonsMap[selectedModule].length}
                          </span>
                        </h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {dbLessonsMap[selectedModule].map((lesson, index) => {
                          const isActive = activeLesson.id === lesson.id;
                          const isCompleted = index === 0; // Mock temporal
                          
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setActiveLesson(lesson)}
                              className={cn(
                                "w-full text-left p-3 rounded-xl transition-all flex gap-3 group",
                                isActive 
                                  ? "bg-gold/10 border border-gold/30" 
                                  : "bg-transparent border border-transparent hover:bg-white/5"
                              )}
                            >
                              <div className="shrink-0 pt-1">
                                {isActive ? (
                                  <div className="w-6 h-6 rounded-full bg-gold text-darker flex items-center justify-center">
                                    <PlayCircle size={14} className="ml-0.5" />
                                  </div>
                                ) : isCompleted ? (
                                  <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/30">
                                    <CheckCircle2 size={14} />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-white/5 text-textMuted flex items-center justify-center border border-white/10 group-hover:border-white/30">
                                    <span className="text-[10px] font-bold">{index + 1}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className={cn(
                                  "text-sm font-medium leading-tight mb-1 line-clamp-2 transition-colors",
                                  isActive ? "text-gold font-bold" : "text-white/80 group-hover:text-white"
                                )}>
                                  {lesson.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className={isActive ? "text-gold/70" : "text-textMuted"}>
                                    Plan {lesson.required_plan.toUpperCase()}
                                  </span>
                                  {isCompleted && !isActive && (
                                    <>
                                      <span className="text-white/20">·</span>
                                      <span className="text-green-400/80">Completada</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
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
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6 text-center">
                <Edit3 size={40} className="mx-auto text-gold mb-4" />
                <h2 className="text-2xl font-bold text-white">Libreta de Aprendizaje</h2>
                <p className="text-textMuted mt-2 max-w-lg mx-auto">
                  Aquí se guardan todos tus apuntes rápidos organizados por lección. Usa esta libreta para repasar los conceptos clave de tu proceso.
                </p>
              </div>

              {allNotes.length === 0 ? (
                <div className="text-center py-12 border border-white/5 bg-black/20 rounded-2xl">
                  <p className="text-white/40">Aún no tienes notas guardadas.</p>
                  <p className="text-white/30 text-sm mt-1">Ve a una lección y guarda tus primeros apuntes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allNotes.map((note, index) => {
                    let leccionTitle = "Lección Desconocida";
                    let moduloTitle = "Módulo Desconocido";
                    
                    // Buscar la lección y módulo correspondientes en el estado cargado
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
                      <div key={index} className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-gold/30 transition-colors group">
                        <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                          <div>
                            <span className="text-xs font-bold text-gold uppercase tracking-wider block mb-1">
                              {moduloTitle}
                            </span>
                            <h3 className="text-white font-medium line-clamp-1" title={leccionTitle}>
                              {leccionTitle}
                            </h3>
                          </div>
                          <span className="text-[10px] text-white/30 whitespace-nowrap bg-white/5 px-2 py-1 rounded">
                            {new Date(note.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-white/80 text-sm flex-1 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
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

          {activeTab === "perfil" && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <UserIcon className="text-gold" /> Mi Panel
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-textMuted mb-2">Foto de Perfil</label>
                    <div className="flex items-center gap-6">
                      <div className="relative w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center border-2 border-gold/30 text-3xl font-bold text-gold shadow-lg group overflow-hidden">
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
                      <div className="text-sm text-textMuted">
                        <p>Haz clic en la imagen para subir una nueva.</p>
                        <p className="text-xs mt-1">Recomendado: 400x400px (Max 2MB)</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-textMuted mb-2">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50"
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
                  
                  {profileMessage && (
                    <div className={cn("p-3 rounded-lg text-sm font-medium", profileMessage.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                      {profileMessage.text}
                    </div>
                  )}

                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    className="px-6 py-3 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUpdatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Guardar Cambios
                  </button>
                </div>

                <div className="bg-black/30 rounded-2xl p-6 border border-white/5 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Información de Suscripción</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between pb-4 border-b border-white/5">
                      <span className="text-textMuted">Plan actual</span>
                      <span className="text-gold font-bold uppercase">{user?.plan || "Free"}</span>
                    </div>
                    <div className="flex justify-between pb-4 border-b border-white/5">
                      <span className="text-textMuted">Estado</span>
                      <span className="text-green-400 font-medium">Activo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">Miembro desde</span>
                      <span className="text-white">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Hoy"}
                      </span>
                    </div>
                  </div>
                  
                  {user?.plan === PLANS.FREE ? (
                    <button className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all border border-white/10">
                      Mejorar mi Plan
                    </button>
                  ) : (
                    <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-all border border-white/5 text-sm">
                      Gestionar Suscripción
                    </button>
                  )}
                </div>
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
