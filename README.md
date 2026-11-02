# AutoPath (কলকাতা অটো রুট) — Backend REST API Server

AutoPath is a production-ready, scalable backend service developed for discovering auto-rickshaw routes, stands, union-regulated fares, and intermediate drop-off points across Kolkata, West Bengal, India.

> [!IMPORTANT]
> **STRICT ARCHITECTURE PRINCIPLES**
> 1. **Zero Route Estimation / Geometric Distortion**: The backend stores and serves the exact geographical coordinates provided manually by the administrator. It **never** calls third-party routing services (OSRM, Google Directions) to alter or calculate paths.
> 2. **Sequence Preservation**: Intermediate points are saved and retrieved strictly in their defined ascending sequence order (`ORDER BY sequence_number ASC`).
> 3. **Transactional Safety**: Routes and intermediate coordinates are created and updated together using database transactions (`BEGIN` ... `COMMIT` / `ROLLBACK`).
> 4. **Dual Frontend Compatibility**: Both `/api/stands` and `/api/stops` are mounted, delivering both Leaflet `[lat, lng]` and GeoJSON `[lng, lat]` representations.

---

## 1. Technology Stack

- **Runtime**: Node.js (v18+ / v24 tested)
- **Framework**: Express.js (v4.21 with ES Modules)
- **Database**: PostgreSQL (with connection pooling via `pg`)
- **Testing Engine**: Built-in `node:test` with in-memory PostgreSQL (`pg-mem`)
- **API Documentation**: OpenAPI 3.0 & Swagger UI (`swagger-ui-express`)
- **Authentication**: JWT (`jsonwebtoken`)
- **Security**: Bcrypt password hashing (`bcryptjs`), Helmet security headers, CORS origin protection

---

## 2. Project Directory Structure

```
AutoPath_Backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL pool & in-memory fallback
│   │   └── environment.js       # Validated environment configuration
│   ├── controllers/
│   │   ├── stopController.js    # Auto stand query endpoints
│   │   ├── routeController.js   # Route search & geometry endpoints
│   │   ├── locationController.js# Autocomplete search
│   │   └── adminController.js   # Route & coordinate management
│   ├── routes/
│   │   ├── stopRoutes.js        # /api/stops & /api/stands
│   │   ├── routeRoutes.js       # /api/routes
│   │   ├── locationRoutes.js    # /api/locations
│   │   └── adminRoutes.js       # /api/admin
│   ├── services/
│   │   ├── stopService.js       # Stop data access
│   │   ├── routeService.js      # Route & geometry serialization
│   │   ├── locationService.js   # Fuzzy location search
│   │   └── adminService.js      # Transactional route creation & edits
│   ├── middleware/
│   │   ├── authMiddleware.js    # Admin JWT verification
│   │   ├── errorMiddleware.js   # Centralized error & 404 handler
│   │   └── requestLogger.js     # Morgan HTTP logging
│   ├── validators/
│   │   ├── routeValidator.js    # Coordinate & sequence validation
│   │   ├── stopValidator.js     # Stop schema validation
│   │   └── adminValidator.js    # Auth credential validation
│   ├── docs/
│   │   └── swagger.js           # Swagger UI OpenAPI 3.0 specification
│   ├── app.js                   # Express application setup
│   └── server.js                # Server entry point & graceful shutdown
│
├── database/
│   ├── migrations/
│   │   └── 001_init_schema.sql  # Schema migration (DDL, constraints, indexes)
│   ├── seeds/
│   │   ├── kolkataData.js       # Real Kolkata auto routes and stands
│   │   └── seed_data.js         # Seeder data exporter
│   ├── migrate.js               # Migration CLI runner
│   └── seed.js                  # Database seeder CLI runner
│
├── docs/
│   ├── API_DOCUMENTATION.md     # Complete REST API reference
│   └── AutoPath_Postman_Collection.json # Importable Postman collection
│
├── tests/
│   ├── setup.js                 # Test database bootstrap
│   ├── stops.test.js            # Stops service tests
│   ├── routes.test.js           # Routes & search tests
│   ├── geometry.test.js         # Strict geometry sequence tests
│   ├── admin.test.js            # Transactional & auth tests
│   └── api.test.js              # End-to-end HTTP REST API tests
│
├── .env.example                 # Sample configuration
├── package.json
└── README.md
```

---

## 3. Getting Started & Installation

### A. Prerequisites
- **Node.js**: v18.0.0 or higher (v24 recommended)
- **PostgreSQL**: v13.0 or higher (optional for testing, required for production persistence)

### B. Installation
Navigate into the backend directory and install dependencies:
```bash
cd AutoPath_Backend
npm install
```

### C. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration settings in `.env`:
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autopath

JWT_SECRET=autopath_super_secret_jwt_key_2026_kolkata_routes
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=Admin@AutoPath2026
```

### D. Run Database Migrations & Seeds
To set up tables and populate default Kolkata auto stands and routes:
```bash
# 1. Run migrations (creates stops, routes, route_points, route_stops, admins)
npm run migrate

# 2. Seed database with real Kolkata corridors & default admin
npm run seed
```

### E. Start Development Server
```bash
# Watch mode (automatically restarts on file changes)
npm run dev

# Or production start
npm start
```

Server endpoints will be active:
- **API Base**: `http://localhost:5000/api`
- **Swagger Documentation**: `http://localhost:5000/api/docs`
- **Health Check**: `http://localhost:5000/api/health`

---

## 4. Running Automated Tests

AutoPath includes an exhaustive test suite covering all 15 operational requirements in the project specification.

To execute all tests:
```bash
npm test
```
The test suite utilizes in-memory PostgreSQL isolation (`pg-mem`) so tests run with 100% database fidelity and sub-second execution without requiring an active external PostgreSQL daemon.

---

## 5. Connecting the AutoPath Frontend

The AutoPath frontend is already developed and located in `AutoPath_Frontend/`.
To connect the frontend to the live backend:

1. Open `AutoPath_Frontend/.env`.
2. Ensure the backend URL points to port 5000:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
3. Switch mock data off:
   ```env
   VITE_USE_MOCK_DATA=false
   ```
4. Start the frontend:
   ```bash
   cd AutoPath_Frontend
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser. All markers, corridors, fares, and polylines will now load live from the PostgreSQL backend!

---

## 6. Route Data Entry & Management (No Code Required)

Administrators can add, update, reorder, or delete routes using the secure Administrative API or via the provided Postman collection.

### Step 1: Log In to Obtain JWT Token
```bash
curl -X POST http://localhost:5000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@AutoPath2026"}'
```
Response includes `"token": "<your_jwt_token>"`.

### Step 2: Add a New Auto Route with Intermediate Points
```bash
curl -X POST http://localhost:5000/api/admin/routes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
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
  }'
```

### Step 3: Reorder or Replace Route Points
```bash
curl -X PUT http://localhost:5000/api/admin/routes/ruby-chowbaga/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "points": [
      { "sequence_number": 1, "latitude": 22.5134, "longitude": 88.3995 },
      { "sequence_number": 2, "latitude": 22.5150, "longitude": 88.4100 },
      { "sequence_number": 3, "latitude": 22.5180, "longitude": 88.4230 }
    ]
  }'
```

---

## 7. Postman Collection

Import `docs/AutoPath_Postman_Collection.json` into Postman:
- Pre-configured requests for all public and administrative endpoints.
- Auto-extracts and stores the admin JWT token upon running "Admin Login".
- Contains sample requests for route creation, coordinate reordering, and geometry fetching.

---

## 8. License

ISC License. AutoPath Transit Project.

