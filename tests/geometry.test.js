import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.js';
import * as routeService from '../src/services/routeService.js';
import { query } from '../src/config/database.js';

describe('AutoPath Geometry & Coordinate Sequence Tests (Strict Requirements)', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  test('1. Fetching complete route geometry (/api/routes/:id/geometry)', async () => {
    const geomData = await routeService.getRouteGeometry('ruby-gariahat');
    assert.ok(geomData, 'Geometry data should be returned');
    assert.equal(geomData.route_id, 'ruby-gariahat');
    assert.equal(geomData.route_name, 'Ruby More ⇄ Gariahat');

    // Check Source
    assert.ok(geomData.source, 'Source stop object must be present');
    assert.equal(geomData.source.id, 'ruby-more');
    assert.equal(typeof geomData.source.latitude, 'number');
    assert.equal(typeof geomData.source.longitude, 'number');

    // Check Destination
    assert.ok(geomData.destination, 'Destination stop object must be present');
    assert.equal(geomData.destination.id, 'gariahat');
    assert.equal(typeof geomData.destination.latitude, 'number');
    assert.equal(typeof geomData.destination.longitude, 'number');

    // Check Intermediate Points structure
    assert.ok(Array.isArray(geomData.intermediate_points), 'intermediate_points must be an array');
    assert.ok(geomData.intermediate_points.length >= 2, 'Should have intermediate coordinates');

    // Check GeoJSON geometry structure
    assert.ok(geomData.geometry, 'GeoJSON geometry must be present');
    assert.equal(geomData.geometry.type, 'LineString');
    assert.ok(Array.isArray(geomData.geometry.coordinates), 'GeoJSON coordinates must be an array');

    // Check Leaflet pathCoordinates structure
    assert.ok(Array.isArray(geomData.pathCoordinates), 'Leaflet pathCoordinates must be an array');
  });

  test('2. Strict ascending sequence ordering of intermediate coordinates', async () => {
    const geomData = await routeService.getRouteGeometry('ruby-gariahat');
    const points = geomData.intermediate_points;

    assert.ok(points.length > 5, 'Route should contain road-following coordinates');

    // Verify sequence numbers are strictly ascending 1, 2, 3...
    for (let i = 0; i < points.length; i++) {
      assert.equal(
        points[i].sequence,
        i + 1,
        `Point at index ${i} should have sequence number ${i + 1}`
      );
    }

    // Directly verify against database route_points table
    const dbPointsRes = await query(`
      SELECT sequence_number, latitude, longitude
      FROM route_points
      WHERE route_id = 'ruby-gariahat'
      ORDER BY sequence_number ASC
    `);

    assert.equal(dbPointsRes.rows.length, points.length);
    for (let i = 0; i < dbPointsRes.rows.length; i++) {
      assert.equal(dbPointsRes.rows[i].sequence_number, points[i].sequence);
      assert.equal(parseFloat(dbPointsRes.rows[i].latitude), points[i].latitude);
      assert.equal(parseFloat(dbPointsRes.rows[i].longitude), points[i].longitude);
    }
  });

  test('3. Coordinate ordering: GeoJSON [lng, lat] vs Leaflet [lat, lng]', async () => {
    const geomData = await routeService.getRouteGeometry('ruby-gariahat');
    
    // In Kolkata:
    // Latitude is ~22.5° N
    // Longitude is ~88.3° E
    const leafletFirst = geomData.pathCoordinates[0]; // [lat, lng]
    assert.ok(leafletFirst[0] >= 22.0 && leafletFirst[0] <= 23.0, 'Leaflet coord 0 must be Latitude (~22.5)');
    assert.ok(leafletFirst[1] >= 88.0 && leafletFirst[1] <= 89.0, 'Leaflet coord 1 must be Longitude (~88.3)');

    const geoJsonFirst = geomData.geometry.coordinates[0]; // [lng, lat]
    assert.ok(geoJsonFirst[0] >= 88.0 && geoJsonFirst[0] <= 89.0, 'GeoJSON coord 0 must be Longitude (~88.3)');
    assert.ok(geoJsonFirst[1] >= 22.0 && geoJsonFirst[1] <= 23.0, 'GeoJSON coord 1 must be Latitude (~22.5)');
  });

  test('4. Geographic bounds verification (lat [-90, 90], lng [-180, 180])', async () => {
    const geomData = await routeService.getRouteGeometry('ruby-gariahat');
    
    geomData.intermediate_points.forEach((pt) => {
      assert.ok(pt.latitude >= -90 && pt.latitude <= 90, `Latitude ${pt.latitude} must be within [-90, 90]`);
      assert.ok(pt.longitude >= -180 && pt.longitude <= 180, `Longitude ${pt.longitude} must be within [-180, 180]`);
    });
  });
});

