import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import app from '../src/app.js';
import { setupTestEnvironment } from './setup.js';

/**
 * In-process HTTP request simulator for Express.
 * Bypasses OS TCP socket layer so it runs cleanly inside sandboxed environments.
 */
function mockRequest(app, method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const { headers = {}, body = null } = options;

    const req = new EventEmitter();
    req.method = method.toUpperCase();
    const parsedUrl = new URL(url, 'http://localhost:5000');
    req.url = parsedUrl.pathname + parsedUrl.search;
    req.originalUrl = req.url;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;
    req.headers = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    };
    req.query = Object.fromEntries(parsedUrl.searchParams);
    req.body = body || {};

    const resHeaders = {};
    let statusCode = 200;
    let resBody = '';

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        resHeaders[name.toLowerCase()] = val;
        return this;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name) {
        delete resHeaders[name.toLowerCase()];
        return this;
      },
      hasHeader(name) {
        return Object.prototype.hasOwnProperty.call(resHeaders, name.toLowerCase());
      },
      getHeaders() {
        return resHeaders;
      },
      set(name, val) {
        return this.setHeader(name, val);
      },
      json(data) {
        resHeaders['content-type'] = 'application/json';
        resBody = JSON.stringify(data);
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
          json: async () => data
        });
      },
      send(data) {
        resBody = data;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
          json: async () => (typeof data === 'string' ? JSON.parse(data) : data)
        });
      },
      end(data) {
        if (data) resBody = data;
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: resBody,
          json: async () => (typeof resBody === 'string' ? JSON.parse(resBody) : resBody)
        });
      }
    };

    try {
      app(req, res, (err) => {
        if (err) return reject(err);
        resolve({ status: statusCode, headers: resHeaders, body: resBody });
      });
    } catch (e) {
      reject(e);
    }
  });
}

describe('AutoPath End-to-End HTTP REST API Tests', () => {
  let adminToken;

  before(async () => {
    const env = await setupTestEnvironment();
    adminToken = env.token;
  });

  test('GET /health returns healthy status', async () => {
    const res = await mockRequest(app, 'GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
  });

  test('GET /api/docs.json returns OpenAPI 3.0 specification', async () => {
    const res = await mockRequest(app, 'GET', '/api/docs.json');
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.equal(res.body.info.title, 'AutoPath Backend REST API');
  });

  test('GET /api/stands returns all auto stands with CORS headers', async () => {
    const res = await mockRequest(app, 'GET', '/api/stands', {
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.count >= 5);
  });

  test('GET /api/stops is interchangeable with /api/stands', async () => {
    const resStops = await mockRequest(app, 'GET', '/api/stops');
    const resStands = await mockRequest(app, 'GET', '/api/stands');

    assert.equal(resStops.body.count, resStands.body.count);
    assert.equal(resStops.body.data[0].id, resStands.body.data[0].id);
  });

  test('GET /api/stands/:id/routes returns departing corridors', async () => {
    const res = await mockRequest(app, 'GET', '/api/stands/ruby-more/routes');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.count >= 3);
  });

  test('GET /api/routes/search?from=Ruby&to=Gariahat', async () => {
    const res = await mockRequest(app, 'GET', '/api/routes/search?from=Ruby&to=Gariahat');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].id, 'ruby-gariahat');
  });

  test('GET /api/routes/:id/geometry matches Section 9 specification', async () => {
    const res = await mockRequest(app, 'GET', '/api/routes/ruby-gariahat/geometry');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    
    // Check fields strictly requested in prompt
    assert.equal(res.body.data.route_id, 'ruby-gariahat');
    assert.ok(res.body.data.source);
    assert.ok(res.body.data.destination);
    assert.ok(Array.isArray(res.body.data.intermediate_points));
    assert.equal(res.body.data.geometry.type, 'LineString');
    assert.ok(Array.isArray(res.body.data.geometry.coordinates));
  });

  test('GET /api/locations/search?q=Garia returns suggestions', async () => {
    const res = await mockRequest(app, 'GET', '/api/locations/search?q=Garia');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 1);
  });

  test('POST /api/admin/routes without Bearer token is rejected with 401', async () => {
    const res = await mockRequest(app, 'POST', '/api/admin/routes', {
      body: { name: 'Unauthorized Route' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('POST /api/admin/routes with valid Bearer token creates route', async () => {
    const res = await mockRequest(app, 'POST', '/api/admin/routes', {
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        id: 'api-e2e-route-test',
        route_name: 'E2E Test Corridor',
        source_stop_id: 'ruby-more',
        destination_stop_id: 'gariahat',
        fare_fixed: '₹15.00 Fixed',
        intermediate_points: [
          { sequence_number: 1, latitude: 22.5134, longitude: 88.3995 },
          { sequence_number: 2, latitude: 22.5190, longitude: 88.3645 }
        ]
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, 'api-e2e-route-test');
  });
});
