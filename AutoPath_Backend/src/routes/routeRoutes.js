import { Router } from 'express';
import * as routeController from '../controllers/routeController.js';

const router = Router();

router.get('/', routeController.getRoutes);
router.get('/search', routeController.searchRoutes);
router.get('/:id', routeController.getRouteById);
router.get('/:id/geometry', routeController.getRouteGeometry);
router.get('/:id/stops', routeController.getRouteStops);

export default router;

