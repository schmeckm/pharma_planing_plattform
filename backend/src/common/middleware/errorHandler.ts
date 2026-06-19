import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof SyntaxError && 'status' in err && (err as SyntaxError & { status?: number }).status === 400 && 'body' in err) {
    res.status(400).json({ error: 'INVALID_JSON', message: 'Malformed JSON request body' });
    return;
  }

  if (err instanceof AppError) {
    const payload: Record<string, unknown> = {
      error: err.code,
      message: err.message,
    };
    if (err instanceof ValidationError && err.details.length) {
      payload.details = err.details;
    }
    res.status(err.statusCode).json(payload);
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
