// backend/websocket.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const geminiService = require('./services/geminiService');
const weatherService = require('./services/weatherService');
const Booking = require('./models/Booking');
const parseNaturalDate = require('./utils/dateParser'); // ← NEW

/**
 * WebSocket Server for Real-time Voice AI Booking
 */
class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    
    this.clients = new Map();
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const clientIp = req.socket.remoteAddress;
      
      console.log(`WebSocket client connected: ${clientId} from ${clientIp}`);
      
      this.clients.set(clientId, {
        ws,
        id: clientId,
        connectedAt: new Date(),
        conversationState: {}
      });

      geminiService.initConversation(clientId);

      this.sendMessage(ws, {
        type: 'connected',
        clientId,
        message: 'Connected to voice booking server'
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Message handling error:', error);
          this.sendError(ws, 'Failed to process message');
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        geminiService.clearConversation(clientId);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });

    console.log('WebSocket server initialized on /ws');
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { ws } = client;

    console.log(`Message from ${clientId}:`, message.type);

    try {
      switch (message.type) {
        case 'greeting':
          await this.handleGreeting(client, message);
          break;

        case 'user_message':
          await this.handleUserMessage(client, message);
          break;

        case 'finalize_booking':
          await this.handleFinalizeBooking(client, message);
          break;

        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling ${message.type}:`, error);
      this.sendError(ws, error.message);
    }
  }

  async handleGreeting(client, message) {
    const { ws, id: clientId } = client;
    
    let greeting = "Hello! Welcome to our restaurant booking service. I'm RestauBot, here to help you reserve a table.";
    
    if (message.weatherInfo) {
      const { temperature, description } = message.weatherInfo;
      greeting += ` I can see it's ${description} with a temperature of ${temperature}°C today.`;
      
      if (temperature < 20) {
        greeting += " Would you prefer a cozy indoor table?";
      } else if (temperature > 25) {
        greeting += " Would you like a nice outdoor table to enjoy the weather?";
      }
    }
    
    greeting += " May I have your name to start the reservation?";

    geminiService.addToHistory(clientId, 'assistant', greeting);

    this.sendMessage(ws, {
      type: 'greeting',
      text: greeting,
      conversationState: {}
    });
  }

  async handleUserMessage(client, message) {
    const { ws, id: clientId } = client;
    const { message: userMessage, conversationState, weatherInfo } = message;

    console.log('Current state:', conversationState);
    console.log('User message:', userMessage);

    this.sendMessage(ws, { type: 'processing' });

    try {
      const extractedInfo = await geminiService.extractBookingInfo(
        userMessage, 
        conversationState || {}
      );
      
      console.log('Newly extracted info:', extractedInfo);

      const updatedState = {
        ...conversationState,
        ...extractedInfo
      };

      console.log('Updated state:', updatedState);

      if (updatedState.bookingDate && !updatedState.weatherInfo) {
        try {
          const weather = await weatherService.getWeatherForDate(
            parseNaturalDate(updatedState.bookingDate) || new Date()
          );
          updatedState.weatherInfo = weather;
        } catch (error) {
          console.warn('Could not fetch weather:', error.message);
        }
      }

      const aiResponse = await geminiService.generateResponse(
        clientId,
        userMessage, 
        updatedState
      );

      console.log('AI Response:', aiResponse);

      const nextStep = geminiService.determineNextStep(updatedState);
      const isComplete = geminiService.isBookingComplete(updatedState);

      console.log('Next step:', nextStep, '| Complete:', isComplete);

      client.conversationState = updatedState;

      if (isComplete) {
        this.sendMessage(ws, {
          type: 'booking_ready',
          text: aiResponse,
          conversationState: updatedState,
          message: 'All information collected! Please confirm your booking.'
        });
      } else {
        this.sendMessage(ws, {
          type: 'response',
          text: aiResponse,
          conversationState: updatedState,
          nextStep: nextStep
        });
      }
    } catch (error) {
      console.error('AI processing error:', error);
      this.sendError(ws, 'Failed to process your message: ' + error.message);
    }
  }

  // ════════════════════════════════════════════════════════════
  // FINALIZE BOOKING — FULLY FIXED VERSION
  // ════════════════════════════════════════════════════════════
  handleFinalizeBooking = async (client, message) => {
    const { ws } = client;
    const { bookingData } = message;

    console.log('Finalizing booking:', bookingData);

    try {
      const rawDate = bookingData.bookingDate || bookingData.date;

      // ← CRITICAL: Parse natural language date properly
      const parsedDate = parseNaturalDate(rawDate);

      if (!parsedDate) {
        throw new Error(`I couldn't understand the date: "${rawDate}". Please try saying "December 5", "tomorrow", etc.`);
      }

      let weatherInfo = bookingData.weatherInfo;
      if (!weatherInfo) {
        try {
          weatherInfo = await weatherService.getWeatherForDate(parsedDate);
        } catch (err) {
          console.warn('Weather fetch failed:', err.message);
        }
      }

      const booking = new Booking({
        customerName: (bookingData.customerName || '').trim(),
        numberOfGuests: Number(bookingData.numberOfGuests) || 1,
        bookingDate: parsedDate, // ← Now 100% valid Date object
        bookingTime: bookingData.bookingTime || bookingData.time || '19:00',
        cuisinePreference: bookingData.cuisinePreference || 'Any',
        specialRequests: bookingData.specialRequests || '',
        seatingPreference: (bookingData.seatingPreference || 'any').toLowerCase(),
        weatherInfo: weatherInfo || null,
        status: 'confirmed'
      });

      await booking.save();

      console.log(`Booking saved! ID: ${booking._id}`);

      const niceDate = parsedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const confirmationMessage = `Your table is confirmed!

Booking ID: ${booking._id}
Name: ${booking.customerName}
Guests: ${booking.numberOfGuests}
Date: ${niceDate}
Time: ${booking.bookingTime}
Cuisine: ${booking.cuisinePreference}
Seating: ${booking.seatingPreference.toUpperCase()}

We can't wait to welcome you!`;

      this.sendMessage(ws, {
        type: 'booking_confirmed',
        text: confirmationMessage,
        booking: booking.toObject()
      });

      // Reset conversation
      client.conversationState = {};
      geminiService.clearConversation(client.id);

    } catch (error) {
      console.error('Booking creation error:', error);
      this.sendError(ws, error.message || 'Failed to save booking. Please try again.');
    }
  }

  sendMessage(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  sendError(ws, message) {
    this.sendMessage(ws, {
      type: 'error',
      message: typeof message === 'string' ? message : message.message || 'Something went wrong'
    });
  }

  broadcast(data) {
    this.clients.forEach(client => {
      this.sendMessage(client.ws, data);
    });
  }
}

module.exports = WebSocketServer;