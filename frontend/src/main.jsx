import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

// Automatically attach current user ID to all outgoing backend requests
axios.interceptors.request.use((config) => {
  const userId = localStorage.getItem('sonar_user_id');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  return config;
}, (error) => Promise.reject(error));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
