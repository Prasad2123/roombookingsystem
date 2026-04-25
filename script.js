// ============================================
// Room Management System - Frontend Script
// Talks to Node.js API at http://localhost:3000
// ============================================

const API = 'http://localhost:3000'; // Backend URL

// ── App State ─────────────────────────────
let allRooms       = [];      // All rooms from DB
let activeFilter   = 'all';   // Current filter key
let checkoutRoomId = null;    // Room pending checkout

// ============================================
// INITIALIZATION
// ============================================

/** Run when page loads */
window.addEventListener('DOMContentLoaded', () => {
    setDefaultTimes();   // Pre-fill datetime inputs
    loadRooms();         // Fetch rooms from API
    loadBookings();      // Fetch booking history
});

/** Set smart defaults for datetime pickers */
function setDefaultTimes() {
    const now   = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    document.getElementById('start-time').value = toLocalISO(now);
    document.getElementById('end-time').value   = toLocalISO(later);
}

/** Convert Date to datetime-local format (YYYY-MM-DDTHH:MM) */
function toLocalISO(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ============================================
// TAB NAVIGATION
// ============================================

/**
 * Switch between tabs: 'rooms', 'book', 'bookings'
 * @param {string} tabName
 */
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
    });

    // Show selected tab
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');

    // Refresh data when switching tabs
    if (tabName === 'rooms')    loadRooms();
    if (tabName === 'bookings') loadBookings();
}

// ============================================
// LOAD & DISPLAY ROOMS
// ============================================

/** Fetch all rooms from API and render */
async function loadRooms() {
    try {
        const res   = await fetch(`${API}/rooms`);
        const rooms = await res.json();

        allRooms = rooms;
        updateHeaderStats(rooms);
        populateRoomDropdown(rooms);
        renderRooms(rooms, activeFilter);

    } catch (err) {
        document.getElementById('rooms-grid').innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <p><strong>Cannot connect to server.</strong></p>
                <p style="margin-top:6px;font-size:12px;">Make sure <code>node server.js</code> is running on port 3000.</p>
            </div>`;
        console.error('Failed to load rooms:', err);
    }
}

/** Update the header stat chips */
function updateHeaderStats(rooms) {
    const available = rooms.filter(r => r.status === 'Available').length;
    const booked    = rooms.filter(r => r.status === 'Booked').length;

    document.getElementById('header-available').textContent = available;
    document.getElementById('header-booked').textContent    = booked;
    document.getElementById('header-total').textContent     = rooms.length;
}

/** Populate the room selector in the booking form */
function populateRoomDropdown(rooms) {
    const select   = document.getElementById('select-room');
    const prevVal  = select.value;

    // Keep only Available rooms as options
    const available = rooms.filter(r => r.status === 'Available');

    select.innerHTML = `<option value="">— Choose an available room —</option>`;
    available.forEach(room => {
        const opt   = document.createElement('option');
        opt.value   = room.id;
        opt.dataset.price = room.price_per_hour;
        opt.textContent = `${room.room_name} (${room.type}) — ₹${room.price_per_hour}/hr`;
        select.appendChild(opt);
    });

    // Restore previous selection if still valid
    if (prevVal) select.value = prevVal;

    // Recalculate price preview
    onRoomOrTimeChange();
}

/**
 * Filter and render room cards
 * @param {Array}  rooms
 * @param {string} filter - 'all' | 'available' | 'booked' | 'ac' | 'nonac'
 */
function renderRooms(rooms, filter) {
    const grid = document.getElementById('rooms-grid');

    // Apply filter
    let filtered = rooms;
    if (filter === 'available') filtered = rooms.filter(r => r.status === 'Available');
    if (filter === 'booked')    filtered = rooms.filter(r => r.status === 'Booked');
    if (filter === 'ac')        filtered = rooms.filter(r => r.type === 'AC');
    if (filter === 'nonac')     filtered = rooms.filter(r => r.type === 'Non-AC');

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="icon">🔍</div>
                <p>No rooms match this filter.</p>
            </div>`;
        return;
    }

    // Build room cards HTML
    grid.innerHTML = filtered.map(room => {
        const isBooked    = room.status === 'Booked';
        const statusClass = isBooked ? 'status-booked'   : 'status-available';
        const statusLabel = isBooked ? 'Booked'           : 'Available';
        const statusEmoji = isBooked ? ''                 : '';
        const badgeClass  = room.type === 'AC' ? 'badge-ac' : 'badge-nonac';
        const badgeEmoji  = room.type === 'AC' ? '❄️'        : '🌬️';
        const cardClass   = isBooked ? 'room-card booked' : 'room-card';

        return `
        <article class="${cardClass}" id="room-${room.id}">
            <div class="room-card-header">
                <div class="room-number">${escHtml(room.room_name)}</div>
                <div class="room-type-badge ${badgeClass}">${badgeEmoji} ${room.type}</div>
            </div>
            <div class="room-price">₹${room.price_per_hour}</div>
            <div class="room-price-label">per hour</div>
            <div class="room-status ${statusClass}">
                <span class="status-dot"></span>
                ${statusLabel}
            </div>
            <div class="room-card-actions">
                <button
                    class="btn btn-primary"
                    ${isBooked ? 'disabled title="Room is already booked"' : ''}
                    onclick="openBookingTab(${room.id})"
                >
                    📝 Book
                </button>
                <button
                    class="btn btn-danger"
                    ${!isBooked ? 'disabled title="Room is not booked"' : ''}
                    onclick="openCheckoutModal(${room.id}, '${escHtml(room.room_name)}')"
                >
                    ✅ Checkout
                </button>
            </div>
        </article>`;
    }).join('');
}

// ============================================
// FILTERS
// ============================================

/**
 * Apply a room filter
 * @param {string} filter
 */
function applyFilter(filter) {
    activeFilter = filter;

    // Update active filter button styling
    ['all', 'available', 'booked', 'ac', 'nonac'].forEach(f => {
        document.getElementById(`filter-${f}`).classList.toggle('active', f === filter);
    });

    renderRooms(allRooms, filter);
}

// ============================================
// PRICE CALCULATOR
// ============================================

/** Called whenever room or time inputs change — updates price preview */
function onRoomOrTimeChange() {
    const select    = document.getElementById('select-room');
    const startVal  = document.getElementById('start-time').value;
    const endVal    = document.getElementById('end-time').value;
    const preview   = document.getElementById('price-preview');
    const amount    = document.getElementById('preview-amount');
    const detail    = document.getElementById('preview-detail');

    // Get selected room's price
    const selectedOption = select.options[select.selectedIndex];
    const pricePerHour   = selectedOption ? parseInt(selectedOption.dataset.price) : 0;

    if (!pricePerHour || !startVal || !endVal) {
        preview.classList.remove('show');
        return;
    }

    const start    = new Date(startVal);
    const end      = new Date(endVal);
    const diffMs   = end - start;
    const hours    = Math.ceil(diffMs / (1000 * 60 * 60));

    if (hours <= 0) {
        preview.classList.remove('show');
        return;
    }

    const total = hours * pricePerHour;

    amount.textContent = `₹${total}`;
    detail.textContent = `${hours} hour${hours > 1 ? 's' : ''} × ₹${pricePerHour}/hr`;
    preview.classList.add('show');
}

// ============================================
// BOOKING FORM — OPEN & SUBMIT
// ============================================

/**
 * Open Book tab and pre-select a room
 * @param {number} roomId
 */
function openBookingTab(roomId) {
    switchTab('book');
    const select = document.getElementById('select-room');
    select.value = roomId;
    onRoomOrTimeChange();

    // Scroll form into view
    document.getElementById('tab-content-book').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Handle booking form submission
 * @param {Event} e
 */
async function submitBooking(e) {
    e.preventDefault();

    const roomId   = document.getElementById('select-room').value;
    const custName = document.getElementById('customer-name').value.trim();
    const startVal = document.getElementById('start-time').value;
    const endVal   = document.getElementById('end-time').value;

    // Client-side validation
    if (!roomId)   return showToast('Please select a room.', 'error');
    if (!custName) return showToast('Please enter the customer name.', 'error');
    if (!startVal) return showToast('Please select a check-in time.', 'error');
    if (!endVal)   return showToast('Please select a check-out time.', 'error');

    const start = new Date(startVal);
    const end   = new Date(endVal);
    if (end <= start) return showToast('Check-out must be after check-in.', 'error');

    // Disable button while submitting
    const btn = document.getElementById('book-btn');
    btn.disabled    = true;
    btn.textContent = '⏳ Booking...';

    try {
        const res  = await fetch(`${API}/book`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                room_id      : roomId,
                customer_name: custName,
                start_time   : startVal.replace('T', ' ') + ':00',
                end_time     : endVal.replace('T', ' ')   + ':00'
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Booking failed.', 'error');
        } else {
            showToast(`✅ ${data.message} Total: ₹${data.total_price}`, 'success');
            resetBookingForm();
            loadRooms();       // Refresh room cards
        }

    } catch (err) {
        showToast('Cannot reach server. Is it running?', 'error');
        console.error(err);
    } finally {
        btn.disabled    = false;
        btn.textContent = '📝 Confirm Booking';
    }
}

/** Reset the booking form to default state */
function resetBookingForm() {
    document.getElementById('customer-name').value = '';
    document.getElementById('select-room').value   = '';
    document.getElementById('price-preview').classList.remove('show');
    setDefaultTimes();
}

// ============================================
// CHECKOUT MODAL
// ============================================

/**
 * Open the checkout confirmation modal
 * @param {number} roomId
 * @param {string} roomName
 */
function openCheckoutModal(roomId, roomName) {
    checkoutRoomId = roomId;
    document.getElementById('modal-body').textContent =
        `Check out "${roomName}" and mark it as Available?`;
    document.getElementById('checkout-modal').classList.add('open');
}

/** Close the checkout modal */
function closeModal() {
    document.getElementById('checkout-modal').classList.remove('open');
    checkoutRoomId = null;
}

// Close modal on overlay click
document.getElementById('checkout-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

/** Perform the checkout API call */
async function confirmCheckout() {
    if (!checkoutRoomId) return;

    const btn = document.getElementById('confirm-checkout-btn');
    btn.disabled    = true;
    btn.textContent = '⏳ Processing...';

    try {
        const res  = await fetch(`${API}/checkout`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ room_id: checkoutRoomId })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Checkout failed.', 'error');
        } else {
            showToast(`✅ ${data.message}`, 'success');
            closeModal();
            loadRooms(); // Refresh room cards
        }

    } catch (err) {
        showToast('Cannot reach server.', 'error');
        console.error(err);
    } finally {
        btn.disabled    = false;
        btn.textContent = '✅ Yes, Check Out';
    }
}

// ============================================
// BOOKING HISTORY TABLE
// ============================================

/** Fetch and render all bookings in the history table */
async function loadBookings() {
    const tbody = document.getElementById('bookings-tbody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="loader"><div class="spinner"></div> Loading...</div></td></tr>`;

    try {
        const res      = await fetch(`${API}/bookings`);
        const bookings = await res.json();

        if (!Array.isArray(bookings) || bookings.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="8">
                    <div class="empty-state">
                        <div class="icon">📋</div>
                        <p>No bookings found yet.</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = bookings.map((b, i) => `
            <tr>
                <td class="td-muted">#${b.id}</td>
                <td><strong>${escHtml(b.room_name)}</strong></td>
                <td>
                    <span style="font-size:12px;color:${b.type === 'AC' ? '#63b3ed' : '#f6ad55'}">
                        ${b.type === 'AC' ? '❄️ AC' : '🌬️ Non-AC'}
                    </span>
                </td>
                <td>${escHtml(b.customer_name)}</td>
                <td class="td-muted">${formatDateTime(b.start_time)}</td>
                <td class="td-muted">${formatDateTime(b.end_time)}</td>
                <td style="color:var(--primary);font-weight:700;">₹${b.total_price}</td>
                <td class="td-muted">${formatDateTime(b.created_at)}</td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <p>Failed to load bookings. Is the server running?</p>
                </div>
            </td></tr>`;
        console.error(err);
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons     = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span>${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;

    container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => toast.remove());
}

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Format a datetime string for display
 * @param {string} dt
 * @returns {string}
 */
function formatDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    if (isNaN(d)) return dt;
    return d.toLocaleString('en-IN', {
        day   : '2-digit',
        month : 'short',
        year  : 'numeric',
        hour  : '2-digit',
        minute: '2-digit',
        hour12: true
    });
}
