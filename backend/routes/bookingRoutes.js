const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  cancelBooking,
  updateBooking,
  chatBooking
} = require('../controllers/bookingController');

/**
 * Booking Routes
 * Base path: /api/bookings
 */

// POST /api/bookings/chat
// Handle conversational booking with AI
router.post('/chat', chatBooking);

// POST /api/bookings
// Create a new booking
router.post('/', createBooking);

// GET /api/bookings
// Get all bookings (with optional filters: ?status=confirmed&date=2024-12-10)
router.get('/', getAllBookings);

// GET /api/bookings/:id
// Get a specific booking by ID
router.get('/:id', getBookingById);

// PUT /api/bookings/:id
// Update a booking
router.put('/:id', updateBooking);

// DELETE /api/bookings/:id
// Cancel a booking
router.delete('/:id', cancelBooking);

module.exports = router;