import { Router } from 'express';
import * as stopController from '../controllers/stopController.js';

const router = Router();

router.get('/', stopController.getStops);
router.get('/:id', stopController.getStopById);
router.get('/:id/routes', stopController.getStopRoutes);

export default router;

