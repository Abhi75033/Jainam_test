import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '@/utils/ApiError';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    data: null,
    meta: null,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_root';
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    return res.status(422).json({
      success: false,
      data: null,
      meta: null,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fieldErrors },
    });
  }

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.originalUrl }, err.message);
    }
    return res.status(err.status).json({
      success: false,
      data: null,
      meta: null,
      error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
    });
  }

  logger.error({ err, path: req.originalUrl, requestId: req.id }, 'Unhandled error');

  return res.status(500).json({
    success: false,
    data: null,
    meta: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error)?.message,
      requestId: req.id,
    },
  });
}
