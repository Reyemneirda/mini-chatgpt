import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId } from '../utils/logger';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}
