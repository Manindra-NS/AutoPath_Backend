import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorMiddleware.js';

/**
 * Formats a route row and its associated points and stops.
 */
export function formatFullRoute(routeRow, pointsRows = [], stopsRows = []) {
  if (!routeRow) return null;

  const srcLat = parseFloat(routeRow.source_latitude);
  const srcLng = parseFloat(routeRow.source_longitude);
  const destLat = parseFloat(routeRow.destination_latitude);
  const destLng = parseFloat(routeRow.destination_longitude);

  const startStop = {
    id: routeRow.source_stop_id,
    name: routeRow.source_name,
    bengaliName: routeRow.source_bengali_name || routeRow.source_name,
    latitude: srcLat,
    longitude: srcLng,
    coordinates: [srcLat, srcLng],
    isStand: Boolean(routeRow.source_is_stand),
    subtext: routeRow.source_coords_description || 'Origin Terminal'
  };

  const destinationStop = {
    id: routeRow.destination_stop_id,
    name: routeRow.destination_name,
    bengaliName: routeRow.destination_bengali_name || routeRow.destination_name,
    latitude: destLat,
    longitude: destLng,
    coordinates: [destLat, destLng],
    isStand: Boolean(routeRow.destination_is_stand),
    subtext: routeRow.destination_coords_description || 'Destination Terminal'
  };

  // Intermediate points ordered strictly by sequence_number
  const intermediatePoints = pointsRows.map(p => ({
    id: p.id,
    sequence: p.sequence_number,
    sequence_number: p.sequence_number,
    latitude: parseFloat(p.latitude),
    longitude: parseFloat(p.longitude)
  }));

  // Build Leaflet coordinates: [[lat, lng], ...]
  let pathCoordinates = [];
  if (intermediatePoints.length > 0) {
    pathCoordinates = intermediatePoints.map(p => [p.latitude, p.longitude]);
  } else {
    // If no intermediate points entered, fall back to start and dest
    pathCoordinates = [
      [srcLat, srcLng],
      [destLat, destLng]
    ];
  }

  // Build GeoJSON coordinates: [[lng, lat], ...] (GeoJSON standard ordering)
  const geoJsonCoordinates = pathCoordinates.map(([lat, lng]) => [lng, lat]);

  // Format ordered passenger stops
  const stops = stopsRows.map((s, idx) => ({
    id: s.stop_id || `stop-${s.order_index || (idx + 1)}`,
    name: s.stop_name,
    bengaliName: s.bengali_name || s.stop_name,
    hindiName: s.hindi_name || '',
    order: s.order_index,
    distance: s.distance || `${s.dist_km || 0} km`,
    distKm: parseFloat(s.dist_km || 0),
    badge: s.badge || null,
    badgeIcon: s.badge_icon || null,
    subtext: s.subtext || '',
    isStand: Boolean(s.is_stand),
    isTransfer: Boolean(s.is_transfer),
    coordinates: [parseFloat(s.latitude), parseFloat(s.longitude)]
  }));

  return {
    id: routeRow.id,
    routeId: routeRow.id,
    code: routeRow.route_code || 'AK-AUTO',
    codeAlt: routeRow.route_code_alt || '',
    name: routeRow.route_name,
    routeName: routeRow.route_name,
    subtitle: routeRow.subtitle || '',
    bengaliName: routeRow.bengali_name || routeRow.route_name,
    bengaliSubtitle: routeRow.bengali_subtitle || '',
    hindiName: routeRow.hindi_name || '',
    originStandId: routeRow.source_stop_id,
    destinationStandId: routeRow.destination_stop_id,
    
    // Terminal and Intermediate Stops
    startStop,
    destinationStop,
    source: startStop,
    destination: destinationStop,
    stops: stops.length > 0 ? stops : [startStop, destinationStop],
    intermediateStops: stops,
    
    // Geometry & Coordinates
    intermediate_points: intermediatePoints,
    intermediatePoints,
    pathCoordinates, // Leaflet convention [lat, lng]
    roadGeometry: pathCoordinates,
    hasValidGeometry: pathCoordinates.length >= 2,
    geometry: {
      type: 'LineString',
      coordinates: geoJsonCoordinates // GeoJSON convention [lng, lat]
    },

    // Fare & Schedule Metadata
    fareRange: routeRow.fare_range || '₹12 - ₹15',
    fareFixed: routeRow.fare_fixed || '₹15 Fixed',
    govtShareFare: routeRow.govt_share_fare || '',
    fareType: routeRow.fare_type || 'Per Seat Share',
    distance: routeRow.distance || '~4.0 km',
    distanceKm: parseFloat(routeRow.distance_km || 4.0),
    estTravel: routeRow.est_travel || '15-20m',
    estTravelMin: parseInt(routeRow.est_travel_min || 18, 10),
    queueFreq: routeRow.queue_freq || '2-4 min',
    isDirect: Boolean(routeRow.is_direct),
    isRecommended: Boolean(routeRow.is_recommended),
    routeType: routeRow.route_type || 'direct',
    category: routeRow.category || '',
    status: routeRow.status || 'Active Queue Now',
    notes: routeRow.notes || '',
    isActive: Boolean(routeRow.is_active),
    createdAt: routeRow.created_at,
    updatedAt: routeRow.updated_at
  };
}

/**
 * Retrieves all active routes.
 */
export async function getAllRoutes() {
  const sql = `
    SELECT 
      r.*,
      src.stop_name as source_name,
      src.bengali_name as source_bengali_name,
      src.latitude as source_latitude,
      src.longitude as source_longitude,
      src.is_stand as source_is_stand,
      src.coords_description as source_coords_description,
      dest.stop_name as destination_name,
      dest.bengali_name as destination_bengali_name,
      dest.latitude as destination_latitude,
      dest.longitude as destination_longitude,
      dest.is_stand as destination_is_stand,
      dest.coords_description as destination_coords_description
    FROM routes r
    JOIN stops src ON r.source_stop_id = src.id
    JOIN stops dest ON r.destination_stop_id = dest.id
    WHERE r.is_active = TRUE
    ORDER BY r.route_name ASC
  `;
  const result = await query(sql);

  const routeIds = result.rows.map(r => r.id);
  let pointsByRoute = {};
  if (routeIds.length > 0) {
    const pointsRes = await query(`
      SELECT route_id, id, sequence_number, latitude, longitude
      FROM route_points
      WHERE route_id = ANY($1)
      ORDER BY route_id, sequence_number ASC
    `, [routeIds]);

    pointsRes.rows.forEach(p => {
      if (!pointsByRoute[p.route_id]) {
        pointsByRoute[p.route_id] = [];
      }
      pointsByRoute[p.route_id].push(p);
    });
  }

  return result.rows.map(row => {
    const points = pointsByRoute[row.id] || [];
    return formatFullRoute(row, points, []);
  });
}

/**
 * Searches routes matching from/to query parameters.
 */
export async function searchRoutes(from = '', to = '', options = {}) {
  const fromClean = from.trim().toLowerCase();
  const toClean = to.trim().toLowerCase();

  const allRoutes = await getAllRoutes();

  if (!fromClean && !toClean) {
    return allRoutes;
  }

  return allRoutes.filter(route => {
    const originMatch = !fromClean || 
      route.name.toLowerCase().includes(fromClean) ||
      route.bengaliName.includes(fromClean) ||
      route.originStandId.toLowerCase().includes(fromClean) ||
      route.startStop.name.toLowerCase().includes(fromClean);

    const destMatch = !toClean || 
      route.name.toLowerCase().includes(toClean) ||
      route.bengaliName.includes(toClean) ||
      route.destinationStandId.toLowerCase().includes(toClean) ||
      route.destinationStop.name.toLowerCase().includes(toClean) ||
      route.stops.some(s => s.name.toLowerCase().includes(toClean) || (s.bengaliName && s.bengaliName.includes(toClean)));

    return originMatch && destMatch;
  });
}

/**
 * Retrieves a single route by ID with complete ordered points and stops.
 */
export async function getRouteById(id) {
  const routeSql = `
    SELECT 
      r.*,
      src.stop_name as source_name,
      src.bengali_name as source_bengali_name,
      src.latitude as source_latitude,
      src.longitude as source_longitude,
      src.is_stand as source_is_stand,
      src.coords_description as source_coords_description,
      dest.stop_name as destination_name,
      dest.bengali_name as destination_bengali_name,
      dest.latitude as destination_latitude,
      dest.longitude as destination_longitude,
      dest.is_stand as destination_is_stand,
      dest.coords_description as destination_coords_description
    FROM routes r
    JOIN stops src ON r.source_stop_id = src.id
    JOIN stops dest ON r.destination_stop_id = dest.id
    WHERE r.id = $1 AND r.is_active = TRUE
  `;
  const routeResult = await query(routeSql, [id]);

  if (routeResult.rows.length === 0) {
    throw new ApiError(`Route with ID '${id}' not found.`, 404);
  }

  // Fetch intermediate points ordered strictly ascending by sequence_number
  const pointsSql = `
    SELECT id, sequence_number, latitude, longitude
    FROM route_points
    WHERE route_id = $1
    ORDER BY sequence_number ASC
  `;
  const pointsResult = await query(pointsSql, [id]);

  // Fetch ordered passenger boarding stops
  const stopsSql = `
    SELECT *
    FROM route_stops
    WHERE route_id = $1
    ORDER BY order_index ASC
  `;
  const stopsResult = await query(stopsSql, [id]);

  return formatFullRoute(routeResult.rows[0], pointsResult.rows, stopsResult.rows);
}

/**
 * Retrieves route geometry strictly formatted as specified in prompt Section 8 & 9.
 */
export async function getRouteGeometry(id) {
  const fullRoute = await getRouteById(id);

  return {
    route_id: fullRoute.id,
    route_name: fullRoute.name,
    source: {
      id: fullRoute.source.id,
      name: fullRoute.source.name,
      latitude: fullRoute.source.latitude,
      longitude: fullRoute.source.longitude
    },
    destination: {
      id: fullRoute.destination.id,
      name: fullRoute.destination.name,
      latitude: fullRoute.destination.latitude,
      longitude: fullRoute.destination.longitude
    },
    intermediate_points: fullRoute.intermediate_points.map(p => ({
      sequence: p.sequence,
      latitude: p.latitude,
      longitude: p.longitude
    })),
    geometry: {
      type: 'LineString',
      coordinates: fullRoute.geometry.coordinates // GeoJSON [lng, lat]
    },
    pathCoordinates: fullRoute.pathCoordinates // Leaflet [lat, lng]
  };
}

/**
 * Retrieves ordered intermediate stops for a route.
 */
export async function getRouteStops(id) {
  const fullRoute = await getRouteById(id);
  return fullRoute.stops;
}

