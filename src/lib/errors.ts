export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: string) {
    super(message, 400, details);
  }
}
