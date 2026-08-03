// security.ts - Proctoring and Anti-Cheating Control Engine

import type { Violation, CameraCapture } from './db';

let cameraStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioAnalyser: AnalyserNode | null = null;
let audioStream: MediaStream | null = null;
let audioInterval: any = null;
let cameraInterval: any = null;
let faceDetectionInterval: any = null;

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
  onSoundDetected?: (volume: number) => void;
  onFaceViolation?: (type: string) => void;
}

let activeConfig: SecurityConfig = {
  onViolation: () => {},
  onWarning: () => {},
  onAutoSubmit: () => {},
  videoElement: null,
  onSoundDetected: () => {},
  onFaceViolation: () => {}
};

// Start all security listeners and camera/mic streams
export async function startSecuritySystem(config: Partial<SecurityConfig>): Promise<{ cameraOk: boolean; micOk: boolean }> {
  activeConfig = {
    onViolation: config.onViolation || (() => {}),
    onWarning: config.onWarning || (() => {}),
    onAutoSubmit: config.onAutoSubmit || (() => {}),
    videoElement: config.videoElement || null,
    onSoundDetected: config.onSoundDetected || (() => {}),
    onFaceViolation: config.onFaceViolation || (() => {})
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
  const micOk = await initMicrophoneMonitoring();

  // Try initiating Full Screen mode
  requestFullscreen();

  return { cameraOk, micOk };
}

// Stop all security listeners and release device locks
export function stopSecuritySystem(): void {
  toggleEventBlockers(false);
  toggleWindowFocusListeners(false);

  // Stop face detection
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }

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

  // Stop microphone
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (audioInterval) {
    clearInterval(audioInterval);
    audioInterval = null;
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

    // Start face detection after a short delay (allow video to stabilize)
    setTimeout(() => {
      startFaceDetection();
    }, 3000);

    return true;
  } catch (error: any) {
    console.error('Camera setup error:', error);
    return false;
  }
}

// Pixel-based face presence and motion analysis + phone detection heuristic
function startFaceDetection(): void {
  if (!activeConfig.videoElement) return;

  const video = activeConfig.videoElement;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) return;

  let prevPixels: Uint8ClampedArray | null = null;
  let stableFrameCount = 0;
  let noFaceStreak = 0;
  
  // We use brightness histogram to detect face-like skin tone regions
  // and motion delta to detect face movement / complete absence

  faceDetectionInterval = setInterval(() => {
    if (!video || video.readyState < 2) return;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // --- Skin tone pixel counting for face presence detection ---
      let skinPixelCount = 0;
      let brightRegionCount = 0;
      let darkRegionCount = 0;
      let totalPixels = canvas.width * canvas.height;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Skin tone heuristic (covers various ethnicities)
        const isSkinTone = (
          r > 95 && g > 40 && b > 20 &&
          r > g && r > b &&
          Math.abs(r - g) > 15 &&
          r - b > 15 &&
          r < 250
        );

        if (isSkinTone) skinPixelCount++;

        const brightness = (r + g + b) / 3;
        if (brightness > 180) brightRegionCount++;
        if (brightness < 30) darkRegionCount++;
      }

      const skinRatio = skinPixelCount / totalPixels;
      const brightRatio = brightRegionCount / totalPixels;
      const darkRatio = darkRegionCount / totalPixels;

      // --- Face presence check ---
      // If < 1.5% skin pixels, likely no face visible
      const hasFace = skinRatio > 0.015;

      if (!hasFace) {
        noFaceStreak++;
        if (noFaceStreak >= 4) { // 4 consecutive detections (~12s with 3s interval)
          // Log for admin but do NOT call logViolation (would count as a violation)
          const cameraLogEntry: Violation = {
            time: new Date().toLocaleTimeString(),
            type: 'No Face Detected',
            warningNumber: null,
            details: 'The student\'s face is not visible in the camera frame.'
          };
          violationLog.push(cameraLogEntry);
          if (activeConfig.onFaceViolation) activeConfig.onFaceViolation('No Face Detected');
          noFaceStreak = 0;
        }
      } else {
        noFaceStreak = 0;
      }

      // --- Motion / Face movement detection ---
      if (prevPixels) {
        let motionSum = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          motionSum += Math.abs(pixels[i] - prevPixels[i]);
          motionSum += Math.abs(pixels[i + 1] - prevPixels[i + 1]);
          motionSum += Math.abs(pixels[i + 2] - prevPixels[i + 2]);
        }
        const motionScore = motionSum / (totalPixels * 3);

        // Very high motion = excessive movement, not stationary
        if (motionScore > 35 && hasFace) {
          stableFrameCount = 0;
          // Log for admin only — not counted as a violation
          const moveLogEntry: Violation = {
            time: new Date().toLocaleTimeString(),
            type: 'Excessive Face Movement',
            warningNumber: null,
            details: 'Unusual or excessive head movement detected.'
          };
          violationLog.push(moveLogEntry);
          if (activeConfig.onFaceViolation) activeConfig.onFaceViolation('Excessive Face Movement');
        } else {
          stableFrameCount++;
        }
      }

      // --- Multiple faces heuristic ---
      // If skin ratio is abnormally high (>25%), suspect multiple people
      if (hasFace && skinRatio > 0.25) {
        // Disabled real Multiple Faces detection to rely on fake timer-based popup
        // if (activeConfig.onFaceViolation) activeConfig.onFaceViolation('Multiple Faces Detected');
      }

      // --- Phone detection heuristic ---
      // Phones in front of face tend to create large dark rectangular blocks
      // combined with sudden reflection bright spots
      if (hasFace && darkRatio > 0.2 && brightRatio > 0.15 && skinRatio < 0.08) {
        // Removed logViolation for Phone Detected to treat it as a warning
        if (activeConfig.onFaceViolation) activeConfig.onFaceViolation('Phone Detected');
      }

      prevPixels = new Uint8ClampedArray(pixels);
    } catch (e) {
      // Canvas tainted or video not ready
      console.warn('Face detection frame error:', e);
    }
  }, 3000); // Run every 3 seconds
}

// Capture small base64 JPEG from video stream
function captureSnapshot(): void {
  // Disabled to save database storage space as per requirements
  return;
}

// 2. Microphone Monitoring
async function initMicrophoneMonitoring(): Promise<boolean> {
  const micConstraints: MediaStreamConstraints[] = [
    { audio: { echoCancellation: true, noiseSuppression: false } },
    { audio: true }
  ];

  for (const constraints of micConstraints) {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (err) {
      audioStream = null;
    }
  }

  if (!audioStream) {
    console.warn('Microphone not available on this device.');
    return false;
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(audioStream);
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 512;
    source.connect(audioAnalyser);

    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let highNoiseDuration = 0;
    
    audioInterval = setInterval(() => {
      if (!audioAnalyser) return;
      audioAnalyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;

      if (averageVolume > 35) {
        highNoiseDuration += 1;
        if (highNoiseDuration >= 2) {
          if (activeConfig.onSoundDetected) {
            activeConfig.onSoundDetected(averageVolume);
          }
          highNoiseDuration = 0;
        }
      } else {
        highNoiseDuration = Math.max(0, highNoiseDuration - 1);
      }
    }, 1000);

    return true;
  } catch (error: any) {
    console.error('Microphone setup error:', error);
    return false;
  }
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
