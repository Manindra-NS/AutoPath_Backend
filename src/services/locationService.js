import { query } from '../config/database.js';

/**
 * Searches auto stands and locations for autocomplete suggestions.
 */
export async function searchLocations(searchQuery = '') {
  const q = searchQuery.trim().toLowerCase();

  if (!q) {
    // Return top popular hubs
    const res = await query(`
      SELECT 
        s.id,
        s.stop_name as name,
        s.bengali_name as "bengaliName",
        s.coords_description as subtext,
        'stand' as type,
        s.tier as category,
        s.latitude,
        s.longitude
      FROM stops s
      WHERE s.is_active = TRUE AND s.is_stand = TRUE
      LIMIT 10
    `);

    return res.rows.map(r => ({
      ...r,
      coordinates: [parseFloat(r.latitude), parseFloat(r.longitude)]
    }));
  }

  // Search in stops and search_keywords
  const sql = `
    SELECT 
      s.id,
      s.stop_name as name,
      s.bengali_name as "bengaliName",
      s.coords_description as subtext,
      'stand' as type,
      s.tier as category,
      s.latitude,
      s.longitude
    FROM stops s
    WHERE s.is_active = TRUE 
      AND (
        LOWER(s.stop_name) LIKE $1 
        OR (s.bengali_name IS NOT NULL AND s.bengali_name LIKE $1)
        OR (s.coords_description IS NOT NULL AND LOWER(s.coords_description) LIKE $1)
      )
    ORDER BY s.active_lines_count DESC, s.stop_name ASC
    LIMIT 15
  `;
  const result = await query(sql, [`%${q}%`]);

  return result.rows.map(r => ({
    id: r.id,
    name: r.name,
    bengaliName: r.bengaliName || r.name,
    subtext: r.subtext || '',
    type: r.type,
    category: r.category,
    coordinates: [parseFloat(r.latitude), parseFloat(r.longitude)]
  }));
}

