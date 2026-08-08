import { Router } from 'express';
import sessionRouter from './session.routes';

const router = Router();

router.use('/session', sessionRouter);

export default router;
