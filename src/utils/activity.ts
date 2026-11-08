import { useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
const INTERVAL_MS = 60_000;

function beat(rollNumber: string, inExam: boolean) {
  // Fire-and-forget; failures are silent and never affect the session.
  try {
    fetch(`${API_URL}/api/students/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber, inExam }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

/**
 * Presence ping every 60s while a student is signed in and the tab is visible.
 * Uses its own passive visibilitychange listener; it never calls preventDefault/stopPropagation,
 * so the proctoring handlers are unaffected.
 */
export function useHeartbeat(rollNumber: string | null | undefined, inExam: boolean) {
  useEffect(() => {
    if (!rollNumber) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      beat(rollNumber, inExam);
      timer = setInterval(() => beat(rollNumber, inExam), INTERVAL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility, { passive: true } as AddEventListenerOptions);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [rollNumber, inExam]);
}
