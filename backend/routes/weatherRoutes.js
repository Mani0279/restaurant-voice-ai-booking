const express = require('express');
const router = express.Router();
const { getWeatherForecast, getCurrentWeather } = require('../controllers/weatherController');

/**
 * Weather Routes
 * Base path: /api/weather
 */

// GET /api/weather?date=YYYY-MM-DD&location=City
// Get weather forecast for a specific date
router.get('/', getWeatherForecast);

// GET /api/weather/current?location=City
// Get current weather
router.get('/current', getCurrentWeather);

module.exports = router;