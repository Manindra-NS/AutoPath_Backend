import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.js';
import * as routeService from '../src/services/routeService.js';

describe('AutoPath Routes Service Tests', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  test('1. Fetching all active routes (/api/routes)', async () => {
    const routes = await routeService.getAllRoutes();
    assert.ok(Array.isArray(routes), 'Routes should be an array');
    assert.ok(routes.length >= 4, 'Should return at least 4 registered routes');

    const first = routes[0];
    assert.ok(first.id, 'Route should have id');
    assert.ok(first.name, 'Route should have name');
    assert.ok(first.startStop, 'Route should have startStop');
    assert.ok(first.destinationStop, 'Route should have destinationStop');
    assert.ok(Array.isArray(first.pathCoordinates), 'Route should have pathCoordinates array');
    assert.equal(first.hasValidGeometry, true, 'hasValidGeometry should be true');
  });

  test('2. Searching routes by origin and destination (/api/routes/search)', async () => {
    const results = await routeService.searchRoutes('Ruby More', 'Gariahat');
    assert.ok(Array.isArray(results), 'Search results should be an array');
    assert.ok(results.length >= 1, 'Should find at least 1 route between Ruby More and Gariahat');
    
    const matched = results.find(r => r.id === 'ruby-gariahat');
    assert.ok(matched, 'Should match ruby-gariahat corridor');
    assert.equal(matched.originStandId, 'ruby-more');
    assert.equal(matched.destinationStandId, 'gariahat');
  });

  test('3. Fetching individual route details (/api/routes/:id)', async () => {
    const route = await routeService.getRouteById('ruby-gariahat');
    assert.ok(route, 'Route ruby-gariahat must be found');
    assert.equal(route.id, 'ruby-gariahat');
    assert.equal(route.name, 'Ruby More ⇄ Gariahat');
    assert.equal(route.code, 'AK-14');
    
    // Verify start and destination stops
    assert.equal(route.startStop.name, 'Ruby More');
    assert.equal(route.destinationStop.name, 'Gariahat Crossing');

    // Verify fare metadata
    assert.ok(route.fareFixed, 'Fare fixed should be present');
    assert.ok(route.distance, 'Distance should be present');
    assert.ok(route.estTravelMin, 'Estimated travel time should be present');

    // Verify stops progression timeline
    assert.ok(Array.isArray(route.stops), 'Stops should be an array');
    assert.ok(route.stops.length >= 2, 'Route should have intermediate stops');
  });

  test('4. Fetching ordered intermediate passenger stops (/api/routes/:id/stops)', async () => {
    const stops = await routeService.getRouteStops('ruby-gariahat');
    assert.ok(Array.isArray(stops), 'Intermediate stops must be an array');
    assert.ok(stops.length >= 2, 'Route should contain intermediate stops');

    // Verify stops are ordered ascending by order
    for (let i = 0; i < stops.length - 1; i++) {
      assert.ok(
        stops[i].order <= stops[i + 1].order,
        `Stop #${stops[i].order} should precede stop #${stops[i + 1].order}`
      );
    }
  });

  test('5. Non-existent route ID throws 404', async () => {
    await assert.rejects(
      async () => {
        await routeService.getRouteById('unknown-route-9999');
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

