const mongoose = require('mongoose');

/**
 * Booking Schema for Restaurant Reservations
 * Stores all booking details including weather and seating preferences
 */
const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: () => `BK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  
  numberOfGuests: {
    type: Number,
    required: [true, 'Number of guests is required'],
    min: [1, 'At least 1 guest is required'],
    max: [20, 'Maximum 20 guests allowed']
  },
  
// In your Booking schema
bookingDate: {
  type: Date,
  required: true,
  validate: {
    validator: function(value) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return value >= today; // Allows today and future
    },
    message: 'Booking date cannot be in the past. Please choose today or a future date.'
  }
},
  
  bookingTime: {
    type: String,
    required: [true, 'Booking time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time in HH:MM format']
  },
  
  cuisinePreference: {
    type: String,
    enum: ['Italian', 'Chinese', 'Indian', 'Mexican', 'Japanese', 'Continental', 'Any'],
    default: 'Any'
  },
  
  specialRequests: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Weather information for the booking date
  weatherInfo: {
    condition: String,        // sunny, rainy, cloudy, etc.
    temperature: Number,      // in Celsius
    description: String,      // detailed description
    icon: String,            // weather icon code
    humidity: Number,
    windSpeed: Number
  },
  
  seatingPreference: {
    type: String,
    enum: ['indoor', 'outdoor', 'any'],
    default: 'any'
  },
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  
  // Additional metadata
  phoneNumber: {
    type: String,
    trim: true
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true
  }
  
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt
});

// Index for faster queries
bookingSchema.index({ bookingDate: 1, bookingTime: 1 });
bookingSchema.index({ customerName: 1 });
bookingSchema.index({ status: 1 });

// Method to format booking for display
bookingSchema.methods.formatBooking = function() {
  return {
    id: this.bookingId,
    customer: this.customerName,
    guests: this.numberOfGuests,
    date: this.bookingDate.toLocaleDateString(),
    time: this.bookingTime,
    cuisine: this.cuisinePreference,
    seating: this.seatingPreference,
    status: this.status
  };
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;