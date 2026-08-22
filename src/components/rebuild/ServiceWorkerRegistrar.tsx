'use client';

import { useEffect } from 'react';

/** Registers the offline shell service worker. Production-only so Turbopack
 *  HMR never fights the SW for control of the page during development. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    const register = () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {
        /* offline support is best-effort; never block the app */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
