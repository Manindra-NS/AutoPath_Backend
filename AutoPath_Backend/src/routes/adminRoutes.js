import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';
import { validateLogin, validateRegister } from '../validators/adminValidator.js';
import { validateCreateRoute, validatePointsPayload } from '../validators/routeValidator.js';
import { validateStopPayload } from '../validators/stopValidator.js';

const router = Router();

// --- Public Authentication Routes ---
router.post('/auth/login', validateLogin, adminController.login);
router.post('/auth/register', validateRegister, adminController.register);

// --- Protected Administrative Routes (Require JWT) ---
router.use(requireAdminAuth);

// Current admin identity
router.get('/auth/me', adminController.getMe);

// Route Management
router.post('/routes', validateCreateRoute, adminController.createRoute);
router.put('/routes/:id', adminController.updateRoute);
router.delete('/routes/:id', adminController.deleteRoute);
router.patch('/routes/:id/activate', adminController.activateRoute);

// Intermediate Coordinates Management
router.post('/routes/:id/points', validatePointsPayload, adminController.addPoints);
router.put('/routes/:id/points', validatePointsPayload, adminController.updatePoints);
router.delete('/routes/:id/points/:pointId', adminController.deletePoint);

// Stop Management
router.post('/stops', validateStopPayload, adminController.createStop);
router.put('/stops/:id', adminController.updateStop);
router.delete('/stops/:id', adminController.deleteStop);

export default router;

