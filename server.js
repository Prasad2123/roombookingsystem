// ============================================
// Room Management System - Backend Server
// Node.js + Express + MySQL
// Run: node server.js
// ============================================

const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const bodyParser = require('body-parser');

const app  = express();
const PORT = 3000;

// ── Middleware ──────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve index.html from same folder

// ============================================
// AUTO-SETUP: Create DB + Tables if missing
// ============================================

// Step 1: Connect WITHOUT specifying a database (so we can create it)
const setupConnection = mysql.createConnection({
    host    : 'localhost',
    user    : 'root',       // Your MySQL username
    password: 'Prasad@21',  // Your MySQL password
});

function autoSetup() {
    return new Promise((resolve, reject) => {
        setupConnection.connect((err) => {
            if (err) {
                reject(err);
                return;
            }

            console.log('✅ Connected to MySQL server.');

            // Step 2: Create database if it doesn't exist
            setupConnection.query('CREATE DATABASE IF NOT EXISTS room_management', (err) => {
                if (err) return reject(err);
                console.log('✅ Database "room_management" ready.');

                // Step 3: Switch to that database
                setupConnection.query('USE room_management', (err) => {
                    if (err) return reject(err);

                    // Step 4: Create rooms table
                    const createRooms = `
                        CREATE TABLE IF NOT EXISTS rooms (
                            id             INT AUTO_INCREMENT PRIMARY KEY,
                            room_name      VARCHAR(100) NOT NULL,
                            type           ENUM('AC','Non-AC') NOT NULL,
                            price_per_hour INT NOT NULL,
                            status         ENUM('Available','Booked') DEFAULT 'Available',
                            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `;
                    setupConnection.query(createRooms, (err) => {
                        if (err) return reject(err);
                        console.log('✅ Table "rooms" ready.');

                        // Step 5: Create bookings table
                        const createBookings = `
                            CREATE TABLE IF NOT EXISTS bookings (
                                id            INT AUTO_INCREMENT PRIMARY KEY,
                                room_id       INT NOT NULL,
                                customer_name VARCHAR(150) NOT NULL,
                                start_time    DATETIME NOT NULL,
                                end_time      DATETIME NOT NULL,
                                total_price   INT NOT NULL,
                                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
                            )
                        `;
                        setupConnection.query(createBookings, (err) => {
                            if (err) return reject(err);
                            console.log('✅ Table "bookings" ready.');

                            // Step 6: Seed sample rooms only if table is empty
                            setupConnection.query('SELECT COUNT(*) AS cnt FROM rooms', (err, rows) => {
                                if (err) return reject(err);

                                if (rows[0].cnt === 0) {
                                    const seedRooms = `
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
                                        ('Suite B',  'AC',     500, 'Available')
                                    `;
                                    setupConnection.query(seedRooms, (err) => {
                                        if (err) return reject(err);
                                        console.log('✅ Sample rooms seeded (10 rooms added).');
                                        setupConnection.end();
                                        resolve();
                                    });
                                } else {
                                    console.log(`✅ Rooms already exist (${rows[0].cnt} rooms found). Skipping seed.`);
                                    setupConnection.end();
                                    resolve();
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

// ── Main Pool (used by all API routes) ─────
const db = mysql.createPool({
    host               : 'localhost',
    user               : 'root',       // Your MySQL username
    password           : 'Prasad@21',  // Your MySQL password
    database           : 'room_management',
    waitForConnections : true,
    connectionLimit    : 10,
    queueLimit         : 0
});

// ── Helper: DB query as Promise ─────────────
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// ============================================
// API Routes
// ============================================

// ── Health check ────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// ── GET /rooms ──────────────────────────────
app.get('/rooms', async (req, res) => {
    try {
        const rooms = await query('SELECT * FROM rooms ORDER BY id ASC');
        res.json(rooms);
    } catch (err) {
        console.error('GET /rooms error:', err.message);
        res.status(500).json({ error: 'Failed to fetch rooms.', details: err.message });
    }
});

// ── GET /bookings ───────────────────────────
app.get('/bookings', async (req, res) => {
    try {
        const sql = `
            SELECT
                b.id,
                b.customer_name,
                b.start_time,
                b.end_time,
                b.total_price,
                b.created_at,
                r.room_name,
                r.type,
                r.price_per_hour
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            ORDER BY b.created_at DESC
        `;
        const bookings = await query(sql);
        res.json(bookings);
    } catch (err) {
        console.error('GET /bookings error:', err.message);
        res.status(500).json({ error: 'Failed to fetch bookings.', details: err.message });
    }
});

// ── POST /book ──────────────────────────────
app.post('/book', async (req, res) => {
    const { room_id, customer_name, start_time, end_time } = req.body;

    if (!room_id || !customer_name || !start_time || !end_time) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        // Check availability
        const rows = await query('SELECT * FROM rooms WHERE id = ?', [room_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Room not found.' });

        const room = rows[0];
        if (room.status === 'Booked') {
            return res.status(409).json({ error: 'Room is already booked. Please choose another room.' });
        }

        // Calculate price
        const start     = new Date(start_time);
        const end       = new Date(end_time);
        const diffHours = Math.ceil((end - start) / (1000 * 60 * 60));
        if (diffHours <= 0) return res.status(400).json({ error: 'End time must be after start time.' });

        const total_price = diffHours * room.price_per_hour;

        // Insert booking
        const result = await query(
            'INSERT INTO bookings (room_id, customer_name, start_time, end_time, total_price) VALUES (?, ?, ?, ?, ?)',
            [room_id, customer_name, start_time, end_time, total_price]
        );

        // Mark room as Booked
        await query("UPDATE rooms SET status = 'Booked' WHERE id = ?", [room_id]);

        res.json({
            success    : true,
            message    : `Room "${room.room_name}" booked for ${customer_name}!`,
            booking_id : result.insertId,
            total_price: total_price,
            hours      : diffHours
        });

    } catch (err) {
        console.error('POST /book error:', err.message);
        res.status(500).json({ error: 'Booking failed.', details: err.message });
    }
});

// ── POST /checkout ──────────────────────────
app.post('/checkout', async (req, res) => {
    const { room_id } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required.' });

    try {
        const rows = await query('SELECT * FROM rooms WHERE id = ?', [room_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Room not found.' });

        await query("UPDATE rooms SET status = 'Available' WHERE id = ?", [room_id]);

        res.json({ success: true, message: `Room "${rows[0].room_name}" is now Available.` });

    } catch (err) {
        console.error('POST /checkout error:', err.message);
        res.status(500).json({ error: 'Checkout failed.', details: err.message });
    }
});

// ============================================
// BOOT: Auto-setup DB then start server
// ============================================
console.log('\n🔧 RoomDesk starting up...');
console.log('   Auto-setting up database...\n');

autoSetup()
    .then(() => {
        console.log('\n🚀 All setup done! Starting web server...');

        const server = app.listen(PORT, () => {
            console.log(`\n====================================`);
            console.log(`  ✅ RoomDesk is READY!`);
            console.log(`  🌐 Open: http://localhost:${PORT}`);
            console.log(`====================================\n`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ Port ${PORT} is already in use!`);
                console.error('   Close the other server window and try again.\n');
                process.exit(1);
            } else {
                throw err;
            }
        });
    })
    .catch((err) => {
        console.error('\n❌ Startup failed!');
        console.error('   Reason:', err.message);
        console.error('\n   CHECKLIST:');
        console.error('   1. Is MySQL / XAMPP running?');
        console.error('   2. Is the password correct in server.js? (currently: Prasad@21)');
        console.error('   3. Is MySQL on localhost port 3306?\n');
        process.exit(1);
    });
