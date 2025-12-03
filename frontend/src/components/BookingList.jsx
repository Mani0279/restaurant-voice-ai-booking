import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './BookingList.css';

const BookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/bookings`);
      if (response.data.success) {
        setBookings(response.data.data || response.data.bookings || []);
      } else {
        setError('Failed to load bookings');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err.response?.data?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await axios.delete(`${API_URL}/bookings/${bookingId}`);
      if (response.data.success) {
        setBookings(bookings.filter(b => b._id !== bookingId));
        alert('Booking cancelled successfully');
      } else {
        alert('Failed to cancel booking');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (timeString.includes('PM') || timeString.includes('AM')) return timeString;
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) return <div className="container"><h2>📋 Restaurant Bookings</h2><p className="loading">Loading bookings...</p></div>;
  if (error) return <div className="container"><h2>📋 Restaurant Bookings</h2><p className="error">⚠️ {error}</p><button onClick={fetchBookings} className="btn-refresh">🔄 Retry</button></div>;

  return (
    <div className="container">
      <header className="header">
        <h2>📋 Restaurant Bookings</h2>
        <button onClick={fetchBookings} className="btn-refresh">🔄 Refresh</button>
      </header>

      {bookings.length === 0 ? (
        <div className="empty">No bookings found<br /><small>Start by making a voice booking!</small></div>
      ) : (
        <>
          <div className="grid">
            {bookings.map((booking) => (
              <div key={booking._id} className="card">
                <div className="card-header">
                  <h3>{booking.customerName}</h3>
                  <span className="status">CONFIRMED</span>
                </div>

                <div className="card-body">
                  <div className="row"><span>🆔 ID:</span> <span>{booking.bookingId}</span></div>
                  <div className="row"><span>👥 Guests:</span> <span>{booking.numberOfGuests} people</span></div>
                  <div className="row"><span>📅 Date:</span> <span>{formatDate(booking.bookingDate)}</span></div>
                  <div className="row"><span>🕐 Time:</span> <span>{formatTime(booking.bookingTime)}</span></div>
                  
                  {booking.cuisinePreference && booking.cuisinePreference !== 'Any' && (
                    <div className="row"><span>🍽️ Cuisine:</span> <span>{booking.cuisinePreference}</span></div>
                  )}
                  
                  {booking.seatingPreference && booking.seatingPreference !== 'any' && (
                    <div className="row"><span>🪑 Seating:</span> <span>{booking.seatingPreference}</span></div>
                  )}
                  
                  {booking.specialRequests && (
                    <div className="row"><span>✨ Special:</span> <span>{booking.specialRequests}</span></div>
                  )}
                </div>

                <div className="card-footer">
                  <small>Created: {new Date(booking.createdAt).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</small>
                  <button onClick={() => handleDeleteBooking(booking._id)} className="btn-cancel">
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>

          <footer className="footer">
            Total Bookings: {bookings.length}
          </footer>
        </>
      )}
    </div>
  );
};

export default BookingList;