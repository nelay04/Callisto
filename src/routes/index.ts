import { type Express } from 'express';
import v1Router from './v1';

export function registerRoutes(app: Express): void {
  app.use('/api/v1', v1Router);
}
