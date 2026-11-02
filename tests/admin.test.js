import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.js';
import * as adminService from '../src/services/adminService.js';
import * as routeService from '../src/services/routeService.js';
import * as stopService from '../src/services/stopService.js';
import { validateCoordinate } from '../src/validators/routeValidator.js';
import { query } from '../src/config/database.js';

describe('AutoPath Administrative & Transactional Tests', () => {
  let authToken = null;

  before(async () => {
    const env = await setupTestEnvironment();
    authToken = env.token;
  });

  test('1. Admin Authentication with valid credentials', async () => {
    const res = await adminService.adminLogin('admin', 'Admin@AutoPath2026');
    assert.ok(res.token, 'Token must be issued');
    assert.equal(res.admin.username, 'admin');
  });

  test('2. Admin Authentication with invalid password fails (401)', async () => {
    await assert.rejects(
      async () => {
        await adminService.adminLogin('admin', 'WrongPassword123');
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  test('3. Coordinate validation: Rejects invalid latitude (> 90 or < -90)', () => {
    assert.throws(
      () => validateCoordinate(95.5, 88.4, 'TestPoint'),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => validateCoordinate(-95.5, 88.4, 'TestPoint'),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('4. Coordinate validation: Rejects invalid longitude (> 180 or < -180)', () => {
    assert.throws(
      () => validateCoordinate(22.5, 185.0, 'TestPoint'),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => validateCoordinate(22.5, -190.0, 'TestPoint'),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('5. Coordinate validation: Accepts valid geographic coordinates', () => {
    const valid = validateCoordinate('22.5134', '88.3995', 'ValidPoint');
    assert.equal(valid.latitude, 22.5134);
    assert.equal(valid.longitude, 88.3995);
  });

  test('6. Creating a new auto route and its intermediate coordinates transactionally', async () => {
    const testRouteData = {
      id: 'test-ruby-ballygunge',
      routeName: 'Ruby More ⇄ Ballygunge Phari Test',
      sourceStopId: 'ruby-more',
      destinationStopId: 'ballygunge-phari',
      sourceData: null,
      destinationData: null,
      points: [
        { sequence_number: 1, latitude: 22.5134, longitude: 88.3995 },
        { sequence_number: 2, latitude: 22.5180, longitude: 88.3850 },
        { sequence_number: 3, latitude: 22.5280, longitude: 88.3655 }
      ],
      rawBody: {
        fare_fixed: '₹18.00 Fixed',
        distance: '~4.5 km',
        est_travel: '20m',
        est_travel_min: 20
      }
    };

    const created = await adminService.createRoute(testRouteData);
    assert.ok(created, 'Created route should be returned');
    assert.equal(created.id, 'test-ruby-ballygunge');
    assert.equal(created.name, 'Ruby More ⇄ Ballygunge Phari Test');
    assert.equal(created.pathCoordinates.length, 3, 'Should have exactly 3 coordinates');
    assert.equal(created.hasValidGeometry, true);

    // Verify in database directly
    const pointsRes = await query(
      'SELECT sequence_number, latitude, longitude FROM route_points WHERE route_id = $1 ORDER BY sequence_number ASC',
      ['test-ruby-ballygunge']
    );
    assert.equal(pointsRes.rows.length, 3);
    assert.equal(pointsRes.rows[0].sequence_number, 1);
    assert.equal(pointsRes.rows[1].sequence_number, 2);
    assert.equal(pointsRes.rows[2].sequence_number, 3);
  });

  test('7. Adding intermediate points to existing route', async () => {
    const newPoints = [
      { sequence_number: 4, latitude: 22.5290, longitude: 88.3660 }
    ];

    const added = await adminService.addRoutePoints('test-ruby-ballygunge', newPoints);
    assert.ok(added.length === 1);

    const updatedRoute = await routeService.getRouteById('test-ruby-ballygunge');
    assert.equal(updatedRoute.pathCoordinates.length, 4);
  });

  test('8. Updating and reordering all intermediate coordinates transactionally', async () => {
    // Reorder with new coordinates
    const reordered = [
      { sequence_number: 1, latitude: 22.5134, longitude: 88.3995 },
      { sequence_number: 2, latitude: 22.5200, longitude: 88.3800 },
      { sequence_number: 3, latitude: 22.5250, longitude: 88.3700 },
      { sequence_number: 4, latitude: 22.5280, longitude: 88.3655 }
    ];

    await adminService.updateRoutePoints('test-ruby-ballygunge', reordered);
    const updated = await routeService.getRouteById('test-ruby-ballygunge');
    assert.equal(updated.pathCoordinates.length, 4);
    assert.equal(updated.pathCoordinates[1][0], 22.5200);
    assert.equal(updated.pathCoordinates[1][1], 88.3800);
  });

  test('9. Deleting a single intermediate coordinate point', async () => {
    // Get points for the route
    const pts = await query('SELECT id FROM route_points WHERE route_id = $1 ORDER BY sequence_number ASC', ['test-ruby-ballygunge']);
    const pointToDelete = pts.rows[1].id;

    const delRes = await adminService.deleteRoutePoint('test-ruby-ballygunge', pointToDelete);
    assert.equal(delRes.success, true);

    const updated = await routeService.getRouteById('test-ruby-ballygunge');
    assert.equal(updated.pathCoordinates.length, 3);
  });

  test('10. Deactivating and reactivating a route', async () => {
    // Deactivate
    const deactRes = await adminService.deleteRoute('test-ruby-ballygunge', false);
    assert.equal(deactRes.success, true);

    // Verify it is now inactive
    await assert.rejects(
      async () => {
        await routeService.getRouteById('test-ruby-ballygunge');
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // Reactivate
    const actRes = await adminService.activateRoute('test-ruby-ballygunge');
    assert.equal(actRes.success, true);

    // Verify it is active again
    const reactivated = await routeService.getRouteById('test-ruby-ballygunge');
    assert.equal(reactivated.id, 'test-ruby-ballygunge');
    assert.equal(reactivated.isActive, true);
  });

  test('11. Stop Management: Creating and updating a stop', async () => {
    const newStop = await adminService.createStop({
      id: 'test-science-city',
      stopName: 'Science City More',
      bengaliName: 'সায়েন্স সিটি মোড়',
      latitude: 22.5400,
      longitude: 88.3960,
      coordsDescription: 'EM Bypass & JBS Haldane Ave',
      isStand: true,
      isActive: true
    });

    assert.equal(newStop.id, 'test-science-city');
    assert.equal(newStop.name, 'Science City More');
    assert.equal(newStop.coordinates[0], 22.5400);
    assert.equal(newStop.coordinates[1], 88.3960);

    // Update stop
    const updated = await adminService.updateStop('test-science-city', {
      stop_name: 'Science City Junction'
    });
    assert.equal(updated.name, 'Science City Junction');
  });
});

