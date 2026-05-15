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
