import type { ReactNode } from "react";

export interface LiveRoomBackLink {
  path: string;
  label: string;
}

/** Textos que cambian entre la sala VIP y la pública. */
export interface LiveRoomBranding {
  /** Se agrega al título en el header (ej. "VIP"). */
  titleSuffix?: ReactNode;
  /** Línea bajo el título en el header. */
  subtitle?: string;
  /** Etiqueta sobre el título mientras se espera el inicio. */
  waitingLabel?: string;
  /** Título de la espera cuando la sala no tiene uno. */
  waitingTitleFallback?: ReactNode;
}
