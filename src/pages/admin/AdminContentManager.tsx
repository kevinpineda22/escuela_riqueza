import { useState, useEffect, useMemo, useRef } from "react";
import { BookOpen, LayoutGrid, PlayCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import {
  fetchModules, fetchLessons, createModule, createLesson,
  updateModule, deleteModule, updateLesson, deleteLesson,
  updateModuleOrder, updateLessonOrder,
  type Module, type Lesson
} from "@/lib/api/stream/content";
import { ModulesSidebar } from "@/components/feature/admin-content/ModulesSidebar";
import { ModuleDetail } from "@/components/feature/admin-content/ModuleDetail";
import { ModuleFormSheet } from "@/components/feature/admin-content/ModuleFormSheet";
import { LessonFormSheet, type LessonSubmitValues } from "@/components/feature/admin-content/LessonFormSheet";
import type { Plan } from "@/components/feature/admin-content/PlansSelector";

type ModuleSheetState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; module: Module };

type LessonSheetState =
  | { open: false }
  | { open: true; mode: "create"; moduleId: string }
  | { open: true; mode: "edit"; moduleId: string; lesson: Lesson };

const AdminContentManager = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonsMap, setLessonsMap] = useState<Record<string, Lesson[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [lessonOrderStatus, setLessonOrderStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [moduleSheet, setModuleSheet] = useState<ModuleSheetState>({ open: false });
  const [lessonSheet, setLessonSheet] = useState<LessonSheetState>({ open: false });

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOrder = useRef<{ moduleId: string; ids: string[] } | null>(null);

  useEffect(() => {
    loadData();
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  // Al cambiar de módulo, limpiar el indicador de orden.
  useEffect(() => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setLessonOrderStatus("idle");
  }, [selectedId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const mods = await fetchModules();
      const newMap: Record<string, Lesson[]> = {};
      await Promise.all(mods.map(async (m) => {
        newMap[m.id] = await fetchLessons(m.id);
      }));
      setModules(mods);
      setLessonsMap(newMap);
      setSelectedId((prev) => prev && mods.some((m) => m.id === prev) ? prev : mods[0]?.id ?? null);
    } catch (err) {
      toast.error("Error al cargar contenido", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedId) ?? null,
    [modules, selectedId]
  );

  const totals = useMemo(() => {
    const lessons = Object.values(lessonsMap);
    const totalLessons = lessons.reduce((sum, ls) => sum + ls.length, 0);
    const withVideo = lessons.reduce((sum, ls) => sum + ls.filter((l) => l.stream_uid).length, 0);
    return { totalLessons, withVideo };
  }, [lessonsMap]);

  const handleCreateModule = async (values: { title: string; description: string; allowed_plans: Plan[] }) => {
    try {
      const newMod = await createModule(values.title, values.description, values.allowed_plans);
      setModules((prev) => [...prev, newMod]);
      setLessonsMap((prev) => ({ ...prev, [newMod.id]: [] }));
      setSelectedId(newMod.id);
      toast.success("Módulo creado", { description: `"${newMod.title}" agregado.` });
    } catch (err) {
      toast.error("Error al crear módulo", { description: (err as Error).message });
      throw err;
    }
  };

  const handleUpdateModule = async (id: string, updates: { title: string; description: string; allowed_plans: Plan[] }) => {
    try {
      const updated = await updateModule(id, updates);
      setModules((prev) => prev.map((m) => (m.id === id ? updated : m)));
      toast.success("Módulo actualizado");
    } catch (err) {
      toast.error("Error actualizando módulo", { description: (err as Error).message });
      throw err;
    }
  };

  const handleTogglePublishModule = async (mod: Module) => {
    try {
      const updated = await updateModule(mod.id, { is_published: !mod.is_published });
      setModules((prev) => prev.map((m) => (m.id === mod.id ? updated : m)));
      toast.success(updated.is_published ? "Módulo publicado" : "Módulo ocultado");
    } catch (err) {
      toast.error("Error actualizando módulo", { description: (err as Error).message });
    }
  };

  const handleDeleteModule = async (mod: Module) => {
    if (!window.confirm(`¿Eliminar "${mod.title}" y todas sus lecciones?`)) return;
    try {
      await deleteModule(mod.id);
      setModules((prev) => prev.filter((m) => m.id !== mod.id));
      setLessonsMap((prev) => {
        const next = { ...prev };
        delete next[mod.id];
        return next;
      });
      setSelectedId((prev) => {
        if (prev !== mod.id) return prev;
        const remaining = modules.filter((m) => m.id !== mod.id);
        return remaining[0]?.id ?? null;
      });
      toast.success("Módulo eliminado");
    } catch (err) {
      toast.error("Error eliminando módulo", { description: (err as Error).message });
    }
  };

  const handleMoveModule = async (index: number, direction: "up" | "down") => {
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= modules.length) return;
    setReordering(true);
    const next = [...modules];
    [next[index], next[swap]] = [next[swap], next[index]];
    setModules(next);
    try {
      await updateModuleOrder(next.map((m) => m.id));
    } catch (err) {
      toast.error("Error al reordenar", { description: (err as Error).message });
      await loadData();
    } finally {
      setReordering(false);
    }
  };

  // Reordenamiento optimista: la UI muestra el orden nuevo mientras se arrastra
  // y recién al soltar se persiste lo que quedó guardado en `pendingOrder`.
  const handleReorderLessons = (moduleId: string, ordered: Lesson[]) => {
    pendingOrder.current = { moduleId, ids: ordered.map((l) => l.id) };
    setLessonsMap((prev) => ({
      ...prev,
      [moduleId]: ordered.map((l, i) => ({ ...l, order_index: i })),
    }));
  };

  const handleCommitLessonOrder = async () => {
    const pending = pendingOrder.current;
    if (!pending) return;
    pendingOrder.current = null;

    if (savedTimer.current) clearTimeout(savedTimer.current);
    setLessonOrderStatus("saving");
    try {
      await updateLessonOrder(pending.ids);
      setLessonOrderStatus("saved");
      savedTimer.current = setTimeout(() => setLessonOrderStatus("idle"), 2200);
    } catch (err) {
      setLessonOrderStatus("idle");
      toast.error("No se pudo guardar el orden", { description: (err as Error).message });
      await loadData();
    }
  };

  const handleSubmitLesson = async (moduleId: string, values: LessonSubmitValues, editingId?: string) => {
    if (editingId) {
      const updated = await updateLesson(editingId, {
        title: values.title,
        description: values.description,
        allowed_plans: values.allowed_plans,
        stream_uid: values.stream_uid,
      });
      setLessonsMap((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).map((l) => (l.id === editingId ? updated : l)),
      }));
      toast.success("Lección actualizada");
    } else {
      const newLesson = await createLesson({
        module_id: moduleId,
        title: values.title,
        description: values.description,
        allowed_plans: values.allowed_plans,
        stream_uid: values.stream_uid,
        is_published: true,
      });
      setLessonsMap((prev) => ({
        ...prev,
        [moduleId]: [...(prev[moduleId] || []), newLesson],
      }));
      toast.success("Lección creada", {
        description: newLesson.stream_uid ? "Video subido y lección publicada." : "Lección publicada (sin video).",
      });
    }
  };

  const handleTogglePublishLesson = async (lesson: Lesson) => {
    try {
      const updated = await updateLesson(lesson.id, { is_published: !lesson.is_published });
      setLessonsMap((prev) => ({
        ...prev,
        [lesson.module_id]: prev[lesson.module_id].map((l) => (l.id === lesson.id ? updated : l)),
      }));
    } catch (err) {
      toast.error("Error actualizando lección", { description: (err as Error).message });
    }
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!window.confirm(`¿Eliminar "${lesson.title}"?`)) return;
    try {
      await deleteLesson(lesson.id);
      setLessonsMap((prev) => ({
        ...prev,
        [lesson.module_id]: prev[lesson.module_id].filter((l) => l.id !== lesson.id),
      }));
      toast.success("Lección eliminada");
    } catch (err) {
      toast.error("Error eliminando lección", { description: (err as Error).message });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-12">
        <div className="h-20 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <div className="h-96 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
          <div className="h-96 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gold/10 border border-gold/20 text-[10px] font-bold uppercase tracking-wider text-gold mb-2">
            <BookOpen size={11} /> Gestor de Contenido
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Catálogo</h1>
          <p className="text-sm text-textMuted mt-1">
            Administrá los módulos, lecciones y acceso por plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatPill icon={<LayoutGrid size={14} />} label="Módulos" value={modules.length} />
          <StatPill icon={<PlayCircle size={14} />} label="Lecciones" value={totals.totalLessons} />
          <StatPill icon={<CheckCircle2 size={14} />} label="Con video" value={totals.withVideo} accent />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch lg:min-h-[640px]">
        <ModulesSidebar
          modules={modules}
          lessonsMap={lessonsMap}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={() => setModuleSheet({ open: true, mode: "create" })}
          onMove={handleMoveModule}
          reordering={reordering}
        />

        {selectedModule ? (
          <ModuleDetail
            module={selectedModule}
            lessons={lessonsMap[selectedModule.id] || []}
            onEditModule={() => setModuleSheet({ open: true, mode: "edit", module: selectedModule })}
            onTogglePublishModule={() => handleTogglePublishModule(selectedModule)}
            onDeleteModule={() => handleDeleteModule(selectedModule)}
            onCreateLesson={() => setLessonSheet({ open: true, mode: "create", moduleId: selectedModule.id })}
            onEditLesson={(lesson) => setLessonSheet({ open: true, mode: "edit", moduleId: selectedModule.id, lesson })}
            onTogglePublishLesson={handleTogglePublishLesson}
            onDeleteLesson={handleDeleteLesson}
            onReorderLessons={(ordered) => handleReorderLessons(selectedModule.id, ordered)}
            onCommitLessonOrder={handleCommitLessonOrder}
            orderStatus={lessonOrderStatus}
          />
        ) : (
          <EmptyDetail onCreate={() => setModuleSheet({ open: true, mode: "create" })} />
        )}
      </div>

      <ModuleFormSheet
        open={moduleSheet.open}
        onOpenChange={(open) => { if (!open) setModuleSheet({ open: false }); }}
        mode={moduleSheet.open ? moduleSheet.mode : "create"}
        initial={moduleSheet.open && moduleSheet.mode === "edit" ? moduleSheet.module : null}
        onSubmit={async (values) => {
          if (moduleSheet.open && moduleSheet.mode === "edit") {
            await handleUpdateModule(moduleSheet.module.id, values);
          } else {
            await handleCreateModule(values);
          }
        }}
      />

      <LessonFormSheet
        open={lessonSheet.open}
        onOpenChange={(open) => { if (!open) setLessonSheet({ open: false }); }}
        mode={lessonSheet.open ? lessonSheet.mode : "create"}
        initial={lessonSheet.open && lessonSheet.mode === "edit" ? lessonSheet.lesson : null}
        onSubmit={async (values) => {
          if (!lessonSheet.open) return;
          await handleSubmitLesson(
            lessonSheet.moduleId,
            values,
            lessonSheet.mode === "edit" ? lessonSheet.lesson.id : undefined,
          );
        }}
      />
    </div>
  );
};

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}

const StatPill = ({ icon, label, value, accent = false }: StatPillProps) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${accent ? "bg-gold/5 border-gold/20" : "bg-white/[0.02] border-white/5"}`}>
    <span className={accent ? "text-gold" : "text-white/40"}>{icon}</span>
    <div className="text-xs leading-tight">
      <div className="text-textMuted">{label}</div>
      <div className="text-white font-bold tabular-nums">{value}</div>
    </div>
  </div>
);

const EmptyDetail = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 bg-darker/40 border border-white/5 rounded-2xl">
    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
      <LayoutGrid size={26} className="text-white/30" />
    </div>
    <h3 className="text-lg font-bold text-white mb-1.5">Seleccioná un módulo</h3>
    <p className="text-sm text-textMuted max-w-sm mb-5">
      Elegí un módulo de la lista o creá uno nuevo para empezar a gestionar el contenido.
    </p>
    <button
      onClick={onCreate}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-goldHover text-black text-sm font-semibold rounded-lg transition-colors"
    >
      Crear nuevo módulo
    </button>
  </div>
);

export default AdminContentManager;
