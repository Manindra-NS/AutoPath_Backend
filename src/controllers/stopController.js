import * as stopService from '../services/stopService.js';

/**
 * Controller: GET /api/stops & /api/stands
 */
export async function getStops(req, res, next) {
  try {
    const isStand = req.query.is_stand !== undefined ? req.query.is_stand === 'true' : undefined;
    const stops = await stopService.getAllStops({ isStand });
    res.json({
      success: true,
      count: stops.length,
      data: stops
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/stops/:id & /api/stands/:id
 */
export async function getStopById(req, res, next) {
  try {
    const stop = await stopService.getStopById(req.params.id);
    res.json({
      success: true,
      data: stop
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/stops/:id/routes & /api/stands/:id/routes
 */
export async function getStopRoutes(req, res, next) {
  try {
    const routes = await stopService.getRoutesByStopId(req.params.id);
    res.json({
      success: true,
      count: routes.length,
      data: routes
    });
  } catch (err) {
    next(err);
  }
}

