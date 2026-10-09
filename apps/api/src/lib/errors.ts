export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function notFound(message = "Não encontrado."): AppError {
  return new AppError(404, "NOT_FOUND", message);
}
