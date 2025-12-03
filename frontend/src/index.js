import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import 'regenerator-runtime/runtime'; // Required for react-speech-recognition

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);