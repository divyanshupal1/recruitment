import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from './errors.js';

export function handleControllerError(c: Context, error: unknown, context: string) {
  if (error instanceof AppError) {
    const body: Record<string, string> = { error: error.message };
    if (error.details) {
      body.details = error.details;
    }
    return c.json(body, error.statusCode as ContentfulStatusCode);
  }

  console.error(`[${context}] Error:`, error);
  return c.json(
    { error: context, details: String(error) },
    500
  );
}

export function withErrorHandling<T extends Context>(
  context: string,
  handler: (c: T) => Promise<Response>
) {
  return async (c: T) => {
    try {
      return await handler(c);
    } catch (error) {
      return handleControllerError(c, error, context);
    }
  };
}
