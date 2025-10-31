import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Error occurred', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
  });

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
  }

  if (err.name === 'AbortError' || err.message?.includes('timeout')) {
    return res.status(504).json({
      error: 'Upstream error/timeout',
      retryAfterMs: 1000,
    });
  }

  if (err.message?.includes('500')) {
    return res.status(502).json({
      error: 'Upstream error/timeout',
      retryAfterMs: 1000,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    correlationId: req.correlationId,
  });
}
