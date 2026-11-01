# AutoPath Backend REST API Documentation

Comprehensive reference documentation for the **AutoPath** backend server.

AutoPath is a public transit discovery service for Kolkata's shared auto-rickshaw network. The backend serves as the single source of truth for all auto stands, routes, union-regulated fares, intermediate boarding/alighting stops, and exact road-following polyline coordinates.

---

## Table of Contents
1. [Base URL & Authentication](#1-base-url--authentication)
2. [CORS & Frontend Integration](#2-cors--frontend-integration)
3. [Auto Stands & Stops Endpoints](#3-auto-stands--stops-endpoints)
4. [Route Discovery Endpoints](#4-route-discovery-endpoints)
5. [Route Geometry Endpoint (Strict Requirement)](#5-route-geometry-endpoint-strict-requirement)
6. [Location Search Endpoint](#6-location-search-endpoint)
7. [Administrative Endpoints](#7-administrative-endpoints)
8. [Error Handling & Status Codes](#8-error-handling--status-codes)

---

## 1. Base URL & Authentication

- **Base URL**: `http://localhost:5000/api`
- **Interactive Swagger UI**: `http://localhost:5000/api/docs`
- **Raw OpenAPI Spec**: `http://localhost:5000/api/docs.json`
- **Health Check**: `http://localhost:5000/api/health`

### Authentication Scheme
- **Public Endpoints**: No authentication required.
- **Administrative Endpoints (`/api/admin/*`)**: Require a JSON Web Token (JWT) sent via HTTP Header:
  ```http
  Authorization: Bearer <jwt_token>
  ```
  Obtain a token via `POST /api/admin/auth/login`.

---

## 2. CORS & Frontend Integration

The backend is configured to support Cross-Origin Resource Sharing (CORS) with the frontend:
- Allowed Origins: `http://localhost:5173`, `http://127.0.0.1:5173` (configurable via `CORS_ORIGIN` in `.env`).
- Allowed Methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`.
- Allowed Headers: `Content-Type`, `Accept`, `Authorization`.

---

## 3. Auto Stands & Stops Endpoints

> **Note on Frontend Compatibility**: Both `/api/stops` and `/api/stands` are mounted to the same controller. You may use either interchangeably.

### A. List All Active Auto Stands
- **Endpoint**: `GET /api/stands` (or `GET /api/stops`)
- **Query Parameters**:
  - `is_stand` (optional, boolean): Filter only terminal stands (`true`) or intermediate stops (`false`).
- **Response**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": "ruby-more",
      "name": "Ruby More",
      "bengaliName": "রুবি মোড়",
      "hindiName": "रूबी मोड़",
      "fullName": "Ruby More Auto Stand",
      "latitude": 22.5134,
      "longitude": 88.3995,
      "coordinates": [22.5134, 88.3995],
      "coordsDescription": "EM Bypass & Rashbehari Conn.",
      "serviceSpan": "05:30 AM – Midnight",
      "standFormat": "Multi-Corridor Master",
      "queueSystem": "Sheltered • Union Regulated",
      "tier": "TIER-1 INTERCHANGE HUB",
      "activeLinesCount": 4,
      "directRoutesCount": 4,
      "hasLiveDispatch": true,
      "tagline": "Major Eastern Metropolitan Transit Junction • Connecting EM Bypass to South Kolkata",
      "landmarks": [
        { "name": "Ruby General Hospital", "type": "hospital", "label": "Tier-1 Trauma Center" },
        { "name": "Hemanta Mukherjee Metro", "type": "metro", "label": "Orange Line Kavi Subhash Link" }
      ],
      "isStand": true
    }
  ]
}
```

### B. Get Stop Details by ID
- **Endpoint**: `GET /api/stands/:id` (or `GET /api/stops/:id`)
- **Parameters**: `id` (e.g. `ruby-more`, `gariahat`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "gariahat",
    "name": "Gariahat Crossing",
    "bengaliName": "গড়িয়াহাট মোড়",
    "coordinates": [22.5190, 88.3645],
    "serviceSpan": "06:00 AM – 11:30 PM",
    "isStand": true
  }
}
```

### C. Get Departing Corridors for a Stand
- **Endpoint**: `GET /api/stands/:id/routes` (or `GET /api/stops/:id/routes`)
- **Parameters**: `id` (e.g. `ruby-more`)
- **Response**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "ruby-gariahat",
      "code": "AK-14",
      "name": "Ruby More ⇄ Gariahat",
      "bengaliName": "রুবি মোড় ⇄ গড়িয়াহাট",
      "originStandId": "ruby-more",
      "destinationStandId": "gariahat",
      "fareFixed": "₹16.00 Fixed",
      "distance": "~4.2 km",
      "estTravelMin": 18,
      "queueFreq": "2-4 min",
      "routeType": "direct",
      "pathCoordinates": [
        [22.5134, 88.3995],
        [22.5150, 88.3910],
        [22.5190, 88.3645]
      ],
      "hasValidGeometry": true
    }
  ]
}
```

---

## 4. Route Discovery Endpoints

### A. List All Active Routes
- **Endpoint**: `GET /api/routes`
- **Response**: List of all active auto corridors.

### B. Search Routes Between Locations
- **Endpoint**: `GET /api/routes/search?from={from}&to={to}`
- **Query Parameters**:
  - `from` (string): Origin stop name or stand ID (e.g. `Ruby More`)
  - `to` (string): Destination stop name or stand ID (e.g. `Gariahat`)
- **Response**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "ruby-gariahat",
      "code": "AK-14",
      "name": "Ruby More ⇄ Gariahat",
      "originStandId": "ruby-more",
      "destinationStandId": "gariahat",
      "fareRange": "₹12 - ₹15",
      "fareFixed": "₹16.00 Fixed",
      "distance": "~4.2 km",
      "estTravelMin": 18,
      "pathCoordinates": [ ... ]
    }
  ],
  "query": { "from": "Ruby More", "to": "Gariahat" }
}
```

### C. Get Route Details by ID
- **Endpoint**: `GET /api/routes/:id`
- **Parameters**: `id` (e.g. `ruby-gariahat`)
- **Response**: Complete route details with starting point, ending point, ordered passenger stops, and road coordinates.

### D. Get Ordered Passenger Stops
- **Endpoint**: `GET /api/routes/:id/stops`
- **Parameters**: `id` (e.g. `ruby-gariahat`)
- **Response**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": "stop-ruby",
      "name": "Ruby More (Origin Stand)",
      "order": 1,
      "distance": "0.0 km",
      "coordinates": [22.5134, 88.3995],
      "isStand": true
    },
    {
      "id": "stop-acropolis",
      "name": "Acropolis Mall / Rajdanga",
      "order": 2,
      "distance": "1.1 km",
      "coordinates": [22.5150, 88.3910],
      "isStand": false
    },
    {
      "id": "stop-gariahat",
      "name": "Gariahat Crossing (Terminus)",
      "order": 6,
      "distance": "4.2 km",
      "coordinates": [22.5190, 88.3645],
      "isStand": true
    }
  ]
}
```

---

## 5. Route Geometry Endpoint (Strict Requirement)

### `GET /api/routes/:id/geometry`
Retrieves the complete geographical geometry of the selected route.

**Response Structure (strictly matches Section 9 specification):**
```json
{
  "success": true,
  "data": {
    "route_id": "ruby-gariahat",
    "route_name": "Ruby More ⇄ Gariahat",
    "source": {
      "id": "ruby-more",
      "name": "Ruby More",
      "latitude": 22.5134,
      "longitude": 88.3995
    },
    "destination": {
      "id": "gariahat",
      "name": "Gariahat Crossing",
      "latitude": 22.5190,
      "longitude": 88.3645
    },
    "intermediate_points": [
      {
        "sequence": 1,
        "latitude": 22.5134,
        "longitude": 88.3995
      },
      {
        "sequence": 2,
        "latitude": 22.5150,
        "longitude": 88.3910
      },
      {
        "sequence": 3,
        "latitude": 22.5190,
        "longitude": 88.3645
      }
    ],
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [88.3995, 22.5134],
        [88.3910, 22.5150],
        [88.3645, 22.5190]
      ]
    },
    "pathCoordinates": [
      [22.5134, 88.3995],
      [22.5150, 88.3910],
      [22.5190, 88.3645]
    ]
  }
}
```

> **Coordinate Ordering Rules**:
> - `geometry.coordinates`: GeoJSON convention `[longitude, latitude]`.
> - `pathCoordinates`: Leaflet convention `[latitude, longitude]`.
> - `intermediate_points`: Array of exact coordinates ordered strictly ascending by `sequence`.

---

## 6. Location Search Endpoint

### `GET /api/locations/search?q={query}`
Returns autocomplete suggestions matching Kolkata auto stands, landmarks, and major intersections.
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "garia-metro",
      "name": "Garia More",
      "bengaliName": "গড়িয়া মোড় (কবি নজরুল)",
      "subtext": "NSC Bose Rd & EM Bypass Ext.",
      "type": "stand",
      "category": "Metro Terminus Hub",
      "coordinates": [22.4645, 88.3790]
    }
  ]
}
```

---

## 7. Administrative Endpoints

All admin endpoints under `/api/admin` (except login and register) require `Authorization: Bearer <token>`.

### A. Admin Login
- **Endpoint**: `POST /api/admin/auth/login`
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "Admin@AutoPath2026"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "admin": { "id": 1, "username": "admin", "email": "admin@autopath.kolkata.in", "role": "admin" },
      "token": "<jwt_token>"
    }
  }
  ```

### B. Create Route with Intermediate Coordinates (Transactional)
- **Endpoint**: `POST /api/admin/routes`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "id": "ruby-chowbaga",
    "route_name": "Ruby More ⇄ Chowbaga / Anandapur",
    "source_stop_id": "ruby-more",
    "destination_stop_id": "chowbaga",
    "fare_fixed": "₹14.00 Fixed",
    "distance": "~3.1 km",
    "est_travel_min": 12,
    "intermediate_points": [
      { "sequence_number": 1, "latitude": 22.5134, "longitude": 88.3995 },
      { "sequence_number": 2, "latitude": 22.5145, "longitude": 88.4080 },
      { "sequence_number": 3, "latitude": 22.5160, "longitude": 88.4140 },
      { "sequence_number": 4, "latitude": 22.5180, "longitude": 88.4230 }
    ]
  }
  ```

### C. Update Route Information
- **Endpoint**: `PUT /api/admin/routes/:id`
- **Request Body**: Update name, fare, distance, status, etc.

### D. Deactivate or Delete Route
- **Endpoint**: `DELETE /api/admin/routes/:id`
- **Query**: `?permanent=false` (deactivate, default) or `?permanent=true` (hard delete).

### E. Add Intermediate Coordinates to Route
- **Endpoint**: `POST /api/admin/routes/:id/points`
- **Request Body**:
  ```json
  {
    "points": [
      { "sequence_number": 5, "latitude": 22.5190, "longitude": 88.4250 }
    ]
  }
  ```

### F. Replace / Reorder Intermediate Coordinates
- **Endpoint**: `PUT /api/admin/routes/:id/points`
- **Request Body**:
  ```json
  {
    "points": [
      { "sequence_number": 1, "latitude": 22.5134, "longitude": 88.3995 },
      { "sequence_number": 2, "latitude": 22.5150, "longitude": 88.4100 },
      { "sequence_number": 3, "latitude": 22.5180, "longitude": 88.4230 }
    ]
  }
  ```

### G. Delete Intermediate Point
- **Endpoint**: `DELETE /api/admin/routes/:id/points/:pointId`

---

## 8. Error Handling & Status Codes

All responses follow standardized JSON structures:

| HTTP Code | Description | Typical Cause |
|---|---|---|
| `200 OK` | Request succeeded | Successful GET, PUT, DELETE |
| `201 Created` | Entity created | Successful POST route, stop, point |
| `400 Bad Request` | Invalid input | Coordinate out of bounds, missing required field |
| `401 Unauthorized` | Authentication failed | Missing or invalid Bearer token |
| `404 Not Found` | Entity not found | Route or Stop ID does not exist |
| `409 Conflict` | Unique constraint violation | Route ID already exists, duplicate sequence number |
| `500 Server Error` | Unhandled error | Database connection failure |

**Error Response Example:**
```json
{
  "success": false,
  "error": "Coordinate point #2 latitude must be between -90 and 90 degrees. Received 95.5",
  "message": "Coordinate point #2 latitude must be between -90 and 90 degrees. Received 95.5"
}
```

