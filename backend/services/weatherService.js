const axios = require('axios');

/**
 * Weather Service using OpenWeatherMap API
 * Fetches weather forecast for booking dates
 */
class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * Get weather forecast for a specific date and location
   * @param {Date} date - The booking date
   * @param {String} location - City name (default from env)
   * @returns {Object} Weather data with recommendation
   */
  async getWeatherForDate(date, location = process.env.DEFAULT_LOCATION) {
    try {
      // OpenWeatherMap free tier provides 5-day forecast
      const url = `${this.baseUrl}/forecast`;
      
      const response = await axios.get(url, {
        params: {
          q: location,
          appid: this.apiKey,
          units: 'metric', // Celsius
          cnt: 40 // 5 days * 8 (3-hour intervals)
        }
      });

      // Find the forecast closest to the booking date
      const targetDate = new Date(date);
      const forecast = this.findClosestForecast(response.data.list, targetDate);

      if (!forecast) {
        // If date is too far in future, use current weather as estimate
        return await this.getCurrentWeather(location);
      }

      // Parse and structure weather data
      const weatherData = {
        condition: forecast.weather[0].main.toLowerCase(), // sunny, rainy, cloudy
        temperature: Math.round(forecast.main.temp),
        description: forecast.weather[0].description,
        icon: forecast.weather[0].icon,
        humidity: forecast.main.humidity,
        windSpeed: forecast.wind.speed,
        date: forecast.dt_txt
      };

      // Add seating recommendation
      weatherData.recommendation = this.generateRecommendation(weatherData);

      return weatherData;

    } catch (error) {
      console.error('Weather API Error:', error.message);
      
      // Return default/fallback weather data
      return {
        condition: 'unknown',
        temperature: 25,
        description: 'Weather data unavailable',
        recommendation: 'Indoor seating recommended as a safe choice.'
      };
    }
  }

  /**
   * Get current weather (fallback for dates beyond forecast range)
   */
  async getCurrentWeather(location) {
    try {
      const url = `${this.baseUrl}/weather`;
      
      const response = await axios.get(url, {
        params: {
          q: location,
          appid: this.apiKey,
          units: 'metric'
        }
      });

      const data = response.data;
      
      const weatherData = {
        condition: data.weather[0].main.toLowerCase(),
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        date: new Date().toISOString()
      };

      weatherData.recommendation = this.generateRecommendation(weatherData);
      
      return weatherData;

    } catch (error) {
      console.error('Current Weather API Error:', error.message);
      throw error;
    }
  }

  /**
   * Find the forecast entry closest to target date
   */
  findClosestForecast(forecastList, targetDate) {
    let closest = null;
    let minDiff = Infinity;

    for (const forecast of forecastList) {
      const forecastDate = new Date(forecast.dt * 1000);
      const diff = Math.abs(forecastDate - targetDate);

      if (diff < minDiff) {
        minDiff = diff;
        closest = forecast;
      }
    }

    return closest;
  }

  /**
   * Generate natural language recommendation based on weather
   * This is the KEY part - real data driving recommendations
   */
  generateRecommendation(weatherData) {
    const { condition, temperature, description } = weatherData;

    // Rain conditions
    if (condition.includes('rain') || condition.includes('drizzle')) {
      return {
        seating: 'indoor',
        message: `It looks like there will be ${description} on your booking date. I'd recommend our cozy indoor seating area where you can enjoy your meal comfortably.`
      };
    }

    // Thunderstorm
    if (condition.includes('thunder') || condition.includes('storm')) {
      return {
        seating: 'indoor',
        message: `There might be thunderstorms on that day. Indoor seating would be much safer and more comfortable.`
      };
    }

    // Clear/Sunny weather
    if (condition.includes('clear') || condition.includes('sun')) {
      if (temperature >= 20 && temperature <= 32) {
        return {
          seating: 'outdoor',
          message: `Perfect weather for outdoor dining! It'll be ${temperature}°C with ${description}. Would you like our outdoor seating with a great view?`
        };
      } else if (temperature > 32) {
        return {
          seating: 'indoor',
          message: `It'll be quite hot at ${temperature}°C. Our air-conditioned indoor area would be more comfortable.`
        };
      } else {
        return {
          seating: 'indoor',
          message: `It might be a bit chilly at ${temperature}°C. Indoor seating would be warmer and cozier.`
        };
      }
    }

    // Cloudy but no rain
    if (condition.includes('cloud')) {
      if (temperature >= 18 && temperature <= 28) {
        return {
          seating: 'outdoor',
          message: `Nice cloudy weather at ${temperature}°C - perfect for outdoor seating! The clouds will keep it comfortable without direct sun.`
        };
      } else {
        return {
          seating: 'indoor',
          message: `It'll be ${description} with temperatures around ${temperature}°C. Indoor seating might be more comfortable.`
        };
      }
    }

    // Snow
    if (condition.includes('snow')) {
      return {
        seating: 'indoor',
        message: `There's snow in the forecast! Definitely recommend our warm indoor seating.`
      };
    }

    // Default fallback
    return {
      seating: 'indoor',
      message: `The weather shows ${description}. Indoor seating would be a safe and comfortable choice.`
    };
  }
}

module.exports = new WeatherService();