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

-- Admin user  (password: admin123)
-- Hash generated with BCrypt cost 10: BCryptPasswordEncoder().encode("admin123")
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Pilot user  (password: pilot123)
-- Hash generated with BCrypt cost 10: BCryptPasswordEncoder().encode("pilot123")
INSERT INTO users (username, password_hash, role) VALUES
('pilot', '$2a$10$p0INs4Yl4siRPR2PBdQ.1OeLKxuZ1b.Y1qPJf/7E0n0wHlJh.y0fy', 'USER')
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

-- Sample missions (only insert if drones table exists and missions is empty)
INSERT INTO missions (drone_id, mission_type, start_location, destination, status, altitude, speed, distance, start_time)
SELECT * FROM (VALUES
  (1::BIGINT, 'Mapping',          'Base Alpha',     'Sector 7-G',       'Active',    110::DOUBLE PRECISION, 12.4::DOUBLE PRECISION, 4.2::DOUBLE PRECISION,  NOW() - INTERVAL '18 minutes'),
  (2::BIGINT, 'Crop Monitoring',  'Farm HQ',        'Field Block 3',    'Active',     85::DOUBLE PRECISION,  8.1::DOUBLE PRECISION, 2.8::DOUBLE PRECISION,  NOW() - INTERVAL '32 minutes'),
  (5::BIGINT, 'Surveillance',     'Command Center', 'Perimeter East',   'Completed',  60::DOUBLE PRECISION, 15.0::DOUBLE PRECISION, 8.4::DOUBLE PRECISION,  NOW() - INTERVAL '90 minutes'),
  (3::BIGINT, 'Delivery',         'Warehouse',      'Customer Site A',  'Completed',  80::DOUBLE PRECISION, 12.0::DOUBLE PRECISION, 12.1::DOUBLE PRECISION, NOW() - INTERVAL '180 minutes')
) AS v(drone_id, mission_type, start_location, destination, status, altitude, speed, distance, start_time)
WHERE NOT EXISTS (SELECT 1 FROM missions LIMIT 1);

-- Sample flight logs
INSERT INTO flight_logs (drone_id, action, type, timestamp) VALUES
(1, 'Mission started — Mapping Mission',                    'info',     NOW() - INTERVAL '18 minutes'),
(1, 'Takeoff successful — altitude 110m',                   'success',  NOW() - INTERVAL '17 minutes'),
(1, 'Obstacle detected at bearing 120° — rerouting',        'warning',  NOW() - INTERVAL '15 minutes'),
(1, 'Route clear, resuming mission',                        'info',     NOW() - INTERVAL '14 minutes'),
(2, 'Crop scan sector A complete — 847 images captured',    'success',  NOW() - INTERVAL '10 minutes'),
(5, 'Battery < 20% on Drone-05 — RTH initiated',           'critical', NOW() - INTERVAL '8 minutes')
ON CONFLICT DO NOTHING;
