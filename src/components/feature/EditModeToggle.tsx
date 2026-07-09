import { createPortal } from "react-dom";
import { Pencil, PencilOff, Save, Loader2, X, MousePointerClick, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useAdminStore, useIsCurrentUserAdmin } from "@/stores/admin.store";
import { toast } from "@/components/ui/toaster";

const EditModeToggle = () => {
  const isEditMode = useAdminStore((s) => s.isEditMode);
  const setEditMode = useAdminStore((s) => s.setEditMode);
  const saveAll = useAdminStore((s) => s.saveAll);
  const discardAll = useAdminStore((s) => s.discardAll);
  const saving = useAdminStore((s) => s.saving);
  const pendingCount = useAdminStore((s) => Object.keys(s.pending).length);
  const isAdmin = useIsCurrentUserAdmin();

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

  const handleDiscardAll = () => {
    const confirmed = window.confirm(
      `¿Descartar ${pendingCount} cambio(s) sin guardar? Los textos vuelven a como estaban.`,
    );
    if (confirmed) discardAll();
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

  // Portaleamos a document.body: PageTransition aplica filter: blur() que crea un
  // stacking context; sin el portal, el z-index del banner queda atrapado debajo
  // del LandingHeader (que sí está portaleado) y este intercepta los clicks.
  return createPortal(
    <>
      {/* Banner de modo edición: la señal clara de "estás editando". Fijo arriba,
          con la instrucción de qué hacer y los controles (guardar / salir). Antes
          el único indicio era un lápiz gris sutil abajo → parecía un botón más. */}
      {isEditMode && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[210] w-[calc(100%-1.5rem)] max-w-xl"
        >
          <div className="flex items-center gap-3 bg-darker/95 backdrop-blur-lg border border-gold/40 rounded-2xl px-3 sm:px-4 py-2.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7),0_0_30px_-12px_rgba(204,164,59,0.5)]">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gold/15 text-gold shrink-0">
              <MousePointerClick size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                Modo edición
                {hasPending && (
                  <span className="text-amber-400 font-semibold">
                    {" · "}
                    {pendingCount} sin guardar
                  </span>
                )}
              </p>
              <p className="text-[11px] text-textMuted leading-tight truncate">
                Tocá cualquier texto con lápiz para editarlo. Nada se guarda hasta que confirmes.
              </p>
            </div>
            {hasPending && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gold hover:bg-goldHover text-darker text-xs font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span className="hidden sm:inline">{saving ? "Guardando..." : "Guardar"}</span>
                </button>
                <button
                  onClick={handleDiscardAll}
                  disabled={saving}
                  title="Descartar todos los cambios"
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold rounded-xl transition-all border border-white/10 disabled:opacity-60 shrink-0"
                >
                  <Undo2 size={14} />
                  <span className="hidden md:inline">Descartar</span>
                </button>
              </>
            )}
            <button
              onClick={handleToggle}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold rounded-xl transition-all border border-white/10 shrink-0"
            >
              <X size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* FAB: punto de entrada al modo edición (o salida rápida). A la IZQUIERDA
          para no chocar con "volver arriba" (ScrollToTop, abajo a la derecha). */}
      <div className="fixed left-6 bottom-6 z-[200] flex flex-col items-start gap-2">
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
    </>,
    document.body,
  );
};

export default EditModeToggle;
