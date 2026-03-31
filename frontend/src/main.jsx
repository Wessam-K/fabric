import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/print.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);

// Register service worker for PWA (production only)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  } else {
    // In development, unregister any existing service worker to prevent stale caches
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister());
    });
  }
}
