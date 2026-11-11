import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` para las páginas, a prueba del recargo tras un deploy.
 *
 * Si una pestaña quedó abierta durante un deploy, el chunk viejo ya no existe y
 * Vite dispara `vite:preloadError`. `main.tsx` lo cancela (`preventDefault`)
 * para recargar la página, y al cancelarlo Vite NO rechaza el `import()`: lo
 * resuelve con `undefined`. Un `lazy` común leería `undefined.default` y
 * mostraría la pantalla de error justo antes de la recarga (12 casos en
 * client_errors, todos en /live y /login).
 *
 * Con módulo vacío, la página se queda en el fallback de Suspense hasta que la
 * recarga, que ya está en curso, la reemplaza.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo límite que React.lazy
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().then((mod: { default: T } | undefined) => mod ?? new Promise<{ default: T }>(() => {})),
  );
}
