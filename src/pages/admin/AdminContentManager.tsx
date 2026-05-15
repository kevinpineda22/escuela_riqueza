import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, Plus, Video, Trash2, Edit2, CheckCircle2, ChevronDown, ChevronRight, Eye, EyeOff, ArrowUp, ArrowDown, Loader2, BookOpen } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { 
  fetchModules, fetchLessons, createModule, createLesson, 
  updateModule, deleteModule, updateLesson, deleteLesson,
  updateModuleOrder,
  type Module, type Lesson, getDirectUploadUrl, uploadFileWithProgress 
} from "@/lib/api/stream/content";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-green-500/15 text-green-400 border-green-500/20",
  individual: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  vip: "bg-purple-500/15 text-purple-400 border-purple-500/20",
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
      <div className="max-w-5xl mx-auto pb-20 space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-3">
            <div className="h-8 w-56 bg-white/10 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-gold/20 rounded-xl animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestor de Contenido</h1>
          <p className="text-textMuted mt-1.5 text-sm">Organiza los módulos, lecciones y videos de la Escuela.</p>
        </div>
        <button 
          onClick={() => {
            setShowCreateModule(true);
            setNewModuleTitle("");
            setNewModuleDescription("");
            setNewModuleAllowedPlans(["free", "individual", "vip"]);
          }}
          className="flex items-center gap-2 bg-gold hover:bg-goldHover text-darker px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-gold/20 hover:shadow-gold/30 active:scale-[0.98]"
        >
          <Plus size={18} /> Nuevo Módulo
        </button>
      </div>

      {/* Stats bar */}
      {modules.length > 0 && (
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs text-textMuted bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-3">
          <span className="flex items-center gap-2">
            <BookOpen size={14} className="text-gold/70" /> {modules.length} módulo{modules.length !== 1 ? "s" : ""}
          </span>
          <span className="w-px h-4 bg-white/10" />
          <span className="flex items-center gap-2">
            <Video size={14} className="text-blue-400/70" /> {totalLessons} leccione{totalLessons !== 1 ? "s" : ""}
          </span>
          <span className="w-px h-4 bg-white/10" />
          <span className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400/70" /> {totalVideoLessons} con video
          </span>
        </div>
      )}

      {/* Create Module Card */}
      <AnimatePresence>
        {showCreateModule && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="relative bg-gradient-to-br from-gold/5 to-darker border border-gold/20 rounded-2xl p-5 sm:p-6 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-gold/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-gold flex items-center gap-2 mb-5">
                <BookOpen size={20} /> Crear Nuevo Módulo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Título</label>
                  <input 
                    type="text"
                    value={newModuleTitle}
                    onChange={e => setNewModuleTitle(e.target.value)}
                    placeholder="Ej: Los 6 Hábitos de la Riqueza"
                    className="w-full bg-black/50 text-white px-4 py-2.5 rounded-xl outline-none text-sm border border-white/10 focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
                    autoFocus
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Descripción</label>
                  <textarea
                    value={newModuleDescription}
                    onChange={e => setNewModuleDescription(e.target.value)}
                    placeholder="Describe brevemente de qué trata este módulo..."
                    className="w-full bg-black/50 text-white px-4 py-2.5 rounded-xl outline-none text-sm border border-white/10 focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all resize-none h-20"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Planes que pueden acceder</label>
                  <div className="flex flex-wrap gap-2">
                    {["free", "individual", "vip"].map((plan) => (
                      <label
                        key={plan}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer transition-all text-sm ${
                          newModuleAllowedPlans.includes(plan as any)
                            ? `${PLAN_COLORS[plan]} bg-opacity-100`
                            : "border-white/10 text-white/40 hover:border-white/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={newModuleAllowedPlans.includes(plan as any)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewModuleAllowedPlans([...newModuleAllowedPlans, plan as any]);
                            } else {
                              setNewModuleAllowedPlans(newModuleAllowedPlans.filter(p => p !== plan));
                            }
                          }}
                          className="accent-gold sr-only"
                        />
                        <span className="capitalize font-semibold">{plan}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/5">
                <button 
                  onClick={() => setShowCreateModule(false)}
                  className="px-5 py-2 text-sm text-white/50 hover:text-white transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateModule}
                  disabled={!newModuleTitle.trim()}
                  className="px-6 py-2 bg-gold hover:bg-goldHover text-darker rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  Crear Módulo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module list */}
      {modules.length === 0 && !showCreateModule && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 bg-white/[0.02] border border-white/[0.05] rounded-3xl"
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
            <BookOpen size={32} className="text-gold/60" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No hay contenido aún</h3>
          <p className="text-textMuted max-w-sm mx-auto text-sm leading-relaxed">
            Comienza creando un módulo. Una vez creado, podrás añadirle lecciones con video desde Cloudflare.
          </p>
        </motion.div>
      )}

      <div className="space-y-4">
        <AnimatePresence>
          {modules.map((mod, idx) => (
            <motion.div 
              key={mod.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`relative bg-darker border rounded-2xl overflow-hidden transition-all ${
                !mod.is_published
                  ? 'border-dashed border-white/15 opacity-70'
                  : 'border-white/10 shadow-lg shadow-black/20'
              }`}
            >
              {/* Gold top accent for published */}
              {mod.is_published && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
              )}

              {/* Module Header — Edit mode */}
              {editingModule?.id === mod.id ? (
                <div className="p-4 sm:p-5 bg-white/[0.03] border-b border-white/10">
                  <form onSubmit={handleUpdateModule} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Título</label>
                        <input 
                          type="text" 
                          value={editingModule.title} 
                          onChange={e => setEditingModule({...editingModule, title: e.target.value})}
                          className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Descripción</label>
                        <textarea 
                          value={editingModule?.description || ""} 
                          onChange={e => {
                            if (editingModule) {
                              setEditingModule({...editingModule, description: e.target.value});
                            }
                          }}
                          placeholder="Descripción del módulo"
                          className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all resize-none h-20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Planes</label>
                        <div className="flex flex-wrap gap-2">
                          {["free", "individual", "vip"].map((plan) => (
                            <label
                              key={plan}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer transition-all text-sm ${
                                editingModule?.allowed_plans?.includes(plan as any)
                                  ? `${PLAN_COLORS[plan]}`
                                  : "border-white/10 text-white/40 hover:border-white/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editingModule?.allowed_plans?.includes(plan as any)}
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
                                className="accent-gold sr-only"
                              />
                              <span className="capitalize font-semibold">{plan}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button type="button" onClick={() => setEditingModule(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors font-medium">Cancelar</button>
                      <button type="submit" className="px-5 py-2 bg-gold hover:bg-goldHover text-darker rounded-xl text-sm font-bold transition-all active:scale-[0.98]">Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Module Header — View mode */
                <div
                  className="flex items-center justify-between p-4 sm:p-5 gap-3 cursor-pointer hover:bg-white/[0.01] transition-colors select-none"
                  onClick={() => toggleModule(mod.id)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {/* Order controls */}
                    <div className="hidden sm:flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, "up"); }}
                        disabled={idx === 0 || reordering}
                        title="Subir módulo"
                        className="p-0.5 text-white/15 hover:text-gold disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, "down"); }}
                        disabled={idx === modules.length - 1 || reordering}
                        title="Bajar módulo"
                        className="p-0.5 text-white/15 hover:text-gold disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    {/* Module icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      mod.is_published
                        ? 'bg-gold/10 border-gold/20 text-gold'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}>
                      <BookOpen size={18} />
                    </div>

                    {/* Module info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate min-w-0">{mod.title}</h3>
                        {!mod.is_published && (
                          <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">Borrador</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {lessonsMap[mod.id]?.length || 0} leccione{(lessonsMap[mod.id]?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-white/30 hidden sm:inline">
                          Orden {idx + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingModule(mod); }}
                      title="Editar módulo"
                      className="p-2 text-white/40 hover:text-white bg-transparent rounded-lg hover:bg-white/5 transition-all"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => handleToggleModulePublish(mod, e)}
                      title={mod.is_published ? "Ocultar módulo" : "Publicar módulo"}
                      className={`p-2 rounded-lg transition-all ${
                        mod.is_published
                          ? 'text-white/40 hover:text-white hover:bg-white/5'
                          : 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10'
                      }`}
                    >
                      {mod.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      onClick={(e) => handleDeleteModule(mod.id, e)}
                      title="Eliminar módulo"
                      className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                    <div className="ml-1 text-white/30 hidden sm:block">
                      {expandedModules[mod.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Lessons section */}
              <AnimatePresence>
                {expandedModules[mod.id] && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="p-4 sm:p-5 space-y-2.5 bg-black/20">
                      {/* Empty state */}
                      {(lessonsMap[mod.id]?.length || 0) === 0 && (
                        <div className="text-center py-8">
                          <Video size={28} className="mx-auto text-white/15 mb-3" />
                          <p className="text-textMuted text-sm">Este módulo aún no tiene lecciones.</p>
                        </div>
                      )}

                      {/* Lesson items */}
                      {lessonsMap[mod.id]?.map((lesson) => (
                        <AnimatePresence key={lesson.id} mode="popLayout">
                          {editingLesson?.id === lesson.id ? (
                            /* Lesson Edit Form */
                            <motion.form
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              onSubmit={handleUpdateLesson}
                              className="p-4 sm:p-5 bg-white/[0.04] border border-gold/20 rounded-xl space-y-4"
                            >
                              <h4 className="text-sm font-bold text-gold flex items-center gap-2">
                                <Edit2 size={14} /> Editando Lección
                              </h4>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Título</label>
                                <input 
                                  type="text" 
                                  value={editingLesson.title} 
                                  onChange={e => setEditingLesson({...editingLesson, title: e.target.value})}
                                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Descripción</label>
                                <textarea 
                                  value={editingLesson.description || ""} 
                                  onChange={e => setEditingLesson({...editingLesson, description: e.target.value})}
                                  placeholder="Descripción"
                                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all resize-none h-16"
                                />
                              </div>
                              
                              {/* Video upload zone */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                                  {editingLesson.stream_uid ? "Reemplazar video (opcional)" : "Subir video"}
                                </label>
                                <div 
                                  className={`w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                    dragActive ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-white/30 bg-black/30'
                                  } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
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
                                  <UploadCloud size={24} className={editingLesson.newFile ? "text-gold mb-2" : "text-white/30 mb-2"} />
                                  <span className="text-xs text-center text-white/50">
                                    {editingLesson.newFile ? (
                                      <span className="text-gold font-semibold">{editingLesson.newFile.name}</span>
                                    ) : editingLesson.stream_uid ? (
                                      <span>Arrastra un video o haz clic para <b>reemplazar</b> el actual</span>
                                    ) : (
                                      <span>Arrastra un video o haz clic para seleccionar</span>
                                    )}
                                  </span>
                                </div>

                                {uploadProgress !== null && (
                                  <div className="mt-1">
                                    <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
                                      <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Subiendo a Cloudflare...</span>
                                      <span className="font-mono text-gold font-bold">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${uploadProgress}%` }}
                                        className="h-full bg-gradient-to-r from-gold to-goldHover rounded-full"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Planes</label>
                                <div className="flex flex-wrap gap-2">
                                  {["free", "individual", "vip"].map((plan) => (
                                    <label
                                      key={plan}
                                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer transition-all text-sm ${
                                        editingLesson.allowed_plans?.includes(plan as any)
                                          ? `${PLAN_COLORS[plan]}`
                                          : "border-white/10 text-white/40 hover:border-white/30"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={editingLesson.allowed_plans?.includes(plan as any)}
                                        onChange={(e) => {
                                          const plans = editingLesson.allowed_plans || [];
                                          if (e.target.checked) {
                                            setEditingLesson({...editingLesson, allowed_plans: [...plans, plan as any]});
                                          } else {
                                            setEditingLesson({...editingLesson, allowed_plans: plans.filter(p => p !== plan)});
                                          }
                                        }}
                                        className="accent-gold sr-only"
                                      />
                                      <span className="capitalize font-semibold">{plan}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                                <button type="button" disabled={uploading} onClick={() => { if (!uploading) setEditingLesson(null); }} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors font-medium disabled:opacity-40">Cancelar</button>
                                <button type="submit" disabled={uploading || !editingLesson.title.trim()} className="px-5 py-2 bg-gold hover:bg-goldHover text-darker rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.98] flex items-center gap-2">
                                  {uploading ? <><Loader2 size={14} className="animate-spin" /> Subiendo</> : "Guardar Cambios"}
                                </button>
                              </div>
                            </motion.form>
                          ) : (
                            /* Lesson item — View mode */
                            <motion.div
                              key={lesson.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`relative flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl group overflow-hidden transition-all ${
                                !lesson.is_published
                                  ? 'bg-transparent border border-dashed border-white/10 opacity-60'
                                  : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                              }`}
                            >
                              {lesson.is_published && (
                                <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-gold/50 to-transparent rounded-full" />
                              )}
                              
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pl-1.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                  lesson.is_published
                                    ? 'bg-gold/10 border-gold/20 text-gold/70'
                                    : 'bg-white/5 border-white/10 text-white/30'
                                }`}>
                                  <Video size={16} />
                                </div>
                                
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-white/90 group-hover:text-gold transition-colors truncate min-w-0">
                                      {lesson.title}
                                    </p>
                                    {!lesson.is_published && (
                                      <span className="text-[9px] font-semibold bg-amber-500/10 text-amber-400/80 px-1.5 py-0.5 rounded shrink-0">Borrador</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {lesson.allowed_plans?.map(plan => (
                                      <span key={plan} className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${PLAN_COLORS[plan] || 'border-white/10 text-white/40'}`}>
                                        {plan}
                                      </span>
                                    ))}
                                    {lesson.stream_uid && (
                                      <span className="text-[9px] text-white/30 flex items-center gap-1 ml-0.5" title="Video subido a Cloudflare">
                                        <CheckCircle2 size={9} className="text-green-400/60" /> HD
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-0.5 sm:gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => handleToggleLessonPublish(lesson)}
                                  title={lesson.is_published ? "Ocultar lección" : "Publicar lección"}
                                  className={`p-2 rounded-lg transition-all ${
                                    lesson.is_published
                                      ? 'text-white/40 hover:text-white hover:bg-white/5'
                                      : 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10'
                                  }`}
                                >
                                  {lesson.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button
                                  onClick={() => setEditingLesson(lesson)}
                                  title="Editar lección"
                                  className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-all"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(lesson)}
                                  title="Eliminar lección"
                                  className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      ))}

                      {/* Add Lesson Form / Button */}
                      <AnimatePresence mode="wait">
                        {addingToModule === mod.id ? (
                          <motion.div
                            key="form"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-4 p-4 sm:p-5 border border-gold/20 bg-gold/[0.03] rounded-xl space-y-4"
                          >
                            <h4 className="text-sm font-bold text-gold flex items-center gap-2">
                              <Plus size={16} /> Nueva Lección
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Título</label>
                                <input 
                                  type="text" placeholder="Ej: Lección 1 — El Mindset Millonario" 
                                  value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/30 outline-none transition-all"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Descripción (opcional)</label>
                                <textarea 
                                  placeholder="Describe brevemente el contenido de la lección..." 
                                  value={lessonForm.description} onChange={e => setLessonForm({...lessonForm, description: e.target.value})}
                                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-gold/50 focus:ring-1 focus:ring-gold/30 outline-none transition-all resize-none h-20"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Planes</label>
                                <div className="flex flex-wrap gap-2">
                                  {["free", "individual", "vip"].map((plan) => (
                                    <label
                                      key={plan}
                                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer transition-all text-sm ${
                                        lessonForm.allowed_plans.includes(plan as any)
                                          ? `${PLAN_COLORS[plan]}`
                                          : "border-white/10 text-white/40 hover:border-white/30"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={lessonForm.allowed_plans.includes(plan as any)}
                                        onChange={(e) => {
                                          const plans = lessonForm.allowed_plans;
                                          if (e.target.checked) {
                                            setLessonForm({...lessonForm, allowed_plans: [...plans, plan as any]});
                                          } else {
                                            setLessonForm({...lessonForm, allowed_plans: plans.filter(p => p !== plan)});
                                          }
                                        }}
                                        className="accent-gold sr-only"
                                      />
                                      <span className="capitalize font-semibold">{plan}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Video (opcional)</label>
                                <div
                                  className={`w-full border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                                    dragActive ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-white/30 bg-black/30'
                                  } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                  onDragLeave={() => setDragActive(false)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setDragActive(false);
                                    const file = e.dataTransfer.files[0];
                                    if (file && file.type.startsWith('video/')) {
                                      setLessonForm({...lessonForm, file});
                                    }
                                  }}
                                  onClick={() => !uploading && document.getElementById('new-video-upload')?.click()}
                                >
                                  <input 
                                    id="new-video-upload"
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) setLessonForm({...lessonForm, file});
                                    }}
                                  />
                                  <UploadCloud size={32} className={lessonForm.file ? "text-gold mb-3" : "text-white/30 mb-3"} />
                                  {lessonForm.file ? (
                                    <div className="text-center">
                                      <p className="text-gold font-bold text-sm mb-1">{lessonForm.file.name}</p>
                                      <p className="text-white/50 text-xs">{(lessonForm.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <p className="text-white/70 font-medium text-sm mb-1">Arrastra un video o haz clic</p>
                                      <p className="text-white/40 text-xs">MP4, WebM · Se sube directo a Cloudflare</p>
                                    </div>
                                  )}
                                </div>

                                {uploadProgress !== null && (
                                  <div className="mt-1">
                                    <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
                                      <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Subiendo a Cloudflare...</span>
                                      <span className="font-mono text-gold font-bold">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${uploadProgress}%` }}
                                        className="h-full bg-gradient-to-r from-gold to-goldHover rounded-full"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
                              <button 
                                onClick={() => { if (!uploading) setAddingToModule(null); }}
                                className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors font-medium disabled:opacity-40"
                                disabled={uploading}
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleCreateLesson(mod.id)}
                                disabled={uploading || !lessonForm.title.trim()}
                                className="flex items-center gap-2 bg-gold hover:bg-goldHover text-darker font-bold px-5 py-2 rounded-xl text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
                              >
                                {uploading ? (
                                  <><Loader2 size={14} className="animate-spin" /> Subiendo...</>
                                ) : (
                                  "Crear Lección"
                                )}
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <button 
                              onClick={() => {
                                setAddingToModule(mod.id);
                                setLessonForm({ title: "", description: "", allowed_plans: ["free", "individual", "vip"], file: null });
                              }}
                              className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-white/10 rounded-xl text-white/40 hover:text-gold hover:border-gold/40 hover:bg-gold/[0.03] transition-all text-sm font-semibold mt-2 cursor-pointer active:scale-[0.99]"
                            >
                              <Plus size={16} /> Añadir Lección
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