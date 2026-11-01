import * as adminService from '../services/adminService.js';

/**
 * Controller: POST /api/admin/auth/login
 */
export async function login(req, res, next) {
  try {
    const { identifier, password } = req.validatedAuth;
    const result = await adminService.adminLogin(identifier, password);
    res.json({
      success: true,
      message: 'Login successful.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: POST /api/admin/auth/register
 */
export async function register(req, res, next) {
  try {
    const { username, email, password, role } = req.validatedAdmin;
    const result = await adminService.adminRegister(username, email, password, role);
    res.status(201).json({
      success: true,
      message: 'Administrator registered successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: GET /api/admin/auth/me
 */
export async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        admin: req.admin
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: POST /api/admin/routes
 * Transactionally saves route and intermediate points.
 */
export async function createRoute(req, res, next) {
  try {
    const newRoute = await adminService.createRoute(req.validatedData);
    res.status(201).json({
      success: true,
      message: 'Route and intermediate coordinates created successfully.',
      data: newRoute
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: PUT /api/admin/routes/:id
 */
export async function updateRoute(req, res, next) {
  try {
    const updated = await adminService.updateRoute(req.params.id, req.body);
    res.json({
      success: true,
      message: `Route '${req.params.id}' updated successfully.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: DELETE /api/admin/routes/:id
 */
export async function deleteRoute(req, res, next) {
  try {
    const permanent = req.query.permanent === 'true';
    const result = await adminService.deleteRoute(req.params.id, permanent);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: PATCH /api/admin/routes/:id/activate
 */
export async function activateRoute(req, res, next) {
  try {
    const result = await adminService.activateRoute(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: POST /api/admin/routes/:id/points
 * Add intermediate points.
 */
export async function addPoints(req, res, next) {
  try {
    const result = await adminService.addRoutePoints(req.params.id, req.validatedPoints);
    res.status(201).json({
      success: true,
      message: `${result.length} intermediate point(s) added successfully.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: PUT /api/admin/routes/:id/points
 * Update or reorder all intermediate points transactionally.
 */
export async function updatePoints(req, res, next) {
  try {
    const result = await adminService.updateRoutePoints(req.params.id, req.validatedPoints);
    res.json({
      success: true,
      message: `Route intermediate points replaced and reordered successfully (${result.length} points).`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: DELETE /api/admin/routes/:id/points/:pointId
 */
export async function deletePoint(req, res, next) {
  try {
    const result = await adminService.deleteRoutePoint(req.params.id, req.params.pointId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: POST /api/admin/stops
 */
export async function createStop(req, res, next) {
  try {
    const newStop = await adminService.createStop(req.validatedStop);
    res.status(201).json({
      success: true,
      message: 'Stop created successfully.',
      data: newStop
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: PUT /api/admin/stops/:id
 */
export async function updateStop(req, res, next) {
  try {
    const updated = await adminService.updateStop(req.params.id, req.body);
    res.json({
      success: true,
      message: `Stop '${req.params.id}' updated successfully.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: DELETE /api/admin/stops/:id
 */
export async function deleteStop(req, res, next) {
  try {
    const result = await adminService.deleteStop(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

