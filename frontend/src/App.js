import React, { useState } from 'react';
import VoiceAgent from './components/VoiceAgent';
import BookingList from './components/BookingList';
import './App.css';

/**
 * Main App Component
 * Handles navigation between Voice Agent and Booking List
 */
function App() {
  const [currentView, setCurrentView] = useState('voice'); // 'voice' or 'list'

  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className="app-nav">
        <button 
          className={`nav-btn ${currentView === 'voice' ? 'active' : ''}`}
          onClick={() => setCurrentView('voice')}
        >
          🎙️ Voice Booking
        </button>
        <button 
          className={`nav-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => setCurrentView('list')}
        >
          📋 View Bookings
        </button>
      </nav>

      {/* Render current view */}
      <main className="app-main">
        {currentView === 'voice' ? <VoiceAgent /> : <BookingList />}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>🍽️ Restaurant Voice Booking Agent | Built with React + Gemini AI + MongoDB</p>
      </footer>
    </div>
  );
}

export default App;