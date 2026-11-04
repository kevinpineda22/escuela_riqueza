/** Solo paths internos: deben empezar con "/" pero no "//" ni "/\" (eso sería otro sitio). */
export const isSafeReturnPath = (path: string): boolean => /^\/[^/\\]/.test(path);
