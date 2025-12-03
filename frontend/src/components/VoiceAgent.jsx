import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import speechService from '../utils/speechSynthesis';
import './VoiceAgent.css';

/**
 * WebSocket-Enhanced Voice Agent Component
 * Real-time voice booking with WebSocket communication
 */
const VoiceAgent = () => {
  // Speech recognition
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // Component state
  const [conversationState, setConversationState] = useState({});
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);

  // Refs
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // FIXED: Use correct WebSocket URL
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000/ws';
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Check browser support
  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="voice-agent-error">
        <h2>Browser Not Supported</h2>
        <p>Your browser doesn't support speech recognition.</p>
        <p>Please use Chrome, Edge, or Safari.</p>
      </div>
    );
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    fetchWeatherInfo();

    return () => {
      disconnectWebSocket();
    };
  }, []);

  /**
   * Get user's current weather
   */
  const fetchWeatherInfo = async () => {
    try {
      // Get user's location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Call weather API
            const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;
            if (!API_KEY) {
              console.warn('Weather API key not configured');
              return;
            }

            const response = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
            );
            
            if (response.ok) {
              const data = await response.json();
              const weather = {
                temperature: Math.round(data.main.temp),
                condition: data.weather[0].main,
                description: data.weather[0].description,
                humidity: data.main.humidity,
                windSpeed: data.wind.speed
              };
              setWeatherInfo(weather);
              console.log('🌤️ Weather fetched:', weather);
            }
          },
          (error) => {
            console.warn('Geolocation error:', error.message);
          }
        );
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    }
  };

  /**
   * Connect to WebSocket server
   */
  const connectWebSocket = () => {
    try {
      console.log('🔌 Connecting to WebSocket:', WS_URL);
      
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setWsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Send initial greeting request
        ws.send(JSON.stringify({
          type: 'greeting',
          weatherInfo: weatherInfo
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('Connection error. Retrying...');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setWsConnected(false);
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setError('Failed to connect to server');
    }
  };

  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = (message) => {
    console.log('📨 Received message:', message);

    switch (message.type) {
      case 'connected':
        // Initial connection confirmation
        console.log('🔗 Connection confirmed:', message.message);
        break;

      case 'greeting':
      case 'response':
        if (message.text) {
          addToHistory('agent', message.text);
          speakText(message.text);
        }
        
        if (message.conversationState) {
          setConversationState(message.conversationState);
        }
        
        setIsProcessing(false);
        break;

      case 'booking_ready':
        // All information collected, ready for confirmation
        if (message.text) {
          addToHistory('agent', message.text);
          speakText(message.text);
        }
        
        if (message.conversationState) {
          setConversationState(message.conversationState);
        }
        
        setIsProcessing(false);
        break;

      case 'booking_confirmed':
        setCompletedBooking(message.booking);
        setBookingComplete(true);
        
        if (message.text) {
          addToHistory('agent', message.text);
          speakText(message.text);
        }
        
        setIsProcessing(false);
        break;

      case 'error':
        const errorMsg = message.message || 'An error occurred';
        setError(errorMsg);
        addToHistory('agent', `Sorry, ${errorMsg}`);
        speakText(`Sorry, ${errorMsg}`);
        setIsProcessing(false);
        break;

      case 'processing':
        setIsProcessing(true);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  };

  /**
   * Check if booking information is complete
   */
  const isBookingInfoComplete = () => {
    return !!(
      conversationState.customerName &&
      conversationState.numberOfGuests &&
      conversationState.bookingDate &&
      conversationState.bookingTime &&
      conversationState.seatingPreference
    );
  };

  /**
   * Check if message is a confirmation
   */
  const isConfirmationMessage = (message) => {
    const confirmPatterns = /^(yes|yeah|yep|yup|sure|ok|okay|confirm|correct|right|that's right|sounds good|perfect|book it|go ahead|proceed)/i;
    return confirmPatterns.test(message.trim());
  };

  /**
   * Send message via WebSocket
   */
  const sendMessage = (userMessage) => {
    if (!userMessage || userMessage.trim() === '') return;
    
    if (!wsConnected || !wsRef.current) {
      setError('Not connected to server. Please wait...');
      return;
    }

    // Add user message to history
    addToHistory('user', userMessage);
    
    setIsProcessing(true);
    setError(null);

    console.log('🔍 Checking message:', userMessage);
    console.log('📊 Current state:', conversationState);
    console.log('✅ Booking complete?', isBookingInfoComplete());
    console.log('✔️ Is confirmation?', isConfirmationMessage(userMessage));

    // Check if this is a confirmation and all info is collected
    if (isConfirmationMessage(userMessage) && isBookingInfoComplete()) {
      console.log('🎉 Finalizing booking...');
      finalizeBooking(conversationState);
    } else {
      // Send via WebSocket for normal conversation
      wsRef.current.send(JSON.stringify({
        type: 'user_message',
        message: userMessage,
        conversationState: conversationState,
        weatherInfo: weatherInfo
      }));
    }
  };

  /**
   * Finalize booking
   */
  const finalizeBooking = (bookingData) => {
    if (!wsConnected || !wsRef.current) {
      setError('Cannot complete booking - not connected');
      return;
    }

    console.log('💾 Sending finalize_booking request:', bookingData);
    setIsProcessing(true);

    // Send booking finalization request
    wsRef.current.send(JSON.stringify({
      type: 'finalize_booking',
      bookingData: {
        ...bookingData,
        weatherInfo: weatherInfo
      }
    }));
  };

  /**
   * Add message to history
   */
  const addToHistory = (sender, message) => {
    setConversationHistory(prev => [
      ...prev,
      {
        sender,
        message,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  /**
   * Speak text using TTS
   */
  const speakText = (text) => {
    setIsSpeaking(true);
    speechService.speak(
      text,
      () => setIsSpeaking(false),
      (error) => {
        console.error('TTS Error:', error);
        setIsSpeaking(false);
      }
    );
  };

  /**
   * Start listening
   */
  const startListening = () => {
    setError(null);
    resetTranscript();
    SpeechRecognition.startListening({ 
      continuous: false, 
      language: 'en-IN' 
    });
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  /**
   * Handle send button
   */
  const handleSendClick = () => {
    if (transcript && transcript.trim() !== '') {
      sendMessage(transcript);
      resetTranscript();
    }
  };

  /**
   * Handle Enter key
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  /**
   * Reset conversation
   */
  const resetConversation = () => {
    setConversationState({});
    setConversationHistory([]);
    setBookingComplete(false);
    setCompletedBooking(null);
    setError(null);
    resetTranscript();
    speechService.cancel();
    
    // Request new greeting
    if (wsConnected && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'greeting',
        weatherInfo: weatherInfo
      }));
    }
  };

  return (
    <div className="voice-agent-container">
      <header className="voice-agent-header">
        <h1>🎙️ Restaurant Voice Booking</h1>
        <p>Speak naturally to book your table</p>
        
        {/* Connection Status */}
        <div className="connection-status">
          {wsConnected ? (
            <span className="status-connected">🟢 Connected</span>
          ) : (
            <span className="status-disconnected">🔴 Disconnected</span>
          )}
        </div>

        {/* Weather Info */}
        {weatherInfo && (
          <div className="weather-badge">
            🌤️ {weatherInfo.temperature}°C, {weatherInfo.description}
          </div>
        )}
      </header>

      {/* Conversation Display */}
      <div className="conversation-display">
        {conversationHistory.map((entry, index) => (
          <div 
            key={index} 
            className={`message ${entry.sender === 'user' ? 'user-message' : 'agent-message'}`}
          >
            <div className="message-sender">
              {entry.sender === 'user' ? '👤 You' : '🤖 RestauBot'}
            </div>
            <div className="message-content">{entry.message}</div>
            <div className="message-time">{entry.timestamp}</div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="message agent-message">
            <div className="message-sender">🤖 RestauBot</div>
            <div className="message-content typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Booking Confirmation */}
      {bookingComplete && completedBooking && (
        <div className="booking-confirmation">
          <h3>✅ Booking Confirmed!</h3>
          <div className="booking-details">
            <p><strong>Booking ID:</strong> {completedBooking.bookingId}</p>
            <p><strong>Name:</strong> {completedBooking.customerName}</p>
            <p><strong>Guests:</strong> {completedBooking.numberOfGuests}</p>
            <p><strong>Date:</strong> {new Date(completedBooking.bookingDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> {completedBooking.bookingTime}</p>
            <p><strong>Cuisine:</strong> {completedBooking.cuisinePreference}</p>
            {completedBooking.seatingPreference && completedBooking.seatingPreference !== 'any' && (
              <p><strong>Seating:</strong> {completedBooking.seatingPreference}</p>
            )}
            {completedBooking.weatherInfo && (
              <p><strong>Weather:</strong> {completedBooking.weatherInfo.temperature}°C, {completedBooking.weatherInfo.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-display">
          ⚠️ {error}
        </div>
      )}

      {/* Voice Controls */}
      <div className="voice-controls">
        <div className="transcript-box">
          <p className="transcript-label">
            {listening ? '🎤 Listening...' : '💬 Your message:'}
          </p>
          <textarea
            value={transcript}
            onChange={(e) => {}}
            onKeyPress={handleKeyPress}
            placeholder="Click the microphone to speak..."
            className="transcript-input"
            rows="2"
          />
        </div>

        <div className="control-buttons">
          {!listening ? (
            <button 
              onClick={startListening} 
              className="btn btn-primary btn-large"
              disabled={isProcessing || isSpeaking || !wsConnected}
            >
              🎤 Start Speaking
            </button>
          ) : (
            <button 
              onClick={stopListening} 
              className="btn btn-danger btn-large"
            >
              ⏹️ Stop Recording
            </button>
          )}

          <button 
            onClick={handleSendClick}
            className="btn btn-success"
            disabled={!transcript || isProcessing || !wsConnected}
          >
            📤 Send
          </button>

          {/* Show Confirm Booking button when all info is collected */}
          {isBookingInfoComplete() && !bookingComplete && (
            <button 
              onClick={() => finalizeBooking(conversationState)}
              className="btn btn-confirm"
              disabled={isProcessing}
            >
              ✅ Confirm Booking
            </button>
          )}

          <button 
            onClick={resetConversation}
            className="btn btn-secondary"
            disabled={isProcessing}
          >
            🔄 New Booking
          </button>
        </div>

        <div className="status-indicators">
          {listening && <span className="status-badge listening">🎤 Listening</span>}
          {isProcessing && <span className="status-badge processing">⚙️ Processing</span>}
          {isSpeaking && <span className="status-badge speaking">🔊 Speaking</span>}
          {wsConnected && <span className="status-badge connected">🌐 Online</span>}
        </div>
      </div>

      {/* Current State Debug */}
      {Object.keys(conversationState).length > 0 && (
        <details className="debug-state">
          <summary>📊 Current Booking Info (Click to expand)</summary>
          <pre>{JSON.stringify(conversationState, null, 2)}</pre>
          <div className="debug-actions">
            <p><strong>Booking Complete:</strong> {isBookingInfoComplete() ? '✅ Yes' : '❌ No'}</p>
            {!isBookingInfoComplete() && (
              <p><strong>Missing:</strong> {
                [
                  !conversationState.customerName && 'Name',
                  !conversationState.numberOfGuests && 'Guests',
                  !conversationState.bookingDate && 'Date',
                  !conversationState.bookingTime && 'Time',
                  !conversationState.seatingPreference && 'Seating'
                ].filter(Boolean).join(', ')
              }</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

export default VoiceAgent;