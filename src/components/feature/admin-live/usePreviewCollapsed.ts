import { useState } from "react";

const STORAGE_KEY = "admin-live-preview-collapsed";

// localStorage puede faltar o lanzar (modo privado, datos de sitio bloqueados):
// la preferencia es una comodidad, el panel funciona igual sin ella.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* sin almacenamiento: la preferencia no se recuerda */
  }
}

/** Si el panel de vista previa está plegado; se recuerda por navegador. */
export function usePreviewCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  return [collapsed, toggle] as const;
}
