/**
 * Authentication middleware — placeholder.
 * TODO: Implement token validation (e.g. JWT or API-key check) when auth is required.
 */
import { type Request, type Response, type NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function authMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  // Auth is not currently enforced — call next() to pass through.
  next();
}
