import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  UploadCloud, Plus, Video, Trash2, Edit2, CheckCircle2, ChevronDown, 
  Eye, EyeOff, ArrowUp, ArrowDown, Loader2, BookOpen,
  LayoutGrid, PlayCircle, GripVertical, FileVideo, Film
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { 
  fetchModules, fetchLessons, createModule, createLesson, 
  updateModule, deleteModule, updateLesson, deleteLesson,
  updateModuleOrder,
  type Module, type Lesson, getDirectUploadUrl, uploadFileWithProgress 
} from "@/lib/api/stream/content";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-green-500/10 text-green-400 border-green-500/20",
  individual: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  vip: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const PLAN_BADGES: Record<string, string> = {
  free: "bg-green-500 text-black",
  individual: "bg-blue-500 text-white",
  vip: "bg-purple-500 text-white",
};

const AdminContentManager = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonsMap, setLessonsMap] = useState<Record<string, Lesson[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [showCreateModule, setShowCreateModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [newModuleAllowedPlans, setNewModuleAllowedPlans] = useState<("free" | "individual" | "vip")[]>(["free", "individual", "vip"]);
  const [addingToModule, setAddingToModule] = useState<string | null>(null);
  
  const [lessonForm, setLessonForm] = useState<{
    title: string;
    description: string;
    allowed_plans: ("free" | "individual" | "vip")[];
    file: File | null;
  }>({
    title: "",
    description: "",
    allowed_plans: ["free", "individual", "vip"],
    file: null,
  });
  
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<(Lesson & { newFile?: File | null }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const uploadVideo = useCallback(async (file: File): Promise<string> => {
    const { uploadURL, uid } = await getDirectUploadUrl(file.size, file.name);
    setUploadProgress(0);
    try {
      await uploadFileWithProgress(uploadURL, file, (pct) => setUploadProgress(pct));
    } finally {
      setUploadProgress(null);
    }
    return uid;
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const mods = await fetchModules();
      setModules(mods);
      
      const newLessonsMap: Record<string, Lesson[]> = {};
      await Promise.all(mods.map(async (m) => {
        newLessonsMap[m.id] = await fetchLessons(m.id);
      }));

      if (mods.length > 0) {
        setExpandedModules(prev => ({ ...prev, [mods[0].id]: true }));
      }
      
      setLessonsMap(newLessonsMap);
    } catch (err) {
      toast.error("Error al cargar contenido", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const totalLessons = Object.values(lessonsMap).reduce((sum, lessons) => sum + lessons.length, 0);
  const totalVideoLessons = Object.values(lessonsMap).reduce((sum, lessons) => sum + lessons.filter(l => l.stream_uid).length, 0);

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      const newMod = await createModule(newModuleTitle, newModuleDescription, newModuleAllowedPlans);
      setModules([...modules, newMod]);
      setLessonsMap(prev => ({ ...prev, [newMod.id]: [] }));
      setExpandedModules(prev => ({ ...prev, [newMod.id]: true }));
      setNewModuleTitle("");
      setNewModuleDescription("");
      setNewModuleAllowedPlans(["free", "individual", "vip"]);
      setShowCreateModule(false);
      toast.success("Módulo creado", { description: `"${newMod.title}" agregado correctamente.` });
    } catch (err) {
      toast.error("Error al crear módulo", { description: (err as Error).message });
    }
  };

  const handleUpdateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule || !editingModule.title.trim()) return;
    try {
      const updated = await updateModule(editingModule.id, { 
        title: editingModule.title,
        description: editingModule.description,
        allowed_plans: editingModule.allowed_plans
      });
      setModules(modules.map(m => m.id === updated.id ? updated : m));
      setEditingModule(null);
      toast.success("Módulo actualizado");
    } catch (err) {
      toast.error("Error actualizando módulo", { description: (err as Error).message });
    }
  };

  const handleToggleModulePublish = async (mod: Module, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await updateModule(mod.id, { is_published: !mod.is_published });
      setModules(modules.map(m => m.id === mod.id ? updated : m));
      toast.success(mod.is_published ? "Módulo ocultado" : "Módulo publicado");
    } catch (err) {
      toast.error("Error actualizando módulo", { description: (err as Error).message });
    }
  };

  const handleDeleteModule = async (modId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que quieres eliminar este módulo y todas sus lecciones?")) return;
    try {
      await deleteModule(modId);
      setModules(modules.filter(m => m.id !== modId));
      toast.success("Módulo eliminado");
    } catch (err) {
      toast.error("Error eliminando módulo", { description: (err as Error).message });
    }
  };

  const handleCreateLesson = async (moduleId: string) => {
    if (!lessonForm.title.trim()) return;
    setUploading(true);
    try {
      let stream_uid: string | null = null;
      if (lessonForm.file) {
        stream_uid = await uploadVideo(lessonForm.file);
      }

      const newLesson = await createLesson({
        module_id: moduleId,
        title: lessonForm.title,
        description: lessonForm.description,
        allowed_plans: lessonForm.allowed_plans,
        stream_uid,
        is_published: true,
      });

      setLessonsMap(prev => ({
        ...prev,
        [moduleId]: [...(prev[moduleId] || []), newLesson]
      }));

      setAddingToModule(null);
      setLessonForm({ title: "", description: "", allowed_plans: ["free", "individual", "vip"], file: null });
      toast.success("Lección creada", { description: newLesson.stream_uid ? "Video subido y lección publicada." : "Lección publicada (sin video)." });
    } catch (err) {
      toast.error("Error al crear lección", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleLessonPublish = async (lesson: Lesson) => {
    try {
      const updated = await updateLesson(lesson.id, { is_published: !lesson.is_published });
      setLessonsMap(prev => ({
        ...prev,
        [lesson.module_id]: prev[lesson.module_id].map(l => l.id === lesson.id ? updated : l)
      }));
    } catch (err) {
      toast.error("Error actualizando lección", { description: (err as Error).message });
    }
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !editingLesson.title.trim()) return;
    setUploading(true);
    try {
      let stream_uid = editingLesson.stream_uid;
      if (editingLesson.newFile) {
        stream_uid = await uploadVideo(editingLesson.newFile);
      }

      const updated = await updateLesson(editingLesson.id, {
        title: editingLesson.title,
        description: editingLesson.description,
        allowed_plans: editingLesson.allowed_plans,
        stream_uid
      });
      setLessonsMap(prev => ({
        ...prev,
        [updated.module_id]: prev[updated.module_id].map(l => l.id === updated.id ? updated : l)
      }));
      setEditingLesson(null);
      toast.success("Lección actualizada");
    } catch (err) {
      toast.error("Error actualizando lección", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta lección?")) return;
    try {
      await deleteLesson(lesson.id);
      setLessonsMap(prev => ({
        ...prev,
        [lesson.module_id]: prev[lesson.module_id].filter(l => l.id !== lesson.id)
      }));
      toast.success("Lección eliminada");
    } catch (err) {
      toast.error("Error eliminando lección", { description: (err as Error).message });
    }
  };

  const handleMoveModule = async (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === modules.length - 1)) return;
    setReordering(true);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const newModules = [...modules];
    [newModules[index], newModules[swapIndex]] = [newModules[swapIndex], newModules[index]];
    setModules(newModules);
    try {
      await updateModuleOrder(newModules.map(m => m.id));
    } catch (err) {
      toast.error("Error al reordenar", { description: (err as Error).message });
      await loadData();
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-20 space-y-8 px-4 sm:px-0">
        <div className="h-64 w-full bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-10 px-4 sm:px-0">
      {/* Cinematic Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-black border border-white/5 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-darker to-black" />
        <div className="absolute top-0 right-0 p-40 bg-gold/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 p-32 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 p-8 sm:p-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gold mb-2">
                <BookOpen size={14} /> Gestión de Aprendizaje
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Catálogo de Contenido</h1>
              <p className="text-textMuted text-base sm:text-lg leading-relaxed">
                Control maestro del sistema educativo. Administra los módulos, sube lecciones de video en alta calidad y configura el acceso según el plan de los estudiantes.
              </p>
            </div>
            <button 
              onClick={() => {
                setShowCreateModule(true);
                setNewModuleTitle("");
                setNewModuleDescription("");
                setNewModuleAllowedPlans(["free", "individual", "vip"]);
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              className="flex items-center justify-center gap-2 bg-gold hover:bg-goldHover text-black px-6 py-3.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(204,164,59,0.2)] hover:shadow-[0_0_30px_rgba(204,164,59,0.4)] active:scale-[0.98] whitespace-nowrap"
            >
              <Plus size={20} /> Crear Nuevo Módulo
            </button>
          </div>

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center border border-gold/10">
                <LayoutGrid className="text-gold" size={24} />
              </div>
              <div>
                <p className="text-xs text-textMuted uppercase font-bold tracking-wider mb-1">Módulos</p>
                <p className="text-2xl font-black text-white">{modules.length}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center border border-blue-500/10">
                <PlayCircle className="text-blue-400" size={24} />
              </div>
              <div>
                <p className="text-xs text-textMuted uppercase font-bold tracking-wider mb-1">Lecciones</p>
                <p className="text-2xl font-black text-white">{totalLessons}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center border border-green-500/10">
                <CheckCircle2 className="text-green-400" size={24} />
              </div>
              <div>
                <p className="text-xs text-textMuted uppercase font-bold tracking-wider mb-1">Con Video HD</p>
                <p className="text-2xl font-black text-white">{totalVideoLessons}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Module Form (Slide Down) */}
      <AnimatePresence>
        {showCreateModule && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20, transition: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="bg-darker border border-gold/30 shadow-[0_0_40px_rgba(204,164,59,0.05)] rounded-3xl p-6 sm:p-8 relative">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <LayoutGrid className="text-gold" size={22} /> Formulario de Módulo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Título del Módulo</label>
                  <input 
                    type="text"
                    value={newModuleTitle}
                    onChange={e => setNewModuleTitle(e.target.value)}
                    placeholder="Ej: Fundamentos del Liderazgo"
                    className="w-full bg-black/60 text-white px-5 py-3.5 rounded-xl outline-none text-base border border-white/10 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all placeholder:text-white/20"
                    autoFocus
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Descripción Breve</label>
                  <textarea
                    value={newModuleDescription}
                    onChange={e => setNewModuleDescription(e.target.value)}
                    placeholder="Escribe un resumen atractivo para este módulo..."
                    className="w-full bg-black/60 text-white px-5 py-3.5 rounded-xl outline-none text-base border border-white/10 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none h-24 placeholder:text-white/20"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Planes con Acceso</label>
                  <div className="flex flex-wrap gap-3">
                    {["free", "individual", "vip"].map((plan) => {
                      const isSelected = newModuleAllowedPlans.includes(plan as any);
                      return (
                        <label
                          key={plan}
                          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold ${
                            isSelected
                              ? PLAN_COLORS[plan]
                              : "border-white/5 text-white/40 hover:border-white/20 bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewModuleAllowedPlans([...newModuleAllowedPlans, plan as any]);
                              } else {
                                setNewModuleAllowedPlans(newModuleAllowedPlans.filter(p => p !== plan));
                              }
                            }}
                            className="hidden"
                          />
                          <span className={`w-4 h-4 rounded-md border flex items-center justify-center ${isSelected ? 'bg-current border-transparent' : 'border-white/20'}`}>
                            {isSelected && <CheckCircle2 size={12} className={plan === 'free' ? 'text-green-900' : plan === 'individual' ? 'text-blue-900' : 'text-purple-900'} />}
                          </span>
                          <span className="capitalize">{plan}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end mt-8 pt-6 border-t border-white/5">
                <button 
                  onClick={() => setShowCreateModule(false)}
                  className="px-6 py-3 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-bold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateModule}
                  disabled={!newModuleTitle.trim()}
                  className="px-8 py-3 bg-gold hover:bg-goldHover text-black rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gold/20"
                >
                  Crear Módulo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {modules.length === 0 && !showCreateModule && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-32 bg-darker border border-white/5 rounded-3xl shadow-xl"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gold/20 to-transparent p-px">
            <div className="w-full h-full bg-darker rounded-[23px] flex items-center justify-center">
              <FileVideo size={36} className="text-gold" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">Tu catálogo está vacío</h3>
          <p className="text-textMuted max-w-md mx-auto text-base leading-relaxed mb-8">
            Comienza a construir la academia agregando tu primer módulo. Luego podrás subir tus lecciones en video.
          </p>
          <button 
            onClick={() => setShowCreateModule(true)}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            <Plus size={18} /> Crear Primer Módulo
          </button>
        </motion.div>
      )}

      {/* Modules List */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {modules.map((mod, idx) => (
            <motion.div 
              key={mod.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`relative bg-darker rounded-3xl overflow-hidden transition-all duration-300 shadow-xl ${
                !mod.is_published
                  ? 'border-2 border-dashed border-white/10 opacity-80 hover:opacity-100'
                  : 'border border-white/10 hover:border-gold/30'
              }`}
            >
              {/* Status Indicator Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${mod.is_published ? 'bg-gold' : 'bg-white/10'}`} />

              {/* Module Header - Edit Mode */}
              {editingModule?.id === mod.id ? (
                <div className="p-6 sm:p-8 bg-black/40 pl-8">
                  <form onSubmit={handleUpdateModule} className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Edit2 className="text-gold" size={20} />
                      <h4 className="text-lg font-bold text-white">Editar Módulo</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Título</label>
                        <input 
                          type="text" 
                          value={editingModule.title} 
                          onChange={e => setEditingModule({...editingModule, title: e.target.value})}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Descripción</label>
                        <textarea 
                          value={editingModule?.description || ""} 
                          onChange={e => {
                            if (editingModule) {
                              setEditingModule({...editingModule, description: e.target.value});
                            }
                          }}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none h-24"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Acceso (Planes)</label>
                        <div className="flex flex-wrap gap-3">
                          {["free", "individual", "vip"].map((plan) => {
                            const isSelected = editingModule?.allowed_plans?.includes(plan as any);
                            return (
                              <label
                                key={plan}
                                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold ${
                                  isSelected ? PLAN_COLORS[plan] : "border-white/5 text-white/40 hover:border-white/20 bg-white/5"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (editingModule) {
                                      const plans = editingModule.allowed_plans || [];
                                      if (e.target.checked) {
                                        setEditingModule({...editingModule, allowed_plans: [...plans, plan as any]});
                                      } else {
                                        setEditingModule({...editingModule, allowed_plans: plans.filter(p => p !== plan)});
                                      }
                                    }
                                  }}
                                  className="hidden"
                                />
                                <span className={`w-4 h-4 rounded-md border flex items-center justify-center ${isSelected ? 'bg-current border-transparent' : 'border-white/20'}`}>
                                  {isSelected && <CheckCircle2 size={12} className={plan === 'free' ? 'text-green-900' : plan === 'individual' ? 'text-blue-900' : 'text-purple-900'} />}
                                </span>
                                <span className="capitalize">{plan}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                      <button type="button" onClick={() => setEditingModule(null)} className="px-6 py-2.5 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-bold">Cancelar</button>
                      <button type="submit" className="px-8 py-2.5 bg-gold hover:bg-goldHover text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-gold/20">Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Module Header - View Mode */
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 pl-6 sm:pl-8 gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none group"
                  onClick={() => toggleModule(mod.id)}
                >
                  <div className="flex items-start sm:items-center gap-4 sm:gap-6 min-w-0 flex-1">
                    {/* Move Controls (Visible on hover in desktop) */}
                    <div className="hidden sm:flex flex-col gap-1 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, "up"); }}
                        disabled={idx === 0 || reordering}
                        className="p-1.5 text-white/50 hover:text-gold hover:bg-gold/10 rounded-md disabled:opacity-20 disabled:hover:bg-transparent transition-all"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, "down"); }}
                        disabled={idx === modules.length - 1 || reordering}
                        className="p-1.5 text-white/50 hover:text-gold hover:bg-gold/10 rounded-md disabled:opacity-20 disabled:hover:bg-transparent transition-all"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>

                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                      mod.is_published
                        ? 'bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 text-gold'
                        : 'bg-white/5 border border-white/10 text-white/30'
                    }`}>
                      <LayoutGrid size={24} />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-xl font-extrabold text-white truncate min-w-0 tracking-tight">{mod.title}</h3>
                        {!mod.is_published && (
                          <span className="text-[10px] font-bold bg-white/10 text-white/60 border border-white/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Borrador
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm font-medium text-white/40">
                        <span className="flex items-center gap-1.5">
                          <Film size={14} /> {lessonsMap[mod.id]?.length || 0} lecciones
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                        <span className="hidden sm:flex items-center gap-1.5">
                          <GripVertical size={14} /> Posición {idx + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:ml-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingModule(mod); }}
                      className="p-2.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                      title="Editar Módulo"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => handleToggleModulePublish(mod, e)}
                      className={`p-2.5 rounded-xl transition-all ${
                        mod.is_published
                          ? 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10'
                          : 'text-amber-400/80 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                      }`}
                      title={mod.is_published ? "Ocultar Módulo" : "Publicar Módulo"}
                    >
                      {mod.is_published ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button
                      onClick={(e) => handleDeleteModule(mod.id, e)}
                      className="p-2.5 text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all"
                      title="Eliminar Módulo"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className={`ml-2 p-2 rounded-full transition-transform duration-300 ${expandedModules[mod.id] ? 'bg-white/10 rotate-180' : 'bg-transparent rotate-0'}`}>
                      <ChevronDown className="text-white/50" size={20} />
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Lessons Section */}
              <AnimatePresence>
                {expandedModules[mod.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="border-t border-white/5 bg-black/30"
                  >
                    <div className="p-4 sm:p-6 pl-6 sm:pl-10 space-y-4">
                      
                      {/* Empty Lessons State */}
                      {(lessonsMap[mod.id]?.length || 0) === 0 && (
                        <div className="text-center py-10 bg-white/[0.01] rounded-2xl border border-white/[0.02]">
                          <Video size={32} className="mx-auto text-white/10 mb-4" />
                          <p className="text-white/40 text-base font-medium">Este módulo aún no tiene contenido.</p>
                          <p className="text-white/20 text-sm mt-1">Añade tu primera lección a continuación.</p>
                        </div>
                      )}

                      {/* Lesson Items */}
                      <div className="space-y-3">
                        {lessonsMap[mod.id]?.map((lesson, lIdx) => (
                          <AnimatePresence key={lesson.id} mode="popLayout">
                            {editingLesson?.id === lesson.id ? (
                              /* Edit Lesson Form */
                              <motion.form
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                onSubmit={handleUpdateLesson}
                                className="p-5 sm:p-6 bg-darker border border-gold/30 shadow-[0_0_20px_rgba(204,164,59,0.05)] rounded-2xl space-y-5"
                              >
                                <h4 className="text-base font-bold text-gold flex items-center gap-2 mb-2">
                                  <Edit2 size={18} /> Editando Lección
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Título</label>
                                    <input 
                                      type="text" 
                                      value={editingLesson.title} 
                                      onChange={e => setEditingLesson({...editingLesson, title: e.target.value})}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3 text-sm text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Descripción</label>
                                    <textarea 
                                      value={editingLesson.description || ""} 
                                      onChange={e => setEditingLesson({...editingLesson, description: e.target.value})}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3 text-sm text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none h-20"
                                    />
                                  </div>
                                  
                                  {/* Video Upload Zone */}
                                  <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">
                                      {editingLesson.stream_uid ? "Reemplazar Video" : "Subir Video"}
                                    </label>
                                    <div 
                                      className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                        dragActive ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-gold/30 bg-black/40 hover:bg-black/60'
                                      } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                      onDragLeave={() => setDragActive(false)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragActive(false);
                                        const file = e.dataTransfer.files[0];
                                        if (file && file.type.startsWith('video/')) {
                                          setEditingLesson({...editingLesson, newFile: file});
                                        }
                                      }}
                                      onClick={() => !uploading && document.getElementById(`edit-video-upload-${lesson.id}`)?.click()}
                                    >
                                      <input 
                                        id={`edit-video-upload-${lesson.id}`}
                                        type="file" 
                                        accept="video/*" 
                                        className="hidden"
                                        disabled={uploading}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) setEditingLesson({...editingLesson, newFile: file});
                                        }}
                                      />
                                      <UploadCloud size={32} className={editingLesson.newFile ? "text-gold mb-3" : "text-white/30 mb-3"} />
                                      {editingLesson.newFile ? (
                                        <p className="text-gold font-bold text-sm">{editingLesson.newFile.name}</p>
                                      ) : editingLesson.stream_uid ? (
                                        <p className="text-white/60 text-sm">Arrastra o clic para <b>reemplazar</b> el video actual</p>
                                      ) : (
                                        <p className="text-white/60 text-sm">Arrastra un video aquí o haz clic</p>
                                      )}
                                    </div>
                                    {uploadProgress !== null && (
                                      <div className="mt-2">
                                        <div className="flex justify-between text-xs font-bold mb-1.5 text-gold">
                                          <span>Subiendo...</span>
                                          <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-black rounded-full overflow-hidden border border-white/10">
                                          <motion.div className="h-full bg-gold" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Access Plans */}
                                  <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Planes Permitidos</label>
                                    <div className="flex flex-wrap gap-2">
                                      {["free", "individual", "vip"].map((plan) => (
                                        <label key={plan} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 cursor-pointer transition-all text-xs font-bold ${
                                          editingLesson.allowed_plans?.includes(plan as any) ? PLAN_COLORS[plan] : "border-white/5 text-white/40 hover:border-white/20"
                                        }`}>
                                          <input type="checkbox" className="hidden" 
                                            checked={editingLesson.allowed_plans?.includes(plan as any)}
                                            onChange={(e) => {
                                              const plans = editingLesson.allowed_plans || [];
                                              if (e.target.checked) setEditingLesson({...editingLesson, allowed_plans: [...plans, plan as any]});
                                              else setEditingLesson({...editingLesson, allowed_plans: plans.filter(p => p !== plan)});
                                            }}
                                          />
                                          <span className="capitalize">{plan}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                  <button type="button" disabled={uploading} onClick={() => setEditingLesson(null)} className="px-5 py-2.5 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-bold">Cancelar</button>
                                  <button type="submit" disabled={uploading || !editingLesson.title.trim()} className="px-6 py-2.5 bg-gold hover:bg-goldHover text-black rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-gold/20 flex items-center gap-2">
                                    {uploading ? <><Loader2 size={16} className="animate-spin" /> Subiendo</> : "Guardar Cambios"}
                                  </button>
                                </div>
                              </motion.form>
                            ) : (
                              /* View Lesson Item */
                              <motion.div
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl group transition-all ${
                                  !lesson.is_published
                                    ? 'bg-transparent border border-dashed border-white/10 opacity-70'
                                    : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-lg hover:shadow-black/50'
                                }`}
                              >
                                {lesson.is_published && (
                                  <div className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-gold to-gold/10 rounded-r-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                )}
                                
                                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1 pl-2">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                                    lesson.is_published ? 'bg-gold/10 text-gold border border-gold/20' : 'bg-white/5 text-white/30 border border-white/10'
                                  }`}>
                                    <Video size={20} />
                                  </div>
                                  
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-mono font-bold text-white/30">
                                        {String(lIdx + 1).padStart(2, '0')}
                                      </span>
                                      <p className="text-base font-bold text-white truncate min-w-0 group-hover:text-gold transition-colors">
                                        {lesson.title}
                                      </p>
                                      {!lesson.is_published && (
                                        <span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded-md uppercase">Borrador</span>
                                      )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1">
                                        {lesson.allowed_plans?.map(plan => (
                                          <span key={plan} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${PLAN_BADGES[plan] || 'bg-white/10 text-white'}`}>
                                            {plan}
                                          </span>
                                        ))}
                                      </div>
                                      
                                      {lesson.stream_uid ? (
                                        <span className="text-[11px] font-medium text-green-400/80 flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20">
                                          <CheckCircle2 size={12} /> Video HD
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-medium text-amber-400/80 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                          Sin Video
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity justify-end sm:justify-start">
                                  <button
                                    onClick={() => handleToggleLessonPublish(lesson)}
                                    className={`p-2.5 rounded-xl transition-all ${lesson.is_published ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-amber-400 hover:bg-amber-500/20'}`}
                                    title={lesson.is_published ? "Ocultar" : "Publicar"}
                                  >
                                    {lesson.is_published ? <Eye size={18} /> : <EyeOff size={18} />}
                                  </button>
                                  <button
                                    onClick={() => setEditingLesson(lesson)}
                                    className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(lesson)}
                                    className="p-2.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        ))}
                      </div>

                      {/* Add Lesson Form / Button */}
                      <AnimatePresence mode="wait">
                        {addingToModule === mod.id ? (
                          <motion.div
                            key="form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-6 border border-gold/30 bg-gradient-to-b from-gold/5 to-transparent rounded-2xl overflow-hidden shadow-lg"
                          >
                            <div className="p-6 sm:p-8 space-y-6">
                              <h4 className="text-lg font-bold text-gold flex items-center gap-2">
                                <Plus size={20} /> Añadir Nueva Lección
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2 md:col-span-2">
                                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Título de la Lección</label>
                                  <input 
                                    type="text" placeholder="Ej: Episodio 1 - El Despertar" 
                                    value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-base text-white focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all placeholder:text-white/20"
                                  />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Descripción</label>
                                  <textarea 
                                    placeholder="Detalles sobre esta lección..." 
                                    value={lessonForm.description} onChange={e => setLessonForm({...lessonForm, description: e.target.value})}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-base text-white focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none transition-all resize-none h-24 placeholder:text-white/20"
                                  />
                                </div>
                                
                                {/* Dropzone */}
                                <div className="space-y-2 md:col-span-2">
                                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest ml-1">Video HD (Opcional, directo a Cloudflare)</label>
                                  <div
                                    className={`w-full border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                      dragActive ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-gold/40 bg-black/40 hover:bg-black/60'
                                    } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                    onDragLeave={() => setDragActive(false)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setDragActive(false);
                                      const file = e.dataTransfer.files[0];
                                      if (file && file.type.startsWith('video/')) setLessonForm({...lessonForm, file});
                                    }}
                                    onClick={() => !uploading && document.getElementById('new-video-upload')?.click()}
                                  >
                                    <input 
                                      id="new-video-upload" type="file" accept="video/*" className="hidden" disabled={uploading}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setLessonForm({...lessonForm, file});
                                      }}
                                    />
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${lessonForm.file ? 'bg-gold/20 text-gold' : 'bg-white/5 text-white/30'}`}>
                                      <UploadCloud size={32} />
                                    </div>
                                    {lessonForm.file ? (
                                      <div className="text-center">
                                        <p className="text-gold font-bold text-lg mb-1">{lessonForm.file.name}</p>
                                        <p className="text-white/50 text-sm font-mono">{(lessonForm.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                      </div>
                                    ) : (
                                      <div className="text-center">
                                        <p className="text-white font-bold text-base mb-1">Arrastra el archivo de video aquí</p>
                                        <p className="text-white/40 text-sm">O haz clic para explorar. Formatos soportados: MP4, MOV, WebM.</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Progress bar */}
                                  {uploadProgress !== null && (
                                    <div className="mt-3 bg-black/40 p-4 rounded-xl border border-white/5">
                                      <div className="flex justify-between items-center text-sm font-bold mb-2">
                                        <span className="flex items-center gap-2 text-white/70"><Loader2 size={16} className="animate-spin text-gold" /> Subiendo a la nube...</span>
                                        <span className="text-gold text-lg">{uploadProgress}%</span>
                                      </div>
                                      <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10 shadow-inner">
                                        <motion.div className="h-full bg-gradient-to-r from-gold to-yellow-300" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 mt-2 border-t border-white/10">
                                <button 
                                  onClick={() => { if (!uploading) setAddingToModule(null); }}
                                  className="px-6 py-3 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all font-bold"
                                  disabled={uploading}
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={() => handleCreateLesson(mod.id)}
                                  disabled={uploading || !lessonForm.title.trim()}
                                  className="flex items-center justify-center gap-2 bg-gold hover:bg-goldHover text-black font-bold px-8 py-3 rounded-xl text-sm transition-all disabled:opacity-50 shadow-lg shadow-gold/20"
                                >
                                  {uploading ? <><Loader2 size={18} className="animate-spin" /> Procesando...</> : "Guardar Lección"}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                            <button 
                              onClick={() => {
                                setAddingToModule(mod.id);
                                setLessonForm({ title: "", description: "", allowed_plans: ["free", "individual", "vip"], file: null });
                              }}
                              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-white/10 rounded-2xl text-white/40 hover:text-gold hover:border-gold/30 hover:bg-gold/[0.02] transition-all text-sm font-bold active:scale-[0.99] shadow-sm"
                            >
                              <Plus size={18} /> Añadir Lección
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminContentManager;