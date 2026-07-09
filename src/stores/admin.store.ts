import { create } from "zustand";
import { useAuthStore } from "@/stores/auth.store";
import { USER_ROLES } from "@/types/user";
import {
  getLandingTexts,
  updateLandingText,
  invalidateLandingTextsCache,
} from "@/lib/api/admin/landing";

interface AdminStore {
  isEditMode: boolean;
  /** Valores confirmados (los que están en la base de datos). */
  values: Record<string, string>;
  /** Ediciones en buffer que AÚN NO se guardaron. */
  pending: Record<string, string>;
  loaded: boolean;
  loading: boolean;
  saving: boolean;

  setEditMode: (value: boolean) => void;
  /** Carga los textos una sola vez (compartido por todos los campos). */
  ensureLoaded: () => void;
  /**
   * Registra una edición en el buffer, sin tocar la base. `baseline` es el valor
   * confirmado (DB o default): si la edición coincide, se elimina del buffer —
   * volver al original NO es un cambio pendiente.
   */
  stageChange: (key: string, value: string, baseline?: string) => void;
  /** Descarta la edición en buffer de un campo. */
  discardChange: (key: string) => void;
  /** Descarta todas las ediciones en buffer. */
  discardAll: () => void;
  /** Persiste TODO el buffer. Sólo aquí se escribe en la base. */
  saveAll: () => Promise<{ ok: number; failed: string[] }>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  isEditMode: false,
  values: {},
  pending: {},
  loaded: false,
  loading: false,
  saving: false,

  setEditMode: (value) =>
    set((s) => ({
      isEditMode: value,
      // Al salir del modo edición, se descartan las ediciones no guardadas.
      pending: value ? s.pending : {},
    })),

  ensureLoaded: () => {
    const s = get();
    if (s.loaded || s.loading) return;
    set({ loading: true });
    getLandingTexts()
      .then((map) => set({ values: map, loaded: true, loading: false }))
      .catch(() => set({ loading: false }));
  },

  stageChange: (key, value, baseline) =>
    set((s) => {
      const next = { ...s.pending };
      // Volvió al valor confirmado → deja de ser un cambio pendiente.
      if (baseline !== undefined && value === baseline) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { pending: next };
    }),

  discardChange: (key) =>
    set((s) => {
      if (!(key in s.pending)) return s;
      const next = { ...s.pending };
      delete next[key];
      return { pending: next };
    }),

  discardAll: () => set({ pending: {} }),

  saveAll: async () => {
    const entries = Object.entries(get().pending);
    if (entries.length === 0) return { ok: 0, failed: [] };

    set({ saving: true });
    const failed: string[] = [];
    const saved: Record<string, string> = {};

    // Secuencial: son pocos campos y así no saturamos la conexión.
    for (const [key, value] of entries) {
      try {
        const ok = await updateLandingText(key, value);
        if (ok) saved[key] = value;
        else failed.push(key);
      } catch {
        failed.push(key);
      }
    }

    set((s) => {
      // Confirmamos en `values` lo que se guardó; en `pending` sólo quedan los fallidos.
      const nextPending = { ...s.pending };
      for (const key of Object.keys(saved)) delete nextPending[key];
      return {
        values: { ...s.values, ...saved },
        pending: nextPending,
        saving: false,
      };
    });

    invalidateLandingTextsCache();
    return { ok: Object.keys(saved).length, failed };
  },
}));

/**
 * Lectura NO reactiva (snapshot). Sólo para código fuera de React (efectos,
 * handlers). En componentes usá `useIsCurrentUserAdmin` — sino no re-renderiza
 * cuando la sesión hidrata de forma asíncrona y el rol cambia de null a admin.
 */
export const isCurrentUserAdmin = (): boolean => {
  const user = useAuthStore.getState().user;
  return user?.role === USER_ROLES.ADMIN;
};

/**
 * Hook reactivo: se re-renderiza cuando cambia el usuario (login, hidratación
 * de sesión, logout). Éste es el que deben usar los componentes.
 */
export const useIsCurrentUserAdmin = (): boolean =>
  useAuthStore((s) => s.user?.role === USER_ROLES.ADMIN);
