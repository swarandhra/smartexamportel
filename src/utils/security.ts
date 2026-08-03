// security.ts - Proctoring and Anti-Cheating Control Engine

import type { Violation, CameraCapture } from './db';

let cameraStream: MediaStream | null = null;
let cameraInterval: any = null;

let violationLog: Violation[] = [];
let cameraCaptures: CameraCapture[] = [];
let warningCount = 0;
const MAX_WARNINGS = 8; // Auto-submit at 8 violations

// Face tracking state
let lastViolationTime: Record<string, number> = {};
const VIOLATION_COOLDOWN_MS = 8000; // debounce violations of the same type

interface SecurityConfig {
  onViolation: (log: Violation) => void;
  onWarning: (type: string, count: number) => void;
  onAutoSubmit: (reason: string) => void;
  videoElement: HTMLVideoElement | null;
}

let activeConfig: SecurityConfig = {
  onViolation: () => {},
  onWarning: () => {},
  onAutoSubmit: () => {},
  videoElement: null
};

// Start all security listeners and camera/mic streams
export async function startSecuritySystem(config: Partial<SecurityConfig>): Promise<{ cameraOk: boolean }> {
  activeConfig = {
    onViolation: config.onViolation || (() => {}),
    onWarning: config.onWarning || (() => {}),
    onAutoSubmit: config.onAutoSubmit || (() => {}),
    videoElement: config.videoElement || null
  };
  
  violationLog = [];
  cameraCaptures = [];
  warningCount = 0;
  lastViolationTime = {};

  // Initialize block listeners
  toggleEventBlockers(true);

  // Initialize browser window tracking
  toggleWindowFocusListeners(true);

  // Start devices
  const cameraOk = await initCameraMonitoring();

  // Try initiating Full Screen mode
  requestFullscreen();

  return { cameraOk };
}

// Stop all security listeners and release device locks
export function stopSecuritySystem(): void {
  toggleEventBlockers(false);
  toggleWindowFocusListeners(false);

  // Stop camera
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (activeConfig.videoElement) {
    activeConfig.videoElement.srcObject = null;
  }
  if (cameraInterval) {
    clearInterval(cameraInterval);
    cameraInterval = null;
  }
}

// Helper to log violation and trigger warning UI - with cooldown debounce
export function logViolation(type: string, details = ''): void {
  const now = Date.now();
  const lastTime = lastViolationTime[type] || 0;

  // Debounce same-type violations except for high-priority ones
  const highPriority = ['Tab Switch', 'Exit Fullscreen', 'Screenshot Attempt'];
  if (!highPriority.includes(type) && (now - lastTime) < VIOLATION_COOLDOWN_MS) {
    return;
  }
  lastViolationTime[type] = now;

  const timestamp = new Date().toLocaleTimeString();
  
  // ONLY Tab Switch, Exit Fullscreen, and Screenshot Attempt count as real violations that auto-submit.
  // Camera events (Multiple Faces, No Face, Phone, Unfocused Window) are LOGGED ONLY
  // for admin review — they never count toward auto-submit.
  const realViolationTypes = ['Tab Switch', 'Exit Fullscreen', 'Screenshot Attempt'];
  let warningNum: number | null = null;
  if (realViolationTypes.includes(type)) {
    warningCount++;
    warningNum = warningCount;
  }

  const logEntry: Violation = {
    time: timestamp,
    type: type,
    warningNumber: warningNum,
    details: details
  };

  violationLog.push(logEntry);
  activeConfig.onViolation(logEntry);

  if (warningNum !== null) {
    if (warningCount >= MAX_WARNINGS) {
      activeConfig.onAutoSubmit(`Security violation limit reached (${MAX_WARNINGS} violations).`);
    } else {
      activeConfig.onWarning(type, warningCount);
    }
  }
}

export function getViolationLog(): Violation[] {
  return violationLog;
}

export function getCameraCaptures(): CameraCapture[] {
  return cameraCaptures;
}

export function getWarningCount(): number {
  return warningCount;
}

// Request and enforce Full Screen mode
export function requestFullscreen(): void {
  const docEl = document.documentElement;
  if (!document.fullscreenElement) {
    docEl.requestFullscreen().catch(err => {
      console.warn('Failed to enter fullscreen mode:', err);
      logViolation('Fullscreen Blocked', 'Browser blocked programatic fullscreen entry.');
    });
  }
}

// 1. Camera Monitoring & Captures + Face Detection
async function initCameraMonitoring(): Promise<boolean> {
  // Try ideal constraints first, fall back to basic if browser doesn't support
  const cameraConstraints: MediaStreamConstraints[] = [
    { video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' } },
    { video: { facingMode: 'user' } },
    { video: true }
  ];

  for (const constraints of cameraConstraints) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      break; // Got a stream, stop trying
    } catch (err) {
      cameraStream = null;
    }
  }

  if (!cameraStream) {
    console.warn('Camera not available on this device.');
    return false;
  }

  try {
    if (activeConfig.videoElement) {
      activeConfig.videoElement.srcObject = cameraStream;
      activeConfig.videoElement.play().catch(e => console.log('Video play failed:', e));
    }

    // Monitor if camera stream is turned off manually
    if (cameraStream.getVideoTracks().length > 0) {
      cameraStream.getVideoTracks()[0].addEventListener('ended', () => {
        logViolation('Camera Disabled', 'Camera feed was disconnected or turned off.');
      });
    }

    // Capture photo every 30 seconds
    cameraInterval = setInterval(() => {
      captureSnapshot();
    }, 30000);

    // Take an initial snapshot immediately
    setTimeout(() => captureSnapshot(), 2000);

    return true;
  } catch (error: any) {
    console.error('Camera setup error:', error);
    return false;
  }
}

// Capture small base64 JPEG from video stream
function captureSnapshot(): void {
  // Disabled to save database storage space as per requirements
  return;
}

// 3. Focus & Visibility Listeners
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    logViolation('Tab Switch', 'Student minimized the window or navigated away to another tab.');
  }
}

function handleWindowBlur(): void {
  // Ignore blur events if active element is an iframe (e.g. clicking inside HTML preview)
  if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
    return;
  }
  // Unfocused window is LOGGED for admin but does NOT count as a violation
  logViolation('Unfocused Window', 'Student shifted focus outside the browser (tab change or app change).');
}

function handleWindowResize(): void {
  // Screen resize is intentionally NOT logged — causes too many false positives
  // especially when entering/exiting fullscreen programmatically
}

function handleFullscreenChange(): void {
  if (!document.fullscreenElement) {
    logViolation('Exit Fullscreen', 'Student exited full screen mode.');
  }
}

// Toggle Listeners
function toggleWindowFocusListeners(enable: boolean): void {
  const action = enable ? 'addEventListener' : 'removeEventListener';
  
  document[action]('visibilitychange', handleVisibilityChange);
  window[action]('blur', handleWindowBlur);
  window[action]('resize', handleWindowResize);
  document[action]('fullscreenchange', handleFullscreenChange);
  document[action]('fullscreenerror', handleFullscreenChange);
}

// 4. Keyboard Shortcuts & Copy/Paste/Right-Click Blockers
function blockShortcuts(e: KeyboardEvent): boolean | void {
  // Screenshot detection — PrintScreen key
  if (e.key === 'PrintScreen') {
    e.preventDefault();
    logViolation('Screenshot Attempt', 'Student pressed PrintScreen to take a screenshot.');
    return false;
  }

  // macOS screenshot shortcuts: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's'].includes(e.key)) {
    e.preventDefault();
    logViolation('Screenshot Attempt', `Student attempted a screenshot shortcut (${e.metaKey ? 'Cmd' : 'Ctrl'}+Shift+${e.key}).`);
    return false;
  }

  if (e.key === 'F12') {
    e.preventDefault();
    logViolation('Inspect Element Blocked', 'Attempted to open Developer Tools using F12.');
    return false;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    logViolation('Esc Key Intercepted', 'Student attempted to use the Esc key.');
    setTimeout(requestFullscreen, 100);
    return false;
  }

  if (e.altKey) {
    e.preventDefault();
    logViolation('Keyboard Blocked', 'Attempted key combination using Alt key.');
    return false;
  }

  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    const blockedKeys = ['c', 'v', 'x', 'a', 'p', 's', 'u', 'i'];
    
    if (blockedKeys.includes(key)) {
      e.preventDefault();
      let label = 'Shortcut Action';
      switch (key) {
        case 'c': label = 'Copy (Ctrl+C)'; break;
        case 'v': label = 'Paste (Ctrl+V)'; break;
        case 'x': label = 'Cut (Ctrl+X)'; break;
        case 'a': label = 'Select All (Ctrl+A)'; break;
        case 'p': label = 'Print (Ctrl+P)'; break;
        case 's': label = 'Save (Ctrl+S)'; break;
        case 'u': label = 'View Source (Ctrl+U)'; break;
        case 'i': label = 'Inspect Elements (Ctrl+Shift+I)'; break;
      }
      logViolation('Keyboard Blocked', `Attempted blocked shortcut: ${label}.`);
      return false;
    }
  }
}

function preventDefaultEvent(e: Event): boolean {
  e.preventDefault();
  return false;
}

// Prevent right click context menu
function preventRightClick(e: MouseEvent): boolean {
  e.preventDefault();
  logViolation('Right Click Blocked', 'Student attempted to open context menu.');
  return false;
}

// Prevent dragging and dropping
function preventDragDrop(e: DragEvent): boolean {
  e.preventDefault();
  logViolation('Drag and Drop Blocked', 'Student attempted to drag or drop content.');
  return false;
}

// Toggle blockers
function toggleEventBlockers(enable: boolean): void {
  const action = enable ? 'addEventListener' : 'removeEventListener';
  
  (window as any)[action]('keydown', blockShortcuts, true);
  (window as any)[action]('contextmenu', preventRightClick, true);
  (window as any)[action]('copy', preventDefaultEvent, true);
  (window as any)[action]('paste', preventDefaultEvent, true);
  (window as any)[action]('cut', preventDefaultEvent, true);
  (window as any)[action]('selectstart', preventDefaultEvent, true);
  (window as any)[action]('dragstart', preventDragDrop, true);
  (window as any)[action]('drop', preventDragDrop, true);
}
