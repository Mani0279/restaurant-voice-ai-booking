import axios from 'axios';

/**
 * API Service
 * Handles all API calls to backend
 */

// Base URL for API - change this if your backend runs on different port
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Request interceptor (for logging/debugging)
api.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor (for logging/error handling)
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Booking API Calls
 */
export const bookingAPI = {
  /**
   * Create a new booking
   */
  createBooking: async (bookingData) => {
    try {
      const response = await api.post('/bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get all bookings
   */
  getAllBookings: async (filters = {}) => {
    try {
      const response = await api.get('/bookings', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get booking by ID
   */
  getBookingById: async (id) => {
    try {
      const response = await api.get(`/bookings/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update booking
   */
  updateBooking: async (id, updates) => {
    try {
      const response = await api.put(`/bookings/${id}`, updates);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Cancel booking
   */
  cancelBooking: async (id) => {
    try {
      const response = await api.delete(`/bookings/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Chat with AI agent (conversational booking)
   */
  chatBooking: async (message, conversationState = {}) => {
    try {
      const response = await api.post('/bookings/chat', {
        message,
        conversationState,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

/**
 * Weather API Calls
 */
export const weatherAPI = {
  /**
   * Get weather forecast for specific date
   */
  getWeatherForecast: async (date, location = 'Hyderabad') => {
    try {
      const response = await api.get('/weather', {
        params: { date, location },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get current weather
   */
  getCurrentWeather: async (location = 'Hyderabad') => {
    try {
      const response = await api.get('/weather/current', {
        params: { location },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

/**
 * Health check
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export default api;