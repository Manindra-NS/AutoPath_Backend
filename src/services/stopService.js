import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorMiddleware.js';

/**
 * Formats a raw database row into a frontend-ready Stop object.
 */
export function formatStopRow(row) {
  if (!row) return null;
  const lat = parseFloat(row.latitude);
  const lng = parseFloat(row.longitude);

  return {
    id: row.id,
    name: row.stop_name,
    stopName: row.stop_name,
    bengaliName: row.bengali_name || row.stop_name,
    hindiName: row.hindi_name || '',
    fullName: row.full_name || `${row.stop_name} Auto Stand`,
    fullBengaliName: row.full_bengali_name || `${row.bengali_name || row.stop_name} অটো স্ট্যান্ড`,
    latitude: lat,
    longitude: lng,
    coordinates: [lat, lng],
    coordsDescription: row.coords_description || '',
    serviceSpan: row.service_span || '05:30 AM – Midnight',
    standFormat: row.stand_format || 'Auto Stand',
    queueSystem: row.queue_system || 'Union Regulated',
    tier: row.tier || 'ACTIVE AUTO HUB',
    activeLinesCount: row.active_lines_count || 0,
    hasLiveDispatch: Boolean(row.has_live_dispatch),
    tagline: row.tagline || '',
    taglineBengali: row.tagline_bengali || '',
    directRoutesCount: row.direct_routes_count ? parseInt(row.direct_routes_count, 10) : (row.active_lines_count || 0),
    landmarks: Array.isArray(row.landmarks) ? row.landmarks : (typeof row.landmarks === 'string' ? JSON.parse(row.landmarks) : []),
    isStand: Boolean(row.is_stand),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Retrieves all active auto stands and stops.
 */
export async function getAllStops(filter = {}) {
  let sql = `
    SELECT *
    FROM stops
    WHERE is_active = TRUE
  `;
  const params = [];

  if (filter.isStand !== undefined) {
    params.push(Boolean(filter.isStand));
    sql += ` AND is_stand = $${params.length}`;
  }

  sql += ` ORDER BY stop_name ASC`;

  const result = await query(sql, params);

  // Retrieve route counts for each stop cleanly without alias subquery
  const countsRes = await query(`
    SELECT source_stop_id, COUNT(*) as cnt
    FROM routes
    WHERE is_active = TRUE
    GROUP BY source_stop_id
  `);
  const countsMap = {};
  countsRes.rows.forEach(c => {
    countsMap[c.source_stop_id] = parseInt(c.cnt, 10);
  });

  return result.rows.map(r => {
    r.direct_routes_count = countsMap[r.id] || r.active_lines_count || 0;
    return formatStopRow(r);
  });
}

/**
 * Retrieves a single stop by its ID.
 */
export async function getStopById(id) {
  const sql = `
    SELECT *
    FROM stops
    WHERE id = $1 AND is_active = TRUE
  `;
  const result = await query(sql, [id]);
  if (result.rows.length === 0) {
    throw new ApiError(`Auto stop with ID '${id}' not found.`, 404);
  }

  const countRes = await query('SELECT COUNT(*) as cnt FROM routes WHERE source_stop_id = $1 AND is_active = TRUE', [id]);
  const row = result.rows[0];
  row.direct_routes_count = parseInt(countRes.rows[0]?.cnt || 0, 10) || row.active_lines_count || 0;

  return formatStopRow(row);
}

/**
 * Retrieves all active routes originating from (or connected to) a specific stop.
 */
export async function getRoutesByStopId(stopId) {
  // Check stop existence
  await getStopById(stopId);

  const sql = `
    SELECT 
      r.*,
      src.stop_name as source_name,
      src.bengali_name as source_bengali_name,
      src.latitude as source_latitude,
      src.longitude as source_longitude,
      dest.stop_name as destination_name,
      dest.bengali_name as destination_bengali_name,
      dest.latitude as destination_latitude,
      dest.longitude as destination_longitude
    FROM routes r
    JOIN stops src ON r.source_stop_id = src.id
    JOIN stops dest ON r.destination_stop_id = dest.id
    WHERE r.is_active = TRUE AND r.source_stop_id = $1
    ORDER BY r.route_name ASC
  `;
  const result = await query(sql, [stopId]);

  // Fetch points for each route to draw preview corridors if requested
  const routeIds = result.rows.map(r => r.id);
  let pointsByRoute = {};
  if (routeIds.length > 0) {
    const pointsRes = await query(`
      SELECT route_id, latitude, longitude, sequence_number
      FROM route_points
      WHERE route_id = ANY($1)
      ORDER BY route_id, sequence_number ASC
    `, [routeIds]);

    pointsRes.rows.forEach(p => {
      if (!pointsByRoute[p.route_id]) {
        pointsByRoute[p.route_id] = [];
      }
      pointsByRoute[p.route_id].push([parseFloat(p.latitude), parseFloat(p.longitude)]);
    });
  }

  return result.rows.map(row => {
    const coords = pointsByRoute[row.id] || [];
    // Ensure terminal stops are in coords if points list is empty
    const pathCoords = coords.length >= 2 
      ? coords 
      : [[parseFloat(row.source_latitude), parseFloat(row.source_longitude)], [parseFloat(row.destination_latitude), parseFloat(row.destination_longitude)]];

    return {
      id: row.id,
      code: row.route_code || 'AK-AUTO',
      codeAlt: row.route_code_alt || '',
      name: row.route_name,
      subtitle: row.subtitle || '',
      bengaliName: row.bengali_name || row.route_name,
      bengaliSubtitle: row.bengali_subtitle || '',
      hindiName: row.hindi_name || '',
      originStandId: row.source_stop_id,
      destinationStandId: row.destination_stop_id,
      source: {
        id: row.source_stop_id,
        name: row.source_name,
        bengaliName: row.source_bengali_name,
        latitude: parseFloat(row.source_latitude),
        longitude: parseFloat(row.source_longitude),
        coordinates: [parseFloat(row.source_latitude), parseFloat(row.source_longitude)]
      },
      destination: {
        id: row.destination_stop_id,
        name: row.destination_name,
        bengaliName: row.destination_bengali_name,
        latitude: parseFloat(row.destination_latitude),
        longitude: parseFloat(row.destination_longitude),
        coordinates: [parseFloat(row.destination_latitude), parseFloat(row.destination_longitude)]
      },
      fareRange: row.fare_range || '₹12 - ₹15',
      fareFixed: row.fare_fixed || '₹15 Fixed',
      govtShareFare: row.govt_share_fare || '',
      fareType: row.fare_type || 'Per Seat Share',
      distance: row.distance || '~4.0 km',
      distanceKm: parseFloat(row.distance_km || 4.0),
      estTravel: row.est_travel || '15-20m',
      estTravelMin: parseInt(row.est_travel_min || 18, 10),
      queueFreq: row.queue_freq || '2-4 min',
      isDirect: Boolean(row.is_direct),
      isRecommended: Boolean(row.is_recommended),
      routeType: row.route_type || 'direct',
      category: row.category || '',
      status: row.status || 'Active Queue Now',
      notes: row.notes || '',
      pathCoordinates: pathCoords,
      hasValidGeometry: pathCoords.length >= 2
    };
  });
}
