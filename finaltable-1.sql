
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE
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
    phone VARCHAR(20)
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