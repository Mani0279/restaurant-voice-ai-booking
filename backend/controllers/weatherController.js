const weatherService = require('../services/weatherService');

/**
 * Weather Controller
 * Handles weather-related API requests
 */

/**
 * GET /api/weather
 * Get weather forecast for a specific date and location
 * Query params: date (YYYY-MM-DD), location (optional)
 */
const getWeatherForecast = async (req, res) => {
  try {
    const { date, location } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse and validate date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot get weather for past dates'
      });
    }

    console.log(`🌤️  Fetching weather for ${date} in ${location || 'default location'}...`);

    // Fetch weather data from service
    const weatherData = await weatherService.getWeatherForDate(
      bookingDate,
      location
    );

    // Return weather data with recommendation
    res.status(200).json({
      success: true,
      data: {
        date: date,
        location: location || process.env.DEFAULT_LOCATION,
        weather: weatherData,
        // This is what the AI will use to suggest seating
        suggestion: weatherData.recommendation
      }
    });

  } catch (error) {
    console.error('Weather Controller Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
};

/**
 * GET /api/weather/current
 * Get current weather for location
 */
const getCurrentWeather = async (req, res) => {
  try {
    const { location } = req.query;

    console.log(`🌤️  Fetching current weather for ${location || 'default location'}...`);

    const weatherData = await weatherService.getCurrentWeather(
      location || process.env.DEFAULT_LOCATION
    );

    res.status(200).json({
      success: true,
      data: {
        location: location || process.env.DEFAULT_LOCATION,
        weather: weatherData
      }
    });

  } catch (error) {
    console.error('Current Weather Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current weather',
      error: error.message
    });
  }
};

module.exports = {
  getWeatherForecast,
  getCurrentWeather
};