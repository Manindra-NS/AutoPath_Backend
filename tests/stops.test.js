import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.js';
import * as stopService from '../src/services/stopService.js';
import { checkConnection } from '../src/config/database.js';

describe('AutoPath Stops & Stands Service Tests', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  test('1. Database Connection Verification', async () => {
    const status = await checkConnection();
    assert.equal(status.connected, true, 'Database should be connected');
  });

  test('2. Fetching all active stops (/api/stops and /api/stands)', async () => {
    const stops = await stopService.getAllStops();
    assert.ok(Array.isArray(stops), 'Stops should be an array');
    assert.ok(stops.length >= 5, 'Should return at least 5 registered Kolkata auto stands');
    
    // Verify required stop fields
    const rubyMore = stops.find(s => s.id === 'ruby-more');
    assert.ok(rubyMore, 'Ruby More should exist in stops list');
    assert.equal(rubyMore.name, 'Ruby More');
    assert.ok(Array.isArray(rubyMore.coordinates), 'Coordinates should be an array');
    assert.equal(rubyMore.coordinates.length, 2, 'Coordinates should have 2 elements [lat, lng]');
    assert.equal(typeof rubyMore.latitude, 'number');
    assert.equal(typeof rubyMore.longitude, 'number');
    assert.ok(rubyMore.latitude >= -90 && rubyMore.latitude <= 90, 'Latitude must be in [-90, 90]');
    assert.ok(rubyMore.longitude >= -180 && rubyMore.longitude <= 180, 'Longitude must be in [-180, 180]');
  });

  test('3. Fetching an individual stop by ID', async () => {
    const stop = await stopService.getStopById('gariahat');
    assert.ok(stop, 'Gariahat stand should be found');
    assert.equal(stop.id, 'gariahat');
    assert.equal(stop.name, 'Gariahat Crossing');
    assert.equal(stop.coordinates[0], 22.5190);
    assert.equal(stop.coordinates[1], 88.3645);
  });

  test('4. Fetching routes originating from a selected stop (/api/stops/:id/routes)', async () => {
    const routes = await stopService.getRoutesByStopId('ruby-more');
    assert.ok(Array.isArray(routes), 'Routes should be an array');
    assert.ok(routes.length >= 3, 'Ruby More should have at least 3 departing routes');

    const routeNames = routes.map(r => r.name);
    assert.ok(routeNames.some(name => name.includes('Gariahat')), 'Should include Ruby More to Gariahat');
    assert.ok(routeNames.some(name => name.includes('Jadavpur')), 'Should include Ruby More to Jadavpur');

    // Verify source and destination stop information
    const rubyGariahat = routes.find(r => r.id === 'ruby-gariahat');
    assert.ok(rubyGariahat, 'Route ruby-gariahat must be present');
    assert.equal(rubyGariahat.originStandId, 'ruby-more');
    assert.equal(rubyGariahat.destinationStandId, 'gariahat');
    assert.ok(Array.isArray(rubyGariahat.pathCoordinates), 'Route should include pathCoordinates');
  });

  test('5. Non-existent stop ID throws 404', async () => {
    await assert.rejects(
      async () => {
        await stopService.getStopById('non-existent-stop-12345');
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

