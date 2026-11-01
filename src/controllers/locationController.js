import * as locationService from '../services/locationService.js';

/**
 * Controller: GET /api/locations/search?q=query
 */
export async function searchLocations(req, res, next) {
  try {
    const query = req.query.q || req.query.query || '';
    const suggestions = await locationService.searchLocations(query);
    res.json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (err) {
    next(err);
  }
}

