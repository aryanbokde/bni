export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly fields?: Record<string, string>;

  constructor(
    code: string,
    httpStatus: number,
    fields?: Record<string, string>
  ) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.fields = fields;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
