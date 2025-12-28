'use client';

import { useEffect } from 'react';

export default function PWARegistration() {
  useEffect(() => {
    // Only register service worker in production to avoid development caching issues
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  return null;
}
