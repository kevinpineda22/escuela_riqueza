import { Pencil, PencilOff, Save, Loader2 } from "lucide-react";
import { useAdminStore, isCurrentUserAdmin } from "@/stores/admin.store";
import { toast } from "@/components/ui/toaster";

const EditModeToggle = () => {
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const setEditMode = useAdminStore((s) => s.setEditMode);
  const saveAll = useAdminStore((s) => s.saveAll);
  const saving = useAdminStore((s) => s.saving);
  const pendingCount = useAdminStore((s) => Object.keys(s.pending).length);
  const isAdmin = isCurrentUserAdmin();

  if (!isAdmin) return null;

  const hasPending = pendingCount > 0;

  const handleSave = async () => {
    const { ok, failed } = await saveAll();
    if (failed.length === 0) {
      toast.success(`Guardado (${ok} ${ok === 1 ? "texto" : "textos"})`);
    } else {
      toast.error(
        `Se guardaron ${ok}, fallaron ${failed.length}. Revisá tu conexión o permisos e intentá de nuevo.`,
      );
    }
  };

  const handleToggle = () => {
    if (isEditMode && hasPending) {
      const discard = window.confirm(
        `Tenés ${pendingCount} cambio(s) sin guardar. ¿Salir y descartarlos?`,
      );
      if (!discard) return;
    }
    setEditMode(!isEditMode);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-2">
      {/* Tooltip con estado */}
      {isEditMode && (
        <div className="bg-darker/95 backdrop-blur-lg border border-white/10 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
          <span className="text-xs text-textMuted">
            {hasPending ? `Editando (${pendingCount} sin guardar)` : "Editando landing"}
          </span>
          {hasPending && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-goldHover text-darker text-xs font-bold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando..." : "Guardar todo"}
            </button>
          )}
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={handleToggle}
        className={`
          w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300
          ${
            isEditMode
              ? "bg-gold text-darker shadow-[0_0_20px_rgba(204,164,59,0.5)] scale-110"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border border-white/10"
          }
        `}
        title={isEditMode ? "Salir del modo edición" : "Editar landing page"}
      >
        {isEditMode ? <PencilOff size={22} /> : <Pencil size={22} />}
      </button>
    </div>
  );
};

export default EditModeToggle;
