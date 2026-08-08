import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
   
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';

  console.error(`[${statusCode}] ${message}`);

  if (config.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(config.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
