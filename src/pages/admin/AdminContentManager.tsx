import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, Plus, Video, Trash2, Edit2, GripVertical, CheckCircle2, ChevronDown, ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { 
  fetchModules, fetchLessons, createModule, createLesson, 
  updateModule, deleteModule, updateLesson, deleteLesson,
  type Module, type Lesson, getDirectUploadUrl 
} from "@/lib/api/stream/content";

const AdminContentManager = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonsMap, setLessonsMap] = useState<Record<string, Lesson[]>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [newModuleAllowedPlans, setNewModuleAllowedPlans] = useState<("free" | "individual" | "vip")[]>(["free", "individual", "vip"]);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const mods = await fetchModules();
      setModules(mods);
      
      const newLessonsMap: Record<string, Lesson[]> = {};
      
      // Optimizamos la carga de lecciones obteniéndolas todas en paralelo
      await Promise.all(mods.map(async (m) => {
        newLessonsMap[m.id] = await fetchLessons(m.id);
      }));

      // Expandir por defecto si es el primer módulo
      if (mods.length > 0) {
        setExpandedModules(prev => ({ ...prev, [mods[0].id]: true }));
      }
      
      setLessonsMap(newLessonsMap);
    } catch (err) {
      console.error("Error loading content:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  // --- CRUD Módulos ---
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
      setIsCreatingModule(false);
    } catch (err) {
      console.error(err);
      alert("Error al crear módulo. Verifica los permisos RLS en Supabase.");
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
    } catch (err) {
      console.error(err);
      alert("Error actualizando módulo");
    }
  };

  const handleToggleModulePublish = async (mod: Module, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await updateModule(mod.id, { is_published: !mod.is_published });
      setModules(modules.map(m => m.id === mod.id ? updated : m));
    } catch (err) {
      console.error(err);
      alert("Error actualizando módulo");
    }
  };

  const handleDeleteModule = async (modId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que quieres eliminar este módulo y todas sus lecciones?")) return;
    try {
      await deleteModule(modId);
      setModules(modules.filter(m => m.id !== modId));
    } catch (err) {
      console.error(err);
      alert("Error eliminando módulo");
    }
  };

  // --- CRUD Lecciones ---
  const handleCreateLesson = async (moduleId: string) => {
    if (!lessonForm.title.trim()) return;
    
    setUploading(true);
    try {
      let stream_uid = null;
      if (lessonForm.file) {
        const { uploadURL, uid } = await getDirectUploadUrl();
        console.log(`Subiendo video a Cloudflare... URL: ${uploadURL}`);
        
        // Ejecutar subida real usando fetch FormData
        const formData = new FormData();
        formData.append("file", lessonForm.file);
        
        const uploadRes = await fetch(uploadURL, {
          method: "POST",
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error("Fallo al subir video a Cloudflare");
        }

        stream_uid = uid;
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
      alert("¡Lección creada y video subido correctamente! ✅");
    } catch (err) {
      console.error(err);
      alert("Error al crear lección. Verifica los permisos RLS en Supabase.");
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
      console.error(err);
      alert("Error actualizando lección");
    }
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || !editingLesson.title.trim()) return;
    setUploading(true);
    try {
      let stream_uid = editingLesson.stream_uid;
      
      // Si se subió un archivo nuevo, mockeamos la subida igual que al crear
      if (editingLesson.newFile) {
        const { uploadURL, uid } = await getDirectUploadUrl();
        console.log(`Subiendo video actualizado a Cloudflare...`);
        
        const formData = new FormData();
        formData.append("file", editingLesson.newFile);
        
        const uploadRes = await fetch(uploadURL, {
          method: "POST",
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error("Fallo al subir el nuevo video a Cloudflare");
        }

        stream_uid = uid;
      }

      const updated = await updateLesson(editingLesson.id, {
        title: editingLesson.title,
        description: editingLesson.description,
        allowed_plans: editingLesson.allowed_plans,
        stream_uid: stream_uid
      });
      setLessonsMap(prev => ({
        ...prev,
        [updated.module_id]: prev[updated.module_id].map(l => l.id === updated.id ? updated : l)
      }));
      setEditingLesson(null);
      alert("¡Lección actualizada con éxito! ✅");
    } catch (err) {
      alert("Error actualizando lección");
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
    } catch (err) {
      console.error(err);
      alert("Error eliminando lección");
    }
  };




  // La función handleMigrateMocks ha sido eliminada porque la migración inicial de mocks ya se completó

  if (loading) {
    return <div className="h-full flex items-center justify-center text-white">Cargando gestor de contenido...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestor de Contenido</h1>
          <p className="text-textMuted mt-1">Organiza los módulos, lecciones y videos de la Escuela.</p>
        </div>
        
        <div className="w-full md:w-auto relative flex gap-2">
          {isCreatingModule ? (
            <div className="bg-darker border border-gold/30 p-4 rounded-xl shadow-xl w-full md:w-[350px] flex flex-col gap-3">
              <h3 className="text-gold font-bold text-sm">Crear Módulo</h3>
              <input 
                type="text"
                value={newModuleTitle}
                onChange={e => setNewModuleTitle(e.target.value)}
                placeholder="Título del módulo..."
                className="bg-black/50 text-white px-3 py-2 rounded-lg outline-none text-sm w-full border border-white/10 focus:border-gold"
                autoFocus
              />
              <textarea
                value={newModuleDescription}
                onChange={e => setNewModuleDescription(e.target.value)}
                placeholder="Descripción (opcional)..."
                className="bg-black/50 text-white px-3 py-2 rounded-lg outline-none text-sm w-full border border-white/10 focus:border-gold resize-none h-20"
              />
              <div className="flex gap-2 items-center bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <span className="text-white/60 text-xs mr-1">Planes:</span>
                {["free", "individual", "vip"].map((plan) => (
                  <label key={plan} className="flex items-center gap-1 cursor-pointer">
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
                      className="accent-gold bg-black/50 border-white/20 rounded w-3 h-3"
                    />
                    <span className="capitalize text-xs">{plan}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setIsCreatingModule(false)}
                  className="px-3 py-1.5 text-xs text-white/50 hover:text-white"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateModule}
                  disabled={!newModuleTitle.trim()}
                  className="bg-gold hover:bg-goldHover text-darker px-4 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsCreatingModule(true)}
              className="w-full md:w-auto flex items-center gap-2 bg-gold hover:bg-goldHover text-darker px-4 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(204,164,59,0.2)]"
            >
              <Plus size={18} /> Nuevo Módulo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {modules.length === 0 && (
          <div className="text-center py-12 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
            <Video size={40} className="mx-auto text-white/20 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No hay contenido aún</h3>
            <p className="text-textMuted max-w-md mx-auto">Comienza creando un módulo arriba. Una vez creado, podrás añadirle lecciones de video.</p>
          </div>
        )}

        <AnimatePresence>
          {modules.map((mod) => (
            <motion.div 
              key={mod.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-darker border rounded-2xl overflow-hidden ${!mod.is_published ? 'border-dashed border-white/20 opacity-70' : 'border-white/10'}`}
            >
              {/* Module Header */}
              {editingModule?.id === mod.id ? (
                <div className="p-4 bg-white/[0.05] border-b border-white/10">
                  <form onSubmit={handleUpdateModule} className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editingModule.title} 
                        onChange={e => setEditingModule({...editingModule, title: e.target.value})}
                        className="flex-1 bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-gold"
                        autoFocus
                      />
                      <button type="submit" className="bg-gold text-darker px-4 py-1.5 rounded-md text-sm font-bold shrink-0">Guardar</button>
                      <button type="button" onClick={() => setEditingModule(null)} className="bg-white/10 text-white px-3 py-1.5 rounded-md text-sm shrink-0"><X size={16}/></button>
                    </div>
                    <textarea 
                      value={editingModule?.description || ""} 
                      onChange={e => {
                        if (editingModule) {
                          setEditingModule({...editingModule, description: e.target.value});
                        }
                      }}
                      placeholder="Descripción del módulo"
                      className="w-full bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-gold resize-none h-16"
                    />
                    <div className="flex gap-2 items-center bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm">
                      <span className="text-white/60 text-xs">Planes:</span>
                      {["free", "individual", "vip"].map((plan) => (
                        <label key={plan} className="flex items-center gap-1 text-white/80 cursor-pointer">
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
                            className="accent-gold bg-black/50 border-white/20 rounded"
                          />
                          <span className="capitalize text-xs">{plan}</span>
                        </label>
                      ))}
                    </div>
                  </form>
                </div>
              ) : (
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleModule(mod.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-grab text-white/20 hover:text-white/50 p-1">
                      <GripVertical size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {mod.title}
                      {!mod.is_published && <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-normal">Oculto</span>}
                    </h3>
                    <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-1 rounded-md border border-gold/20">
                      {lessonsMap[mod.id]?.length || 0} lecciones
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 mr-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingModule(mod); }}
                        className="p-1.5 text-white/40 hover:text-white bg-transparent rounded-md hover:bg-white/10 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleToggleModulePublish(mod, e)}
                        title={mod.is_published ? "Ocultar módulo" : "Publicar módulo"}
                        className={`p-1.5 rounded-md transition-colors ${mod.is_published ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-yellow-500/70 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                      >
                        {mod.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button 
                        onClick={(e) => handleDeleteModule(mod.id, e)}
                        className="p-1.5 text-white/40 hover:text-red-400 bg-transparent rounded-md hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="text-white/50">
                      {expandedModules[mod.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Module Content (Lessons) */}
              <AnimatePresence>
                {expandedModules[mod.id] && (
                  <motion.div 
                    initial={{ height: 0 }} 
                    animate={{ height: "auto" }} 
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/5 bg-black/20"
                  >
                    <div className="p-4 space-y-2">
                      {lessonsMap[mod.id]?.length === 0 && (
                        <p className="text-textMuted text-sm text-center py-4">No hay lecciones en este módulo.</p>
                      )}

                      {lessonsMap[mod.id]?.map((lesson) => (
                        editingLesson?.id === lesson.id ? (
                            <form key={lesson.id} onSubmit={handleUpdateLesson} className="p-3 bg-white/[0.05] border border-white/10 rounded-xl space-y-3">
                              <input 
                                type="text" 
                                value={editingLesson.title} 
                                onChange={e => setEditingLesson({...editingLesson, title: e.target.value})}
                                className="w-full bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-gold"
                              />
                              <textarea 
                                value={editingLesson.description || ""} 
                                onChange={e => setEditingLesson({...editingLesson, description: e.target.value})}
                                placeholder="Descripción"
                                className="w-full bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-gold resize-none h-16"
                              />
                              
                              {/* Zona Drag & Drop para actualizar video */}
                              <div 
                                className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                                  dragActive ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-white/30 bg-black/30'
                                }`}
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
                                onClick={() => document.getElementById(`edit-video-upload-${lesson.id}`)?.click()}
                              >
                                <input 
                                  id={`edit-video-upload-${lesson.id}`}
                                  type="file" 
                                  accept="video/*" 
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) setEditingLesson({...editingLesson, newFile: file});
                                  }}
                                />
                                <UploadCloud size={24} className={editingLesson.newFile ? "text-gold mb-2" : "text-white/30 mb-2"} />
                                <span className="text-xs text-center text-white/50">
                                  {editingLesson.newFile ? (
                                    <span className="text-gold font-semibold">{editingLesson.newFile.name} (Listo para subir)</span>
                                  ) : (
                                    <span>Haz clic o arrastra un <b>nuevo video</b> aquí para reemplazar el actual.</span>
                                  )}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <div className="flex-1 flex gap-2 items-center bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-sm">
                                  {["free", "individual", "vip"].map((plan) => (
                                    <label key={plan} className="flex items-center gap-1 text-white/80 cursor-pointer">
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
                                        className="accent-gold bg-black/50 border-white/20 rounded"
                                      />
                                      <span className="capitalize text-xs">{plan}</span>
                                    </label>
                                  ))}
                                </div>
                                <button type="submit" disabled={uploading} className="bg-gold hover:bg-goldHover text-darker px-4 py-1.5 rounded-md text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                                  {uploading ? "Subiendo..." : "Guardar"}
                                </button>
                                <button type="button" onClick={() => setEditingLesson(null)} className="bg-white/10 text-white px-3 py-1.5 rounded-md text-sm"><X size={16}/></button>
                              </div>
                            </form>
                        ) : (
                          <div key={lesson.id} className={`flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.05] transition-colors group ${!lesson.is_published ? 'bg-transparent border border-dashed border-white/10 opacity-70' : 'bg-white/[0.03] border border-white/5'}`}>
                            <div className="flex items-center gap-3">
                              <Video size={16} className={lesson.is_published ? "text-gold/60" : "text-white/30"} />
                              <div>
                                <p className="text-sm font-semibold text-white/90 group-hover:text-gold transition-colors flex items-center gap-2">
                                  {lesson.title}
                                  {!lesson.is_published && <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded font-normal">Oculta</span>}
                                </p>
                                <div className="flex gap-1 items-center mt-1">
                                  {lesson.allowed_plans?.map(plan => (
                                    <span key={plan} className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      plan === 'free' ? 'bg-green-500/10 text-green-400' : 
                                      plan === 'individual' ? 'bg-blue-500/10 text-blue-400' : 
                                      'bg-purple-500/10 text-purple-400'
                                    }`}>
                                      {plan}
                                    </span>
                                  ))}
                                  {lesson.stream_uid && <span className="text-[10px] text-white/30 flex items-center gap-1 ml-1"><CheckCircle2 size={10}/> Video Subido</span>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleToggleLessonPublish(lesson)}
                                title={lesson.is_published ? "Ocultar lección" : "Publicar lección"}
                                className={`p-1.5 rounded-md transition-colors ${lesson.is_published ? 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10' : 'text-yellow-500/70 hover:text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10'}`}
                              >
                                {lesson.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button 
                                onClick={() => setEditingLesson(lesson)}
                                className="p-1.5 text-white/40 hover:text-white bg-white/5 rounded-md hover:bg-white/10"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteLesson(lesson)}
                                className="p-1.5 text-white/40 hover:text-red-400 bg-white/5 rounded-md hover:bg-red-500/10"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      ))}

                      {/* Formulario Añadir Lección */}
                      {addingToModule === mod.id ? (
                        <div className="mt-4 p-4 border border-gold/30 bg-gold/5 rounded-xl space-y-4">
                          <h4 className="text-sm font-bold text-gold flex items-center gap-2"><Plus size={16}/> Nueva Lección</h4>
                          
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2 space-y-1">
                                <input 
                                  type="text" placeholder="Título de la lección" 
                                  value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <textarea 
                                  placeholder="Descripción de la lección (Opcional)" 
                                  value={lessonForm.description} onChange={e => setLessonForm({...lessonForm, description: e.target.value})}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none resize-none h-20"
                                />
                              </div>
                              <div className="md:col-span-2 flex items-center gap-4 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                                <span className="text-white/60">Planes permitidos:</span>
                                {["free", "individual", "vip"].map((plan) => (
                                  <label key={plan} className="flex items-center gap-1.5 cursor-pointer">
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
                                      className="accent-gold bg-black/50 border-white/20 rounded"
                                    />
                                    <span className="capitalize">{plan}</span>
                                  </label>
                                ))}
                              </div>
                              
                              <div className="md:col-span-2">
                                <div 
                                  className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                                    dragActive ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-white/30 bg-black/30'
                                  }`}
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
                                  onClick={() => document.getElementById('new-video-upload')?.click()}
                                >
                                  <input 
                                    id="new-video-upload"
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden"
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
                                      <p className="text-white/70 font-medium text-sm mb-1">Haz clic o arrastra un video aquí</p>
                                      <p className="text-white/40 text-xs">MP4, WebM (Max. recomendado 5GB)</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setAddingToModule(null)}
                              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleCreateLesson(mod.id)}
                              disabled={uploading || !lessonForm.title.trim()}
                              className="flex items-center gap-2 bg-gold hover:bg-goldHover text-darker font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              {uploading ? "Guardando y Subiendo..." : "Guardar Lección"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setAddingToModule(mod.id);
                            setLessonForm({ title: "", description: "", allowed_plans: ["free", "individual", "vip"], file: null });
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-xl text-white/40 hover:text-gold hover:border-gold/50 hover:bg-gold/5 transition-all text-sm font-semibold mt-2 cursor-pointer"
                        >
                          <Plus size={16} /> Añadir Lección
                        </button>
                      )}
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
