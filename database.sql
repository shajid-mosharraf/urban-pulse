-- ==========================================
-- 1. USER MANAGEMENT (Inheritance Structure)
-- ==========================================

-- Base User Table (All users share these fields)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture TEXT,
    nid VARCHAR(50) UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver Role
CREATE TABLE drivers (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    licence_id VARCHAR(50) UNIQUE NOT NULL,
    license_expire DATE NOT NULL,
    rating_avg DECIMAL(3, 2) DEFAULT 5.00,
    active_status BOOLEAN DEFAULT FALSE,
    current_latitude DECIMAL(9, 6),
    current_longitude DECIMAL(9, 6)
    -- current_vehicle_id will be added after creating the vehicles table
);

-- Customer Role
CREATE TABLE customers (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_ride INT DEFAULT 0,
    total_courier INT DEFAULT 0
);

-- Admin Role
CREATE TABLE admins (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_promo INT DEFAULT 0,
    total_drivers INT DEFAULT 0
);

-- ==========================================
-- 2. ASSET MANAGEMENT (Vehicles & Locations)
-- ==========================================

-- Vehicles Table
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    owner_id INT REFERENCES drivers(user_id) ON DELETE CASCADE, -- Ownership
    licence_no VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(50),
    type VARCHAR(20), -- e.g., 'Bike', 'Car', 'CNG'
    color VARCHAR(20),
    active BOOLEAN DEFAULT TRUE
);

-- Now link Driver to their CURRENT vehicle
ALTER TABLE drivers ADD COLUMN current_vehicle_id INT REFERENCES vehicles(vehicle_id);

-- Locations Table (For Pickups, Drop-offs, Saved Addresses)
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    address_name TEXT NOT NULL,
    city VARCHAR(50),
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL
);

-- Saved Addresses (Many-to-Many: Customers <-> Locations)
CREATE TABLE saved_addresses (
    customer_id INT REFERENCES customers(user_id) ON DELETE CASCADE,
    location_id INT REFERENCES locations(location_id) ON DELETE CASCADE,
    type VARCHAR(20), -- e.g., 'Home', 'Work'
    PRIMARY KEY (customer_id, location_id)
);

-- ==========================================
-- 3. RIDE & SERVICE MANAGEMENT
-- ==========================================

-- Rides Table
CREATE TABLE rides (
    ride_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(user_id),
    driver_id INT REFERENCES drivers(user_id),
    pickup_location_id INT REFERENCES locations(location_id),
    dropoff_location_id INT REFERENCES locations(location_id),
    service_type VARCHAR(20), -- e.g., 'Ride', 'Courier'
    status VARCHAR(20) DEFAULT 'Requested', -- Requested, Accepted, Ongoing, Completed, Cancelled
    distance_km DECIMAL(5, 2),
    initial_fare DECIMAL(10, 2),
    final_fare DECIMAL(10, 2),
    request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

-- Courier Specifics (Optional, if you want separate tracking for packages)
CREATE TABLE couriers (
    courier_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES customers(user_id),
    driver_id INT REFERENCES drivers(user_id),
    pickup_location_id INT REFERENCES locations(location_id),
    dropoff_location_id INT REFERENCES locations(location_id),
    weight DECIMAL(5, 2),
    type VARCHAR(50), -- e.g., 'Document', 'Box'
    status VARCHAR(20) DEFAULT 'Pending'
);

-- ==========================================
-- 4. FEEDBACK & OPERATIONS
-- ==========================================

-- Payments
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(20), -- 'Cash', 'Card', 'Bkash'
    status VARCHAR(20) DEFAULT 'Pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ratings
CREATE TABLE ratings (
    ride_id INT PRIMARY KEY REFERENCES rides(ride_id) ON DELETE CASCADE,
    score INT CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cancellations
CREATE TABLE cancellations (
    cancellation_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    cancelled_by INT REFERENCES users(user_id),
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. LOGS & NOTIFICATIONS (Tracking)
-- ==========================================

-- Trip Logs (To track status history: Requested -> Accepted -> etc.)
CREATE TABLE trip_logs (
    log_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    status_update VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(100),
    content TEXT,
    type VARCHAR(20), -- 'Promo', 'Ride Alert', 'System'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promotions
CREATE TABLE promotions (
    promo_id SERIAL PRIMARY KEY,
    created_by INT REFERENCES admins(user_id),
    promo_code VARCHAR(20) UNIQUE NOT NULL,
    discount_amount DECIMAL(10, 2),
    valid_from DATE,
    valid_until DATE,
    active BOOLEAN DEFAULT TRUE
);