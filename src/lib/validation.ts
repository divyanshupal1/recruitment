import type { ZodSchema, z } from 'zod';
import { BadRequestError } from './errors.js';

export async function parseJsonBody<S extends ZodSchema>(
  req: Request,
  schema: S
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new BadRequestError('Invalid request body', details);
  }

  return result.data;
}

export function parseQueryInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
