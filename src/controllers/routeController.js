import * as routeService from '../services/routeService.js';

/**
 * Controller: GET /api/routes
 */
export async function getRoutes(req, res, next) {
  try {
    const routes = await routeService.getAllRoutes();
    res.json({
      success: true,
      count: routes.length,
      data: routes
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/routes/search
 */
export async function searchRoutes(req, res, next) {
  try {
    const { from = '', to = '', ...options } = req.query;
    const routes = await routeService.searchRoutes(from, to, options);
    res.json({
      success: true,
      count: routes.length,
      data: routes,
      query: { from, to, options }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/routes/:id
 */
export async function getRouteById(req, res, next) {
  try {
    const route = await routeService.getRouteById(req.params.id);
    res.json({
      success: true,
      data: route
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/routes/:id/geometry
 * Strictly formatted as specified in prompt Section 8 & 9.
 */
export async function getRouteGeometry(req, res, next) {
  try {
    const geometryData = await routeService.getRouteGeometry(req.params.id);
    res.json({
      success: true,
      data: geometryData
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/routes/:id/stops
 */
export async function getRouteStops(req, res, next) {
  try {
    const stops = await routeService.getRouteStops(req.params.id);
    res.json({
      success: true,
      count: stops.length,
      data: stops
    });
  } catch (err) {
    next(err);
  }
}

