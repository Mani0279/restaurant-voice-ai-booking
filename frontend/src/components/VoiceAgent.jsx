import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import speechService from '../utils/speechSynthesis';
import { bookingAPI } from '../services/api';
import './VoiceAgent.css';

/**
 * VoiceAgent Component
 * Main voice-enabled booking interface
 */
const VoiceAgent = () => {
  // Speech recognition hook
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

  // Ref for auto-scrolling chat
  const chatEndRef = useRef(null);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Start conversation with greeting
  useEffect(() => {
    startConversation();
  }, []);

  /**
   * Start the conversation with AI greeting
   */
  const startConversation = async () => {
    const greeting = "Hello! Welcome to our restaurant booking service. I'm here to help you reserve a table. How can I assist you today?";
    
    addToHistory('agent', greeting);
    speakText(greeting);
  };

  /**
   * Add message to conversation history
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
      () => setIsSpeaking(false), // onEnd
      (error) => {
        console.error('TTS Error:', error);
        setIsSpeaking(false);
      }
    );
  };

  /**
   * Start listening for user input
   */
  const startListening = () => {
    setError(null);
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: 'en-IN' });
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  /**
   * Send user message to AI and get response
   */
  const sendMessage = async (userMessage) => {
    if (!userMessage || userMessage.trim() === '') return;

    // Add user message to history
    addToHistory('user', userMessage);
    
    setIsProcessing(true);
    setError(null);

    try {
      // Call chat API
      const response = await bookingAPI.chatBooking(userMessage, conversationState);

      if (response.success) {
        const { response: aiResponse, conversationState: newState, isComplete } = response.data;

        // Update conversation state
        setConversationState(newState);

        // Add AI response to history
        addToHistory('agent', aiResponse);

        // Speak AI response
        speakText(aiResponse);

        // Check if booking is complete
        if (isComplete) {
          // Wait a moment, then finalize booking
          setTimeout(() => finalizeBooking(newState), 2000);
        }
      } else {
        throw new Error(response.message || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
      setError(error.message || 'Connection error');
      addToHistory('agent', errorMessage);
      speakText(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Finalize booking by saving to database
   */
  const finalizeBooking = async (bookingData) => {
    try {
      setIsProcessing(true);

      // Prepare booking data for API
      const bookingPayload = {
        customerName: bookingData.customerName,
        numberOfGuests: bookingData.numberOfGuests,
        bookingDate: bookingData.bookingDate || bookingData.date,
        bookingTime: bookingData.bookingTime || bookingData.time,
        cuisinePreference: bookingData.cuisinePreference || bookingData.cuisine || 'Any',
        specialRequests: bookingData.specialRequests || bookingData.specialRequest || '',
        seatingPreference: bookingData.seatingPreference || 'any',
      };

      // Create booking via API
      const response = await bookingAPI.createBooking(bookingPayload);

      if (response.success) {
        setCompletedBooking(response.data);
        setBookingComplete(true);

        const successMessage = `Perfect! Your booking is confirmed with ID ${response.data.bookingId}. We look forward to serving you!`;
        addToHistory('agent', successMessage);
        speakText(successMessage);
      } else {
        throw new Error(response.message || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Booking creation error:', error);
      const errorMessage = 'Sorry, there was an issue creating your booking. Please try again.';
      setError(error.message || 'Booking failed');
      addToHistory('agent', errorMessage);
      speakText(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle manual send button click
   */
  const handleSendClick = () => {
    if (transcript && transcript.trim() !== '') {
      sendMessage(transcript);
      resetTranscript();
    }
  };

  /**
   * Handle Enter key in transcript display
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
    startConversation();
  };

  return (
    <div className="voice-agent-container">
      <header className="voice-agent-header">
        <h1>🎙️ Restaurant Voice Booking</h1>
        <p>Speak naturally to book your table</p>
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

      {/* Booking Confirmation Card */}
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
            {completedBooking.seatingPreference !== 'any' && (
              <p><strong>Seating:</strong> {completedBooking.seatingPreference}</p>
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
        {/* Transcript Display */}
        <div className="transcript-box">
          <p className="transcript-label">
            {listening ? '🎤 Listening...' : '💬 Your message:'}
          </p>
          <textarea
            value={transcript}
            onChange={(e) => {}} // Read-only but allow manual edit if needed
            onKeyPress={handleKeyPress}
            placeholder="Click the microphone to speak..."
            className="transcript-input"
            rows="2"
          />
        </div>

        {/* Control Buttons */}
        <div className="control-buttons">
          {!listening ? (
            <button 
              onClick={startListening} 
              className="btn btn-primary btn-large"
              disabled={isProcessing || isSpeaking}
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
            disabled={!transcript || isProcessing}
          >
            📤 Send
          </button>

          <button 
            onClick={resetConversation}
            className="btn btn-secondary"
          >
            🔄 New Booking
          </button>
        </div>

        {/* Status Indicators */}
        <div className="status-indicators">
          {listening && <span className="status-badge listening">🎤 Listening</span>}
          {isProcessing && <span className="status-badge processing">⚙️ Processing</span>}
          {isSpeaking && <span className="status-badge speaking">🔊 Speaking</span>}
        </div>
      </div>

      {/* Current Booking State (Debug - can remove in production) */}
      {Object.keys(conversationState).length > 0 && (
        <details className="debug-state">
          <summary>📊 Current Booking Info (Debug)</summary>
          <pre>{JSON.stringify(conversationState, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};

export default VoiceAgent;