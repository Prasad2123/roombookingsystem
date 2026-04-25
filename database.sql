-- ============================================
-- Room Management System - MySQL Schema
-- Run this file first before starting the server
-- ============================================

-- Create and use database
CREATE DATABASE IF NOT EXISTS room_management;
USE room_management;

-- ============================================
-- Table 1: rooms
-- Stores all room information
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    type ENUM('AC', 'Non-AC') NOT NULL,
    price_per_hour INT NOT NULL,
    status ENUM('Available', 'Booked') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table 2: bookings
-- Stores all booking records
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    total_price INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- ============================================
-- Seed Data: Insert sample rooms
-- ============================================
INSERT INTO rooms (room_name, type, price_per_hour, status) VALUES
('Room 101', 'AC',     200, 'Available'),
('Room 102', 'AC',     200, 'Available'),
('Room 103', 'Non-AC', 120, 'Available'),
('Room 104', 'Non-AC', 120, 'Available'),
('Room 201', 'AC',     250, 'Available'),
('Room 202', 'AC',     250, 'Available'),
('Room 203', 'Non-AC', 150, 'Available'),
('Room 204', 'Non-AC', 150, 'Available'),
('Suite A',  'AC',     500, 'Available'),
('Suite B',  'AC',     500, 'Available');

-- ============================================
-- Verify tables created successfully
-- ============================================
SELECT 'Database setup complete!' AS message;
SELECT * FROM rooms;
