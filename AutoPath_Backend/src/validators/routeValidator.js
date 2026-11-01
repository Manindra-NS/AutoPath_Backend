import { ApiError } from '../middleware/errorMiddleware.js';

/**
 * Validates a single geographic coordinate.
 * Latitude must be within [-90, 90].
 * Longitude must be within [-180, 180].
 */
export function validateCoordinate(latitude, longitude, label = 'Coordinate') {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(`${label} latitude and longitude must be valid finite numbers. Received lat=${latitude}, lng=${longitude}`, 400);
  }

  if (lat < -90 || lat > 90) {
    throw new ApiError(`${label} latitude must be between -90 and 90 degrees. Received ${lat}`, 400);
  }

  if (lng < -180 || lng > 180) {
    throw new ApiError(`${label} longitude must be between -180 and 180 degrees. Received ${lng}`, 400);
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Validates route creation payload.
 * Supports both snake_case and camelCase field naming for convenience.
 */
export function validateCreateRoute(req, res, next) {
  try {
    const {
      id,
      route_id,
      name,
      route_name,
      source_stop_id,
      sourceStopId,
      destination_stop_id,
      destinationStopId,
      source,
      destination,
      intermediate_points,
      intermediatePoints,
      points,
      stops
    } = req.body;

    const finalName = route_name || name;
    if (!finalName || typeof finalName !== 'string' || !finalName.trim()) {
      throw new ApiError('Route name is required and cannot be empty.', 400);
    }

    const sourceId = source_stop_id || sourceStopId || source?.id;
    if (!sourceId && !source?.coordinates && !source?.latitude) {
      throw new ApiError('Source/starting stop (source_stop_id or source object with coordinates) is required.', 400);
    }

    const destinationId = destination_stop_id || destinationStopId || destination?.id;
    if (!destinationId && !destination?.coordinates && !destination?.latitude) {
      throw new ApiError('Destination stop (destination_stop_id or destination object with coordinates) is required.', 400);
    }

    // Validate raw points if provided
    const rawPoints = intermediate_points || intermediatePoints || points || [];
    if (!Array.isArray(rawPoints)) {
      throw new ApiError('Intermediate points must be an array.', 400);
    }

    const seenSequences = new Set();
    const validatedPoints = rawPoints.map((pt, idx) => {
      let lat, lng, seq;

      if (Array.isArray(pt) && pt.length >= 2) {
        // [lat, lng]
        lat = pt[0];
        lng = pt[1];
        seq = idx + 1;
      } else if (typeof pt === 'object' && pt !== null) {
        lat = pt.latitude ?? pt.lat;
        lng = pt.longitude ?? pt.lng ?? pt.lon;
        seq = pt.sequence_number ?? pt.sequence ?? (idx + 1);
      } else {
        throw new ApiError(`Intermediate point at index ${idx} is malformed.`, 400);
      }

      validateCoordinate(lat, lng, `Intermediate point #${seq}`);

      if (seenSequences.has(seq)) {
        throw new ApiError(`Duplicate sequence number detected: ${seq}. All sequence numbers within a route must be unique.`, 400);
      }
      seenSequences.add(seq);

      return {
        sequence_number: Number(seq),
        latitude: Number(lat),
        longitude: Number(lng)
      };
    });

    // Sort by sequence number
    validatedPoints.sort((a, b) => a.sequence_number - b.sequence_number);

    // Attach sanitized points to req.validatedData
    req.validatedData = {
      id: id || route_id || null,
      routeName: finalName.trim(),
      sourceStopId: sourceId || null,
      destinationStopId: destinationId || null,
      sourceData: source || null,
      destinationData: destination || null,
      points: validatedPoints,
      rawBody: req.body
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates payload for adding or updating intermediate points.
 */
export function validatePointsPayload(req, res, next) {
  try {
    const rawPoints = req.body.points || req.body.intermediate_points || (Array.isArray(req.body) ? req.body : [req.body]);
    if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
      throw new ApiError('At least one coordinate point must be provided in points array.', 400);
    }

    const seenSequences = new Set();
    const validatedPoints = rawPoints.map((pt, idx) => {
      let lat, lng, seq;

      if (Array.isArray(pt) && pt.length >= 2) {
        lat = pt[0];
        lng = pt[1];
        seq = pt[2] || (idx + 1);
      } else if (typeof pt === 'object' && pt !== null) {
        lat = pt.latitude ?? pt.lat;
        lng = pt.longitude ?? pt.lng ?? pt.lon;
        seq = pt.sequence_number ?? pt.sequence ?? (idx + 1);
      } else {
        throw new ApiError(`Point at index ${idx} is malformed.`, 400);
      }

      validateCoordinate(lat, lng, `Point #${seq}`);

      if (seenSequences.has(seq)) {
        throw new ApiError(`Duplicate sequence number detected: ${seq}.`, 400);
      }
      seenSequences.add(seq);

      return {
        id: pt.id || null,
        sequence_number: Number(seq),
        latitude: Number(lat),
        longitude: Number(lng)
      };
    });

    validatedPoints.sort((a, b) => a.sequence_number - b.sequence_number);
    req.validatedPoints = validatedPoints;
    next();
  } catch (err) {
    next(err);
  }
}

