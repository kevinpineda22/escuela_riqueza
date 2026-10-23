/**
 * `setInterval` que no consulta con la pestaña oculta y, al volver a ella,
 * consulta en el acto en vez de esperar al próximo tick.
 *
 * En una clase en vivo cada alumno sondea el estado de la sala: con cientos de
 * pestañas abiertas en segundo plano eso eran consultas que nadie iba a mirar.
 * Devuelve la función que lo detiene.
 */
export function startPagePolling(tick: () => void, intervalMs: number): () => void {
  const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

  const id = setInterval(() => {
    if (!isHidden()) tick();
  }, intervalMs);

  const onVisibilityChange = () => {
    if (!isHidden()) tick();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
