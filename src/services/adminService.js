import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../config/database.js';
import { config } from '../config/environment.js';
import { ApiError } from '../middleware/errorMiddleware.js';
import { getRouteById } from './routeService.js';
import { getStopById } from './stopService.js';

/**
 * Generates JWT token for an admin user.
 */
function generateToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Admin Login Authentication
 */
export async function adminLogin(identifier, password) {
  const sql = `
    SELECT * FROM admins
    WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)) AND is_active = TRUE
  `;
  const result = await query(sql, [identifier]);

  if (result.rows.length === 0) {
    throw new ApiError('Invalid username/email or password.', 401);
  }

  const admin = result.rows[0];
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    throw new ApiError('Invalid username/email or password.', 401);
  }

  const token = generateToken(admin);

  return {
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    },
    token
  };
}

/**
 * Admin Registration
 */
export async function adminRegister(username, email, password, role = 'admin') {
  const existingSql = `
    SELECT id FROM admins WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
  `;
  const existing = await query(existingSql, [username, email]);
  if (existing.rows.length > 0) {
    throw new ApiError('An administrator with this username or email already exists.', 409);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const insertSql = `
    INSERT INTO admins (username, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, email, role, created_at
  `;
  const result = await query(insertSql, [username, email, passwordHash, role]);
  const newAdmin = result.rows[0];
  const token = generateToken(newAdmin);

  return {
    admin: newAdmin,
    token
  };
}

/**
 * Finds or creates a stop inside a transaction.
 */
async function findOrCreateStop(client, stopIdOrName, stopData = null) {
  if (stopIdOrName) {
    const existing = await client.query('SELECT * FROM stops WHERE id = $1 OR LOWER(stop_name) = LOWER($1)', [stopIdOrName]);
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  if (!stopData) {
    throw new ApiError(`Stop '${stopIdOrName}' not found in registry and no coordinate data was provided to create it.`, 400);
  }

  const id = stopData.id || stopIdOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const name = stopData.name || stopData.stop_name || stopIdOrName;
  const lat = stopData.latitude ?? stopData.lat ?? (Array.isArray(stopData.coordinates) ? stopData.coordinates[0] : null);
  const lng = stopData.longitude ?? stopData.lng ?? (Array.isArray(stopData.coordinates) ? stopData.coordinates[1] : null);

  if (lat === null || lng === null) {
    throw new ApiError(`Coordinates (latitude, longitude) are required to create stop '${name}'.`, 400);
  }

  const insertStopSql = `
    INSERT INTO stops (
      id, stop_name, bengali_name, latitude, longitude, coords_description, is_stand
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      stop_name = EXCLUDED.stop_name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude
    RETURNING *
  `;
  const res = await client.query(insertStopSql, [
    id,
    name,
    stopData.bengali_name || stopData.bengaliName || name,
    lat,
    lng,
    stopData.subtext || stopData.coords_description || '',
    stopData.is_stand !== undefined ? Boolean(stopData.is_stand) : true
  ]);

  return res.rows[0];
}

/**
 * Creates a new auto route along with its intermediate coordinates transactionally.
 */
export async function createRoute(validatedData) {
  return transaction(async (client) => {
    const {
      id,
      routeName,
      sourceStopId,
      destinationStopId,
      sourceData,
      destinationData,
      points,
      rawBody
    } = validatedData;

    // 1. Resolve or create Source Stop
    const sourceStop = await findOrCreateStop(client, sourceStopId, sourceData);

    // 2. Resolve or create Destination Stop
    const destStop = await findOrCreateStop(client, destinationStopId, destinationData);

    // 3. Generate route ID if not provided
    const routeId = id || (rawBody.route_id || `${sourceStop.id}-${destStop.id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    // Check if route with this ID already exists
    const existingRoute = await client.query('SELECT id FROM routes WHERE id = $1', [routeId]);
    if (existingRoute.rows.length > 0) {
      throw new ApiError(`A route with ID '${routeId}' already exists. Use PUT /api/admin/routes/${routeId} to update it.`, 409);
    }

    // 4. Insert Route row
    const insertRouteSql = `
      INSERT INTO routes (
        id, route_code, route_code_alt, route_name, subtitle,
        bengali_name, bengali_subtitle, hindi_name,
        source_stop_id, destination_stop_id,
        fare_range, fare_fixed, govt_share_fare, fare_type,
        distance, distance_km, est_travel, est_travel_min,
        queue_freq, is_direct, is_recommended, route_type,
        category, status, notes, description, is_active
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27
      )
      RETURNING *
    `;

    await client.query(insertRouteSql, [
      routeId,
      rawBody.code || rawBody.route_code || 'AK-AUTO',
      rawBody.codeAlt || rawBody.route_code_alt || '',
      routeName,
      rawBody.subtitle || '',
      rawBody.bengali_name || rawBody.bengaliName || routeName,
      rawBody.bengali_subtitle || rawBody.bengaliSubtitle || '',
      rawBody.hindi_name || rawBody.hindiName || '',
      sourceStop.id,
      destStop.id,
      rawBody.fare_range || rawBody.fareRange || '₹12 - ₹15',
      rawBody.fare_fixed || rawBody.fareFixed || '₹15 Fixed',
      rawBody.govt_share_fare || rawBody.govtShareFare || '',
      rawBody.fare_type || rawBody.fareType || 'Per Seat Share',
      rawBody.distance || '~4.0 km',
      rawBody.distance_km || rawBody.distanceKm || 4.0,
      rawBody.est_travel || rawBody.estTravel || '15-20m',
      rawBody.est_travel_min || rawBody.estTravelMin || 18,
      rawBody.queue_freq || rawBody.queueFreq || '2-4 min',
      rawBody.is_direct !== undefined ? Boolean(rawBody.is_direct) : true,
      Boolean(rawBody.is_recommended ?? rawBody.isRecommended),
      rawBody.route_type || rawBody.routeType || 'direct',
      rawBody.category || '',
      rawBody.status || 'Active Queue Now',
      rawBody.notes || '',
      rawBody.description || '',
      rawBody.is_active !== undefined ? Boolean(rawBody.is_active) : true
    ]);

    // 5. Insert intermediate points with guaranteed sequence ordering
    if (points && points.length > 0) {
      for (const pt of points) {
        await client.query(`
          INSERT INTO route_points (route_id, sequence_number, latitude, longitude)
          VALUES ($1, $2, $3, $4)
        `, [routeId, pt.sequence_number, pt.latitude, pt.longitude]);
      }
    }

    // 6. Insert passenger stops if provided in stops array
    const rawStops = rawBody.stops || rawBody.intermediate_stops || [];
    if (Array.isArray(rawStops) && rawStops.length > 0) {
      for (let i = 0; i < rawStops.length; i++) {
        const s = rawStops[i];
        const sLat = s.latitude ?? s.lat ?? (Array.isArray(s.coordinates) ? s.coordinates[0] : null);
        const sLng = s.longitude ?? s.lng ?? (Array.isArray(s.coordinates) ? s.coordinates[1] : null);
        if (sLat !== null && sLng !== null) {
          await client.query(`
            INSERT INTO route_stops (
              route_id, stop_id, stop_name, bengali_name, order_index,
              latitude, longitude, distance, dist_km, badge, subtext, is_stand
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            routeId,
            s.id || s.stop_id || null,
            s.name || s.stop_name || 'Auto Stop',
            s.bengaliName || s.bengali_name || s.name || '',
            s.order || (i + 1),
            sLat,
            sLng,
            s.distance || '',
            s.distKm || s.dist_km || 0.0,
            s.badge || null,
            s.subtext || '',
            Boolean(s.isStand ?? s.is_stand)
          ]);
        }
      }
    }

    // Return the created full route
    return getRouteById(routeId);
  });
}

/**
 * Updates an existing route information.
 */
export async function updateRoute(id, updateData) {
  return transaction(async (client) => {
    // Check if route exists
    const checkRes = await client.query('SELECT * FROM routes WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      throw new ApiError(`Route with ID '${id}' not found.`, 404);
    }

    const current = checkRes.rows[0];

    const routeName = updateData.route_name || updateData.name || current.route_name;
    const subtitle = updateData.subtitle !== undefined ? updateData.subtitle : current.subtitle;
    const bengaliName = updateData.bengali_name || updateData.bengaliName || current.bengali_name;
    const sourceStopId = updateData.source_stop_id || updateData.sourceStopId || current.source_stop_id;
    const destStopId = updateData.destination_stop_id || updateData.destinationStopId || current.destination_stop_id;
    const fareRange = updateData.fare_range || updateData.fareRange || current.fare_range;
    const fareFixed = updateData.fare_fixed || updateData.fareFixed || current.fare_fixed;
    const distance = updateData.distance || current.distance;
    const estTravel = updateData.est_travel || updateData.estTravel || current.est_travel;
    const queueFreq = updateData.queue_freq || updateData.queueFreq || current.queue_freq;
    const status = updateData.status || current.status;
    const isActive = updateData.is_active !== undefined ? Boolean(updateData.is_active) : current.is_active;

    const updateSql = `
      UPDATE routes SET
        route_name = $1,
        subtitle = $2,
        bengali_name = $3,
        source_stop_id = $4,
        destination_stop_id = $5,
        fare_range = $6,
        fare_fixed = $7,
        distance = $8,
        est_travel = $9,
        queue_freq = $10,
        status = $11,
        is_active = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `;

    await client.query(updateSql, [
      routeName,
      subtitle,
      bengaliName,
      sourceStopId,
      destStopId,
      fareRange,
      fareFixed,
      distance,
      estTravel,
      queueFreq,
      status,
      isActive,
      id
    ]);

    // If points are supplied in update body, replace them transactionally
    const points = updateData.points || updateData.intermediate_points;
    if (Array.isArray(points)) {
      await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const lat = pt.latitude ?? pt.lat ?? pt[0];
        const lng = pt.longitude ?? pt.lng ?? pt[1];
        const seq = pt.sequence_number ?? pt.sequence ?? (i + 1);
        await client.query(`
          INSERT INTO route_points (route_id, sequence_number, latitude, longitude)
          VALUES ($1, $2, $3, $4)
        `, [id, seq, lat, lng]);
      }
    }

    return getRouteById(id);
  });
}

/**
 * Deactivates or permanently deletes a route.
 */
export async function deleteRoute(id, permanent = false) {
  // Check existence
  await getRouteById(id);

  if (permanent) {
    await query('DELETE FROM routes WHERE id = $1', [id]);
    return { success: true, message: `Route '${id}' permanently deleted from database.` };
  } else {
    await query('UPDATE routes SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    return { success: true, message: `Route '${id}' has been deactivated.` };
  }
}

/**
 * Activates a previously deactivated route.
 */
export async function activateRoute(id) {
  const result = await query('UPDATE routes SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw new ApiError(`Route with ID '${id}' not found.`, 404);
  }
  return { success: true, message: `Route '${id}' has been activated.` };
}

/**
 * Adds intermediate coordinates to an existing route.
 */
export async function addRoutePoints(routeId, points) {
  // Verify route existence
  await getRouteById(routeId);

  return transaction(async (client) => {
    // Get max existing sequence number
    const maxSeqRes = await client.query('SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM route_points WHERE route_id = $1', [routeId]);
    let nextSeq = parseInt(maxSeqRes.rows[0].max_seq, 10);

    const inserted = [];
    for (const pt of points) {
      const seq = pt.sequence_number || (++nextSeq);
      const res = await client.query(`
        INSERT INTO route_points (route_id, sequence_number, latitude, longitude)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [routeId, seq, pt.latitude, pt.longitude]);
      inserted.push(res.rows[0]);
    }

    return inserted;
  });
}

/**
 * Updates or reorders all intermediate coordinates for a route transactionally.
 */
export async function updateRoutePoints(routeId, points) {
  await getRouteById(routeId);

  return transaction(async (client) => {
    // Replace all existing points with the new exact sequence
    await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);

    const inserted = [];
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const seq = pt.sequence_number || (i + 1);
      const res = await client.query(`
        INSERT INTO route_points (route_id, sequence_number, latitude, longitude)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [routeId, seq, pt.latitude, pt.longitude]);
      inserted.push(res.rows[0]);
    }

    return inserted;
  });
}

/**
 * Deletes a single intermediate coordinate point and preserves remaining sequence.
 */
export async function deleteRoutePoint(routeId, pointId) {
  await getRouteById(routeId);

  const res = await query('DELETE FROM route_points WHERE route_id = $1 AND id = $2 RETURNING *', [routeId, pointId]);
  if (res.rows.length === 0) {
    throw new ApiError(`Point with ID '${pointId}' not found for route '${routeId}'.`, 404);
  }

  return { success: true, message: `Intermediate point ${pointId} deleted.`, deletedPoint: res.rows[0] };
}

/**
 * Creates a new stop.
 */
export async function createStop(validatedStop) {
  const id = validatedStop.id || validatedStop.stopName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const sql = `
    INSERT INTO stops (
      id, stop_name, bengali_name, hindi_name, full_name, full_bengali_name,
      latitude, longitude, coords_description, service_span, stand_format,
      queue_system, tier, active_lines_count, has_live_dispatch, tagline,
      tagline_bengali, landmarks, is_stand, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16,
      $17, $18, $19, $20
    )
    RETURNING *
  `;

  const res = await query(sql, [
    id,
    validatedStop.stopName,
    validatedStop.bengaliName,
    validatedStop.hindiName,
    validatedStop.fullName,
    validatedStop.fullBengaliName,
    validatedStop.latitude,
    validatedStop.longitude,
    validatedStop.coordsDescription,
    validatedStop.serviceSpan,
    validatedStop.standFormat,
    validatedStop.queueSystem,
    validatedStop.tier,
    validatedStop.activeLinesCount,
    validatedStop.hasLiveDispatch,
    validatedStop.tagline,
    validatedStop.taglineBengali,
    JSON.stringify(validatedStop.landmarks || []),
    validatedStop.isStand,
    validatedStop.isActive
  ]);

  return getStopById(id);
}

/**
 * Updates an existing stop.
 */
export async function updateStop(id, stopData) {
  await getStopById(id);

  const currentRes = await query('SELECT * FROM stops WHERE id = $1', [id]);
  const current = currentRes.rows[0];

  const stopName = stopData.stop_name || stopData.stopName || current.stop_name;
  const lat = stopData.latitude ?? stopData.lat ?? current.latitude;
  const lng = stopData.longitude ?? stopData.lng ?? current.longitude;
  const bengaliName = stopData.bengali_name || stopData.bengaliName || current.bengali_name;
  const isActive = stopData.is_active !== undefined ? Boolean(stopData.is_active) : current.is_active;

  const sql = `
    UPDATE stops SET
      stop_name = $1,
      latitude = $2,
      longitude = $3,
      bengali_name = $4,
      is_active = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;

  await query(sql, [stopName, lat, lng, bengaliName, isActive, id]);
  return getStopById(id);
}

/**
 * Deactivates or deletes a stop.
 */
export async function deleteStop(id) {
  await getStopById(id);

  // Check if routes rely on this stop
  const routesUsing = await query('SELECT id FROM routes WHERE source_stop_id = $1 OR destination_stop_id = $1', [id]);
  if (routesUsing.rows.length > 0) {
    // Deactivate instead of deleting to prevent foreign key errors
    await query('UPDATE stops SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    return { success: true, message: `Stop '${id}' has been deactivated (referenced by ${routesUsing.rows.length} routes).` };
  }

  await query('DELETE FROM stops WHERE id = $1', [id]);
  return { success: true, message: `Stop '${id}' deleted.` };
}

