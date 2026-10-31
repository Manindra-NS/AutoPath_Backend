import { ApiError } from '../middleware/errorMiddleware.js';
import { validateCoordinate } from './routeValidator.js';

/**
 * Validates Stop / Stand creation or update payload.
 */
export function validateStopPayload(req, res, next) {
  try {
    const {
      name,
      stop_name,
      stopName,
      latitude,
      lat,
      longitude,
      lng,
      lon,
      coordinates
    } = req.body;

    const finalName = stop_name || stopName || name;
    if (!finalName || typeof finalName !== 'string' || !finalName.trim()) {
      throw new ApiError('Stop name is required.', 400);
    }

    let rawLat = latitude ?? lat;
    let rawLng = longitude ?? lng ?? lon;

    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      rawLat = coordinates[0];
      rawLng = coordinates[1];
    }

    if (rawLat === undefined || rawLng === undefined) {
      throw new ApiError('Latitude and Longitude are required for every stop.', 400);
    }

    const { latitude: validLat, longitude: validLng } = validateCoordinate(rawLat, rawLng, `Stop "${finalName}"`);

    req.validatedStop = {
      id: req.body.id || null,
      stopName: finalName.trim(),
      latitude: validLat,
      longitude: validLng,
      bengaliName: req.body.bengali_name || req.body.bengaliName || null,
      hindiName: req.body.hindi_name || req.body.hindiName || null,
      fullName: req.body.full_name || req.body.fullName || null,
      fullBengaliName: req.body.full_bengali_name || req.body.fullBengaliName || null,
      coordsDescription: req.body.coords_description || req.body.coordsDescription || null,
      serviceSpan: req.body.service_span || req.body.serviceSpan || null,
      standFormat: req.body.stand_format || req.body.standFormat || null,
      queueSystem: req.body.queue_system || req.body.queueSystem || null,
      tier: req.body.tier || null,
      activeLinesCount: req.body.active_lines_count || req.body.activeLinesCount || 0,
      hasLiveDispatch: Boolean(req.body.has_live_dispatch ?? req.body.hasLiveDispatch),
      tagline: req.body.tagline || null,
      taglineBengali: req.body.tagline_bengali || req.body.taglineBengali || null,
      landmarks: req.body.landmarks || [],
      isStand: req.body.is_stand !== undefined ? Boolean(req.body.is_stand) : true,
      isActive: req.body.is_active !== undefined ? Boolean(req.body.is_active) : true
    };

    next();
  } catch (err) {
    next(err);
  }
}

