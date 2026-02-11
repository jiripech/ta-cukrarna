'use client';

import { useEffect } from 'react';

export default function ShakeToShowFooter(): null {
  useEffect(() => {
    const footer = document.querySelector(
      '.version-footer'
    ) as HTMLElement | null;
    if (!footer) return;

    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastTime = 0;
    let shakeTimeout: number | null = null;

    const THRESHOLD = 14; // sensitivity — increase to require stronger shakes
    const MIN_INTERVAL = 700; // ms between accepted shakes
    const SHOW_DURATION = 7000; // ms to keep the footer visible

    function showFooter() {
      footer.classList.add('visible');
      if (shakeTimeout) window.clearTimeout(shakeTimeout);
      shakeTimeout = window.setTimeout(() => {
        footer.classList.remove('visible');
      }, SHOW_DURATION);
    }

    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc) return;
      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const delta =
        Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
      const now = Date.now();
      if (delta > THRESHOLD && now - lastTime > MIN_INTERVAL) {
        lastTime = now;
        showFooter();
      }
      lastX = x;
      lastY = y;
      lastZ = z;
    }

    // Request permission on iOS Safari when needed — must be done from a user gesture
    let permissionRequested = false;
    const DM = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    async function requestPermissionAndListen() {
      try {
        if (typeof DM.requestPermission === 'function') {
          const res = await DM.requestPermission();
          if (res === 'granted') {
            window.addEventListener('devicemotion', handleMotion, {
              passive: true,
            });
          }
        } else {
          window.addEventListener('devicemotion', handleMotion, {
            passive: true,
          });
        }
      } catch {
        // ignore
      }
    }

    let onTouch: (() => void) | null = null;
    if (typeof DM.requestPermission === 'function') {
      onTouch = async () => {
        if (!permissionRequested) {
          permissionRequested = true;
          await requestPermissionAndListen();
        }
        if (onTouch) window.removeEventListener('touchstart', onTouch);
      };
      window.addEventListener('touchstart', onTouch, { passive: true });
    } else {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (onTouch) window.removeEventListener('touchstart', onTouch);
      if (shakeTimeout) window.clearTimeout(shakeTimeout);
    };
  }, []);

  return null;
}
