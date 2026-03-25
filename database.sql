
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2. BASE USERS
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture TEXT,
    nid VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refresh_token TEXT
);

-- 3. LOCATIONS (Independent Table)
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    address_name TEXT NOT NULL,
    city VARCHAR(50),
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL
);

-- 4. USER ROLES (Drivers, Customers, Admins, Owners)
CREATE TABLE drivers (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    licence_id VARCHAR(50) UNIQUE NOT NULL,
    license_expire DATE NOT NULL,
    documents_url TEXT,
    rating_avg DECIMAL(3, 2) DEFAULT 5.00,
    active_status BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    current_latitude DECIMAL(9, 6),
    current_longitude DECIMAL(9, 6)
    
);

CREATE TABLE customers (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    customer_rating DECIMAL(3, 2) DEFAULT 5.00
);

CREATE TABLE admins (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    permission TEXT
);

CREATE TABLE owners (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    manager_approved BOOLEAN DEFAULT FALSE
);

-- 5. ASSETS (Vehicles & Addresses)
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    owner_id INT REFERENCES drivers(user_id) ON DELETE CASCADE,
    licence_no VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(50),
    type VARCHAR(20),
    color VARCHAR(20),
    active BOOLEAN DEFAULT TRUE
);


ALTER TABLE drivers ADD COLUMN current_vehicle_id INT REFERENCES vehicles(vehicle_id);

CREATE TABLE saved_addresses (
    customer_id INT REFERENCES customers(user_id) ON DELETE CASCADE,
    location_id INT REFERENCES locations(location_id) ON DELETE CASCADE,
    label VARCHAR(30),
    PRIMARY KEY (customer_id, location_id)
);

-- 6. PROMOTIONS 
CREATE TABLE promotions (
    promo_id SERIAL PRIMARY KEY,
    created_by INT REFERENCES admins(user_id),
    code VARCHAR(20) UNIQUE NOT NULL,
    discount_amount DECIMAL(10, 2),
    expiration_date DATE,
    description TEXT
);

-- 7. RIDES & COURIERS
CREATE TABLE rides (
    ride_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(user_id),
    driver_id INT REFERENCES drivers(user_id),
    pickup_location_id INT REFERENCES locations(location_id),
    dropoff_location_id INT REFERENCES locations(location_id),
    service_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Requested',
    distance_km DECIMAL(5, 2),
    initial_fare DECIMAL(10, 2),
    final_fare DECIMAL(10, 2),
    request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

CREATE TABLE ride_completion_details (
    ride_id INT PRIMARY KEY REFERENCES rides(ride_id) ON DELETE CASCADE,
    ride_otp VARCHAR(6),
    pickup_otp VARCHAR(6),
    completion_otp VARCHAR(6),
    otp_verified_at TIMESTAMP,
    driver_marked_complete_at TIMESTAMP,
    customer_confirmed_at TIMESTAMP,
    completion_mode VARCHAR(40),
    payment_method VARCHAR(20) DEFAULT 'cash',
    payout_processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ride_driver_requests (
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    driver_id INT REFERENCES drivers(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    priority_rank INT,
    distance_km DECIMAL(8, 2),
    rating_snapshot DECIMAL(3, 2),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    PRIMARY KEY (ride_id, driver_id)
);

CREATE UNIQUE INDEX uq_rides_active_customer
    ON rides (customer_id)
    WHERE customer_id IS NOT NULL
      AND LOWER(status) NOT IN ('completed', 'cancelled');

CREATE UNIQUE INDEX uq_rides_active_driver
    ON rides (driver_id)
    WHERE driver_id IS NOT NULL
      AND LOWER(status) NOT IN ('completed', 'cancelled');

CREATE INDEX idx_rides_driver_completed_status
    ON rides (status, ride_id)
    WHERE LOWER(status) = 'driver_completed';

CREATE INDEX idx_ride_completion_driver_marked
    ON ride_completion_details (driver_marked_complete_at, ride_id)
    WHERE driver_marked_complete_at IS NOT NULL;

CREATE INDEX idx_ride_driver_requests_driver_pending
    ON ride_driver_requests (driver_id, status, sent_at DESC)
    WHERE LOWER(status) = 'pending';

CREATE TABLE couriers (
    courier_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES customers(user_id),
    ride_id INT UNIQUE REFERENCES rides(ride_id) ON DELETE CASCADE,
    weight_kg DECIMAL(5, 2),
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Pending',
    receiver_name VARCHAR(50),
    receiver_phone VARCHAR(14)
);

-- 8. PAYMENTS & LOGS
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    promo_id INT REFERENCES promotions(promo_id)
);

CREATE TABLE ratings (
    rating_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    sender_id INT REFERENCES users(user_id),
    receiver_id INT REFERENCES users(user_id),
    score INT CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ride_party_ratings (
    rating_id SERIAL PRIMARY KEY,
    ride_id INT NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
    rater_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rater_role VARCHAR(20) NOT NULL CHECK (LOWER(rater_role) IN ('customer', 'driver')),
    receiver_role VARCHAR(20) NOT NULL CHECK (LOWER(receiver_role) IN ('customer', 'driver')),
    score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ride_party_rater UNIQUE (ride_id, rater_id)
);

CREATE INDEX idx_ride_party_receiver_role
    ON ride_party_ratings (receiver_id, receiver_role);

CREATE TABLE cancellations (
    cancellation_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    cancelled_by INT REFERENCES users(user_id),
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_logs (
    log_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE,
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. COMMUNICATION (Chat)
CREATE TABLE conversations (
    conversation_id SERIAL PRIMARY KEY,
    ride_id INT REFERENCES rides(ride_id) ON DELETE CASCADE
);

CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INT REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id INT REFERENCES users(user_id),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(100),
    content TEXT,
    type VARCHAR(20),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. WALLET SYSTEM
CREATE TABLE wallets (
    wallet_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'BDT',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallet_transactions (
    transaction_id SERIAL PRIMARY KEY,
    wallet_id INT REFERENCES wallets(wallet_id),
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20),
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. HOSPITALS
CREATE TABLE hospitals (
    hospital_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location_id INT REFERENCES locations(location_id),
    beds_available BOOLEAN,
    contact_no VARCHAR(20)
);

-- 12. RESTAURANTS & FOOD
CREATE TABLE restaurants (
    restaurant_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_id INT REFERENCES owners(user_id),
    location_id INT REFERENCES locations(location_id),
    rating DECIMAL(3, 2) DEFAULT 0.00,
    phone VARCHAR(20),
    is_approved BOOLEAN DEFAULT FALSE
);

CREATE TABLE menu_items (
    item_id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    description TEXT
);

CREATE TABLE food_orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(user_id) NOT NULL,
    restaurant_id INT REFERENCES restaurants(restaurant_id) NOT NULL,
    ride_id INT REFERENCES rides(ride_id), -- Linked to Ride (Delivery)
    status VARCHAR(20) DEFAULT 'Placed',
    total_price DECIMAL(10, 2),
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_details (
    detail_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES food_orders(order_id) ON DELETE CASCADE,
    item_id INT REFERENCES menu_items(item_id),
    quantity INT NOT NULL,
    price_at_order DECIMAL(10, 2)
);


-- ==========================================
-- 6. ROLE SYSTEM (FIXED)
-- ==========================================

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT
);

INSERT INTO roles (role_name, role_description) VALUES
  ('Customer', 'Regular app user'),
  ('Driver', 'Driver user'),
  ('Restaurant Manager', 'Manages restaurant'),
  ('Admin', 'Platform admin')
ON CONFLICT (role_name) DO NOTHING;

CREATE TABLE user_role (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);