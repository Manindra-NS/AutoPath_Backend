import { Router } from 'express';
import * as locationController from '../controllers/locationController.js';

const router = Router();

router.get('/search', locationController.searchLocations);

export default router;

