import { useEffect, useState } from "react";
import { Loader2, LayoutGrid } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from "@/components/ui/sheet";
import { PlansSelector, type Plan } from "./PlansSelector";
import type { Module } from "@/lib/api/stream/content";

interface ModuleFormValues {
  title: string;
  description: string;
  allowed_plans: Plan[];
}

interface ModuleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Module | null;
  onSubmit: (values: ModuleFormValues) => Promise<void>;
}

const DEFAULT_PLANS: Plan[] = ["free", "individual", "vip"];

export const ModuleFormSheet = ({
  open, onOpenChange, mode, initial, onSubmit,
}: ModuleFormSheetProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setPlans((initial.allowed_plans as Plan[]) ?? DEFAULT_PLANS);
    } else {
      setTitle("");
      setDescription("");
      setPlans(DEFAULT_PLANS);
    }
  }, [open, mode, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), allowed_plans: plans });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
              <LayoutGrid size={18} />
            </span>
            <div>
              <SheetTitle className="text-lg">
                {mode === "create" ? "Nuevo módulo" : "Editar módulo"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {mode === "create"
                  ? "Agregá un módulo al catálogo."
                  : "Actualizá los datos del módulo."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Fundamentos del Liderazgo"
              autoFocus
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumen breve del módulo..."
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors resize-none"
            />
          </div>

          <PlansSelector value={plans} onChange={setPlans} />

          <input type="submit" hidden />
        </form>

        <SheetFooter className="px-6 py-4 border-t border-white/5 bg-darker/60">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="px-4 py-2 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-gold hover:bg-goldHover text-black rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === "create" ? "Crear módulo" : "Guardar"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
