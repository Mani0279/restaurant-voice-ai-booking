import React, { useState, useEffect } from 'react';
import { bookingAPI } from '../services/api';
import './BookingList.css';

/**
 * BookingList Component
 * Display all bookings with filter and search capabilities
 */
const BookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, confirmed, cancelled
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch bookings on component mount
  useEffect(() => {
    fetchBookings();
  }, [filter]);

  /**
   * Fetch all bookings from API
   */
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {};
      if (filter !== 'all') {
        filters.status = filter;
      }

      const response = await bookingAPI.getAllBookings(filters);
      
      if (response.success) {
        setBookings(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch bookings');
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel a booking
   */
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const response = await bookingAPI.cancelBooking(bookingId);
      
      if (response.success) {
        alert('Booking cancelled successfully');
        fetchBookings(); // Refresh list
      } else {
        throw new Error(response.message || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert('Failed to cancel booking: ' + err.message);
    }
  };

  /**
   * Filter bookings by search term
   */
  const filteredBookings = bookings.filter(booking => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      booking.customerName.toLowerCase().includes(search) ||
      booking.bookingId.toLowerCase().includes(search) ||
      booking.cuisinePreference.toLowerCase().includes(search)
    );
  });

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * Get status badge class
   */
  const getStatusClass = (status) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'cancelled':
        return 'status-cancelled';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="booking-list-container">
      <header className="booking-list-header">
        <h1>📋 All Bookings</h1>
        <p>Manage and view restaurant reservations</p>
      </header>

      {/* Filters and Search */}
      <div className="booking-controls">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Bookings
          </button>
          <button 
            className={`filter-tab ${filter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setFilter('confirmed')}
          >
            Confirmed
          </button>
          <button 
            className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by name, ID, or cuisine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <button onClick={fetchBookings} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading bookings...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>⚠️ {error}</p>
          <button onClick={fetchBookings} className="btn-retry">
            Try Again
          </button>
        </div>
      )}

      {/* Bookings Grid */}
      {!loading && !error && (
        <>
          <div className="booking-stats">
            <p>
              Showing <strong>{filteredBookings.length}</strong> of <strong>{bookings.length}</strong> bookings
            </p>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="empty-state">
              <h3>No bookings found</h3>
              <p>
                {searchTerm 
                  ? 'Try a different search term' 
                  : 'No bookings match the selected filter'}
              </p>
            </div>
          ) : (
            <div className="bookings-grid">
              {filteredBookings.map((booking) => (
                <div key={booking._id} className="booking-card">
                  <div className="booking-card-header">
                    <h3>{booking.customerName}</h3>
                    <span className={`status-badge ${getStatusClass(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>

                  <div className="booking-card-body">
                    <div className="booking-info">
                      <span className="info-label">📅 Date:</span>
                      <span className="info-value">{formatDate(booking.bookingDate)}</span>
                    </div>

                    <div className="booking-info">
                      <span className="info-label">⏰ Time:</span>
                      <span className="info-value">{booking.bookingTime}</span>
                    </div>

                    <div className="booking-info">
                      <span className="info-label">👥 Guests:</span>
                      <span className="info-value">{booking.numberOfGuests}</span>
                    </div>

                    <div className="booking-info">
                      <span className="info-label">🍽️ Cuisine:</span>
                      <span className="info-value">{booking.cuisinePreference}</span>
                    </div>

                    {booking.seatingPreference !== 'any' && (
                      <div className="booking-info">
                        <span className="info-label">💺 Seating:</span>
                        <span className="info-value">{booking.seatingPreference}</span>
                      </div>
                    )}

                    {booking.specialRequests && (
                      <div className="booking-info special-requests">
                        <span className="info-label">📝 Special:</span>
                        <span className="info-value">{booking.specialRequests}</span>
                      </div>
                    )}

                    {booking.weatherInfo && booking.weatherInfo.condition !== 'unknown' && (
                      <div className="booking-info weather-info">
                        <span className="info-label">🌤️ Weather:</span>
                        <span className="info-value">
                          {booking.weatherInfo.description}, {booking.weatherInfo.temperature}°C
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="booking-card-footer">
                    <small className="booking-id">ID: {booking.bookingId}</small>
                    
                    {booking.status === 'confirmed' && (
                      <button 
                        onClick={() => handleCancelBooking(booking._id)}
                        className="btn-cancel"
                      >
                        ❌ Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookingList;