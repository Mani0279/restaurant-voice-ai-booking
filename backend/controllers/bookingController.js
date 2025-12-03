const Booking = require('../models/Booking');
const geminiService = require('../services/geminiService');
const weatherService = require('../services/weatherService');

/**
 * Booking Controller
 * Handles all booking-related operations
 */

/**
 * POST /api/bookings
 * Create a new restaurant booking
 */
const createBooking = async (req, res) => {
  try {
    const {
      customerName,
      numberOfGuests,
      bookingDate,
      bookingTime,
      cuisinePreference,
      specialRequests,
      seatingPreference,
      phoneNumber,
      email
    } = req.body;

    // Validate required fields
    if (!customerName || !numberOfGuests || !bookingDate || !bookingTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerName, numberOfGuests, bookingDate, bookingTime'
      });
    }

    // Fetch weather information for the booking date
    let weatherInfo = null;
    try {
      const weather = await weatherService.getWeatherForDate(new Date(bookingDate));
      weatherInfo = {
        condition: weather.condition,
        temperature: weather.temperature,
        description: weather.description,
        icon: weather.icon,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed
      };
    } catch (error) {
      console.warn('Could not fetch weather, continuing without it:', error.message);
    }

    // Create new booking
    const booking = new Booking({
      customerName,
      numberOfGuests,
      bookingDate: new Date(bookingDate),
      bookingTime,
      cuisinePreference: cuisinePreference || 'Any',
      specialRequests: specialRequests || '',
      seatingPreference: seatingPreference || 'any',
      weatherInfo,
      phoneNumber,
      email,
      status: 'confirmed'
    });

    // Save to database
    await booking.save();

    console.log(`✅ Booking created: ${booking.bookingId} for ${customerName}`);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });

  } catch (error) {
    console.error('Create Booking Error:', error.message);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
};

/**
 * GET /api/bookings
 * Get all bookings (with optional filters)
 */
const getAllBookings = async (req, res) => {
  try {
    const { status, date, customerName } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (date) {
      const queryDate = new Date(date);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filter.bookingDate = {
        $gte: queryDate,
        $lt: nextDay
      };
    }
    
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' }; // Case-insensitive search
    }

    // Fetch bookings with filter
    const bookings = await Booking.find(filter)
      .sort({ bookingDate: 1, bookingTime: 1 }) // Sort by date and time
      .lean(); // Convert to plain JavaScript objects

    console.log(`📋 Retrieved ${bookings.length} bookings`);

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });

  } catch (error) {
    console.error('Get Bookings Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

/**
 * GET /api/bookings/:id
 * Get a specific booking by ID or bookingId
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by MongoDB _id or custom bookingId
    const booking = await Booking.findOne({
      $or: [
        { _id: id },
        { bookingId: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log(`📖 Retrieved booking: ${booking.bookingId}`);

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get Booking Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
};

/**
 * DELETE /api/bookings/:id
 * Cancel a booking (soft delete by changing status)
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and update booking status
    const booking = await Booking.findOneAndUpdate(
      {
        $or: [
          { _id: id },
          { bookingId: id }
        ]
      },
      { status: 'cancelled' },
      { new: true } // Return updated document
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log(`❌ Booking cancelled: ${booking.bookingId}`);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });

  } catch (error) {
    console.error('Cancel Booking Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
};

/**
 * PUT /api/bookings/:id
 * Update a booking
 */
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating bookingId or timestamps
    delete updates.bookingId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const booking = await Booking.findOneAndUpdate(
      {
        $or: [
          { _id: id },
          { bookingId: id }
        ]
      },
      updates,
      { 
        new: true,
        runValidators: true // Run schema validation
      }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log(`✏️  Booking updated: ${booking.bookingId}`);

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('Update Booking Error:', error.message);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update booking',
      error: error.message
    });
  }
};

/**
 * POST /api/bookings/chat
 * Handle conversational booking with Gemini AI
 */
const chatBooking = async (req, res) => {
  try {
    const { message, conversationState } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Extract information from user message
    const extractedInfo = await geminiService.extractBookingInfo(message);
    
    // Merge with existing conversation state
    const updatedState = {
      ...conversationState,
      ...extractedInfo
    };

    // If we have a date and no weather info yet, fetch weather
    if (updatedState.bookingDate && !updatedState.weatherInfo) {
      try {
        const weather = await weatherService.getWeatherForDate(
          new Date(updatedState.bookingDate)
        );
        updatedState.weatherInfo = weather;
      } catch (error) {
        console.warn('Could not fetch weather:', error.message);
      }
    }

    // Generate AI response
    const aiResponse = await geminiService.generateResponse(message, updatedState);

    // Determine next step
    const nextStep = geminiService.determineNextStep(updatedState);

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse,
        conversationState: updatedState,
        nextStep: nextStep,
        isComplete: nextStep === 'confirm'
      }
    });

  } catch (error) {
    console.error('Chat Booking Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process chat message',
      error: error.message
    });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  cancelBooking,
  updateBooking,
  chatBooking
};