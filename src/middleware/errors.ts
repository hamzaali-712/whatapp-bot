import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    requestId: res.locals.requestId,
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  const apiError = error instanceof ApiError ? error : undefined;
  const status = apiError?.status ?? 500;
  const code = apiError?.code ?? 'INTERNAL_ERROR';
  const message = apiError?.message ?? 'Internal server error.';

  logger.error({ err: error, requestId: res.locals.requestId, code, status }, 'request failed');
  res.status(status).json({
    success: false,
    error: { code, message },
    requestId: res.locals.requestId,
  });
}
