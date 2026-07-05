-- ============================================================
-- DroneOS Database Initialization
-- PostgreSQL schema for Drone Fleet Management Platform
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Drones table
CREATE TABLE IF NOT EXISTS drones (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'Idle',
    battery INTEGER DEFAULT 100,
    latitude DOUBLE PRECISION DEFAULT 28.6100,
    longitude DOUBLE PRECISION DEFAULT 77.2050,
    speed DOUBLE PRECISION DEFAULT 0.0,
    altitude DOUBLE PRECISION DEFAULT 0.0,
    mission VARCHAR(200),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Missions table
CREATE TABLE IF NOT EXISTS missions (
    id BIGSERIAL PRIMARY KEY,
    drone_id BIGINT NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
    mission_type VARCHAR(100) NOT NULL,
    start_location VARCHAR(255),
    destination VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Planned',
    altitude DOUBLE PRECISION DEFAULT 100.0,
    speed DOUBLE PRECISION DEFAULT 12.0,
    distance DOUBLE PRECISION,
    battery_used INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

-- Drone images (camera feed + YOLO results)
CREATE TABLE IF NOT EXISTS drone_images (
    id BIGSERIAL PRIMARY KEY,
    drone_id BIGINT NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
    image_path TEXT,
    prediction VARCHAR(200),
    confidence FLOAT,
    captured_at TIMESTAMP DEFAULT NOW()
);

-- Flight logs (action history)
CREATE TABLE IF NOT EXISTS flight_logs (
    id BIGSERIAL PRIMARY KEY,
    drone_id BIGINT NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ── Seed Data ─────────────────────────────────────────────────

-- Admin user (password: admin123)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Initial drone fleet
INSERT INTO drones (name, status, battery, latitude, longitude, speed, altitude, mission) VALUES
('Drone-01', 'Flying',    86, 28.6139, 77.2090, 12.4, 110.0, 'Mapping Mission'),
('Drone-02', 'Mission',   62, 28.6200, 77.2150,  8.1,  85.0, 'Crop Monitoring'),
('Drone-03', 'Idle',     100, 28.6100, 77.2050,  0.0,   0.0,  NULL),
('Drone-04', 'Charging',  34, 28.6080, 77.2030,  0.0,   0.0,  NULL),
('Drone-05', 'Returning', 22, 28.6170, 77.2200, 15.0,  60.0,  NULL),
('Drone-06', 'Flying',    74, 28.6220, 77.2080, 10.5,  95.0, 'Delivery')
ON CONFLICT (name) DO NOTHING;

-- Sample missions
INSERT INTO missions (drone_id, mission_type, start_location, destination, status, altitude, speed, distance, start_time) VALUES
(1, 'Mapping',          'Base Alpha',    'Sector 7-G',      'Active',    110, 12.4, 4.2,  NOW() - INTERVAL '18 minutes'),
(2, 'Crop Monitoring',  'Farm HQ',       'Field Block 3',   'Active',     85,  8.1, 2.8,  NOW() - INTERVAL '32 minutes'),
(5, 'Surveillance',     'Command Center','Perimeter East',  'Completed',  60, 15.0, 8.4,  NOW() - INTERVAL '90 minutes'),
(3, 'Delivery',         'Warehouse',     'Customer Site A', 'Completed',  80, 12.0, 12.1, NOW() - INTERVAL '180 minutes')
ON CONFLICT DO NOTHING;

-- Sample flight logs
INSERT INTO flight_logs (drone_id, action, type, timestamp) VALUES
(1, 'Mission started — Mapping Mission',                    'info',     NOW() - INTERVAL '18 minutes'),
(1, 'Takeoff successful — altitude 110m',                   'success',  NOW() - INTERVAL '17 minutes'),
(1, 'Obstacle detected at bearing 120° — rerouting',        'warning',  NOW() - INTERVAL '15 minutes'),
(1, 'Route clear, resuming mission',                        'info',     NOW() - INTERVAL '14 minutes'),
(2, 'Crop scan sector A complete — 847 images captured',    'success',  NOW() - INTERVAL '10 minutes'),
(5, 'Battery < 20% on Drone-05 — RTH initiated',           'critical', NOW() - INTERVAL '8 minutes')
ON CONFLICT DO NOTHING;
