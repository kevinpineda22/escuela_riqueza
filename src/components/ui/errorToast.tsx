import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";
import { describeKind } from "@/lib/errors/classifyError";
import { reportError, takeRecentFailure } from "@/lib/errors/errorReporter";

type ErrorToastOptions = ExternalToast & {
  /** El error capturado: clasifica y registra con su causa exacta. */
  cause?: unknown;
};

/**
 * `toast.error` que dice DE QUIÉN es la falla. Sin `cause`, usa la falla de
 * transporte de los últimos segundos (la registra `trackedFetch`): así los
 * avisos existentes ("No se pudo guardar") ganan la explicación sin tocarlos.
 * Un rechazo por datos no agrega nada: el título ya lo explica.
 */
function errorToast(message: ReactNode, options: ErrorToastOptions = {}) {
  const { cause, ...rest } = options;
  const failure = cause !== undefined ? reportError(cause, { source: "toast" }) : takeRecentFailure();
  const hint = failure && failure.kind !== "rejected" ? describeKind(failure.kind, failure.code) : null;
  if (!hint) return sonnerToast.error(message, rest);
  const description = rest.description ? (
    <>
      {typeof rest.description === "function" ? rest.description() : rest.description}
      <br />
      {hint}
    </>
  ) : hint;
  // Una falla de plataforma trae un código para reportar: más tiempo para leerlo.
  return sonnerToast.error(message, { ...rest, description, duration: rest.duration ?? (failure?.code ? 9000 : undefined) });
}

const toast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  sonnerToast,
  { error: errorToast },
) as typeof sonnerToast & { error: typeof errorToast };

export { toast };
