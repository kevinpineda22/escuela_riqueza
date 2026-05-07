// Helpers compartidos entre los servicios mock.
// Cuando el back esté listo, esta capa se reemplaza por un fetcher real (axios o fetch tipado)
// y los servicios siguen exponiendo la misma firma (Promise<T>) sin que las páginas se enteren.

const DEFAULT_LATENCY_MS = 200;

export const delay = (ms: number = DEFAULT_LATENCY_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
