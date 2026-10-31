-- AutoPath PostgreSQL Schema Migration: 001_init_schema.sql
-- Kolkata Auto-Rickshaw Transit Discovery Database

-- Drop tables if already exist (in reverse dependency order)
DROP TABLE IF EXISTS route_stops CASCADE;
DROP TABLE IF EXISTS route_points CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS stops CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS search_keywords CASCADE;

-- 1. STOPS TABLE
-- Stores unique auto stands and terminal points
CREATE TABLE stops (
    id VARCHAR(64) PRIMARY KEY,
    stop_name VARCHAR(255) NOT NULL,
    bengali_name VARCHAR(255),
    hindi_name VARCHAR(255),
    full_name VARCHAR(255),
    full_bengali_name VARCHAR(255),
    latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    coords_description VARCHAR(255),
    service_span VARCHAR(100),
    stand_format VARCHAR(100),
    queue_system VARCHAR(100),
    tier VARCHAR(100),
    active_lines_count INTEGER DEFAULT 0,
    has_live_dispatch BOOLEAN DEFAULT FALSE,
    tagline TEXT,
    tagline_bengali TEXT,
    landmarks JSONB DEFAULT '[]'::jsonb,
    is_stand BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROUTES TABLE
-- Stores individual auto routes connecting source and destination stands
CREATE TABLE routes (
    id VARCHAR(64) PRIMARY KEY,
    route_code VARCHAR(50),
    route_code_alt VARCHAR(50),
    route_name VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    bengali_name VARCHAR(255),
    bengali_subtitle VARCHAR(255),
    hindi_name VARCHAR(255),
    source_stop_id VARCHAR(64) NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    destination_stop_id VARCHAR(64) NOT NULL REFERENCES stops(id) ON DELETE RESTRICT,
    fare_range VARCHAR(50) DEFAULT '₹12 - ₹15',
    fare_fixed VARCHAR(50) DEFAULT '₹15 Fixed',
    govt_share_fare VARCHAR(50),
    fare_type VARCHAR(50) DEFAULT 'Per Seat Share',
    distance VARCHAR(50) DEFAULT '~4.0 km',
    distance_km NUMERIC(6, 2) DEFAULT 4.00,
    est_travel VARCHAR(50) DEFAULT '15-20m',
    est_travel_min INTEGER DEFAULT 18,
    queue_freq VARCHAR(50) DEFAULT '2-4 min',
    is_direct BOOLEAN DEFAULT TRUE,
    is_recommended BOOLEAN DEFAULT FALSE,
    route_type VARCHAR(50) DEFAULT 'direct',
    category VARCHAR(100),
    status VARCHAR(100) DEFAULT 'Active Queue Now',
    notes TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROUTE_POINTS TABLE
-- Intermediate road coordinates for exact path polyline rendering
CREATE TABLE route_points (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_route_seq UNIQUE (route_id, sequence_number)
);

-- 4. ROUTE_STOPS TABLE
-- Ordered intermediate boarding and drop-off stops along the route
CREATE TABLE route_stops (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id VARCHAR(64),
    stop_name VARCHAR(255) NOT NULL,
    bengali_name VARCHAR(255),
    hindi_name VARCHAR(255),
    order_index INTEGER NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    distance VARCHAR(50),
    dist_km NUMERIC(6, 2) DEFAULT 0.00,
    badge VARCHAR(100),
    badge_icon VARCHAR(50),
    subtext VARCHAR(255),
    is_stand BOOLEAN DEFAULT FALSE,
    is_transfer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_route_stop_order UNIQUE (route_id, order_index)
);

-- 5. ADMINS TABLE
-- Secure administrative authentication
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SEARCH_KEYWORDS TABLE
-- Autocomplete suggestions
CREATE TABLE search_keywords (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bengali_name VARCHAR(255),
    subtext VARCHAR(255),
    type VARCHAR(50) DEFAULT 'stand',
    category VARCHAR(50) DEFAULT 'hub',
    related_stand_id VARCHAR(64) REFERENCES stops(id) ON DELETE CASCADE,
    keywords TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for High-Performance Queries
CREATE INDEX idx_stops_name ON stops(stop_name);
CREATE INDEX idx_stops_active ON stops(is_active);
CREATE INDEX idx_routes_source ON routes(source_stop_id);
CREATE INDEX idx_routes_destination ON routes(destination_stop_id);
CREATE INDEX idx_routes_active ON routes(is_active);
CREATE INDEX idx_route_points_route_seq ON route_points(route_id, sequence_number ASC);
CREATE INDEX idx_route_stops_route_order ON route_stops(route_id, order_index ASC);
CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email ON admins(email);
