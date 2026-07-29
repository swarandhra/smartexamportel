// security.js - Comprehensive Anti-Cheating & Device Monitoring Engine

let cameraStream = null;
let audioContext = null;
let audioAnalyser = null;
let audioStream = null;
let audioInterval = null;
let cameraInterval = null;

let violationLog = [];
let cameraCaptures = [];
let warningCount = 0;
const MAX_WARNINGS = 3;

let activeConfig = {
  onViolation: () => {}, // callback for when a violation is officially logged
  onWarning: () => {},   // callback for when a warning popup needs to display
  onAutoSubmit: () => {},// callback for when max warnings exceeded (auto-submit)
  videoElement: null,    // HTML video element for camera preview
};

// Start all security listeners and camera/mic streams
export async function startSecuritySystem(config) {
  activeConfig = { ...activeConfig, ...config };
  violationLog = [];
  cameraCaptures = [];
  warningCount = 0;

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
export function stopSecuritySystem() {
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

// Helper to log violation and trigger warning UI
export function logViolation(type, details = '') {
  const timestamp = new Date().toLocaleTimeString();
  
  // Tab switching increments the official warning count
  let warningNum = null;
  if (type === 'Tab Switch' || type === 'Exit Fullscreen' || type === 'Unfocused Window') {
    warningCount++;
    warningNum = warningCount;
  }

  const logEntry = {
    time: timestamp,
    type: type,
    warningNumber: warningNum,
    details: details
  };

  violationLog.push(logEntry);
  activeConfig.onViolation(logEntry);

  if (warningNum !== null) {
    if (warningCount >= MAX_WARNINGS) {
      activeConfig.onAutoSubmit('Security violation limit reached (3 warnings).');
    } else {
      activeConfig.onWarning(type, warningCount);
    }
  }
}

export function getViolationLog() {
  return violationLog;
}

export function getCameraCaptures() {
  return cameraCaptures;
}

export function getWarningCount() {
  return warningCount;
}

// Request and enforce Full Screen mode
export function requestFullscreen() {
  const docEl = document.documentElement;
  if (!document.fullscreenElement) {
    docEl.requestFullscreen().catch(err => {
      console.warn('Failed to enter fullscreen mode:', err);
      logViolation('Fullscreen Blocked', 'Browser blocked programatic fullscreen entry.');
    });
  }
}

// 1. Camera Monitoring & Captures
async function initCameraMonitoring() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 320 }, 
        height: { ideal: 240 },
        facingMode: 'user'
      } 
    });

    if (activeConfig.videoElement) {
      activeConfig.videoElement.srcObject = cameraStream;
      activeConfig.videoElement.play().catch(e => console.log('Video play failed:', e));
    }

    // Monitor if camera stream is turned off manually
    cameraStream.getVideoTracks()[0].addEventListener('ended', () => {
      logViolation('Camera Disabled', 'Camera feed was disconnected or turned off.');
    });

    // Capture photo every 30 seconds
    cameraInterval = setInterval(() => {
      captureSnapshot();
    }, 30000);

    // Take an initial snapshot immediately
    captureSnapshot();

    return true;
  } catch (error) {
    console.error('Camera Access Denied:', error);
    logViolation('Camera Access Denied', error.message);
    return false;
  }
}

// Capture small base64 JPEG from video stream
function captureSnapshot() {
  if (!cameraStream || !activeConfig.videoElement) return;

  const video = activeConfig.videoElement;
  const canvas = document.createElement('canvas');
  
  // Scale snapshot down (160x120) to save LocalStorage space
  canvas.width = 160;
  canvas.height = 120;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg is tiny (~2KB)
      cameraCaptures.push({
        timestamp: new Date().toLocaleTimeString(),
        image: dataUrl
      });
    } catch (e) {
      console.warn('Snapshot capture failed:', e);
    }
  }
}

// 2. Microphone Monitoring
async function initMicrophoneMonitoring() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Audio Context & Analyser
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(audioStream);
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 512;
    source.connect(audioAnalyser);

    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let highNoiseDuration = 0;
    
    // Check voice level every 1 second
    audioInterval = setInterval(() => {
      if (!audioAnalyser) return;
      audioAnalyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;

      // Threshold: 35 is generally background speaking level in a quiet room
      if (averageVolume > 35) {
        highNoiseDuration += 1;
        if (highNoiseDuration >= 3) { // 3 consecutive seconds of talking
          logViolation('Voice Detected', `Microphone registered background activity (Vol: ${averageVolume.toFixed(1)}).`);
          highNoiseDuration = 0; // reset
        }
      } else {
        highNoiseDuration = Math.max(0, highNoiseDuration - 1); // fade out
      }
    }, 1000);

    return true;
  } catch (error) {
    console.error('Microphone Access Denied:', error);
    logViolation('Microphone Access Denied', error.message);
    return false;
  }
}

// 3. Focus & Visibility Listeners
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    logViolation('Tab Switch', 'Student minimized the window or navigated away to another tab.');
  }
}

function handleWindowBlur() {
  logViolation('Unfocused Window', 'Student shifted focus outside the browser (tab change or app change).');
}

function handleWindowResize() {
  logViolation('Screen Resized', 'Browser window dimensions changed.');
}

function handleFullscreenChange() {
  if (!document.fullscreenElement) {
    logViolation('Exit Fullscreen', 'Student exited full screen mode.');
  }
}

function toggleWindowFocusListeners(enable) {
  const action = enable ? 'addEventListener' : 'removeEventListener';
  
  document[action]('visibilitychange', handleVisibilityChange);
  window[action]('blur', handleWindowBlur);
  window[action]('resize', handleWindowResize);
  document[action]('fullscreenchange', handleFullscreenChange);
  document[action]('fullscreenerror', handleFullscreenChange);
}

// 4. Keyboard Shortcuts & Copy/Paste/Right-Click Blockers
function blockShortcuts(e) {
  // Disable F12
  if (e.key === 'F12') {
    e.preventDefault();
    logViolation('Inspect Element Blocked', 'Attempted to open Developer Tools using F12.');
    return false;
  }

  // Escape key - block if they try to exit fullscreen
  if (e.key === 'Escape') {
    e.preventDefault();
    logViolation('Esc Key Intercepted', 'Student attempted to use the Esc key.');
    // Re-request fullscreen
    setTimeout(requestFullscreen, 100);
    return false;
  }

  // Alt combinations
  if (e.altKey) {
    e.preventDefault();
    logViolation('Keyboard Blocked', 'Attempted key combination using Alt key.');
    return false;
  }

  // Ctrl / Cmd shortcuts
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

function preventDefaultEvent(e) {
  e.preventDefault();
  return false;
}

function preventRightClick(e) {
  e.preventDefault();
  logViolation('Right Click Blocked', 'Student attempted to open context menu.');
  return false;
}

function preventDragDrop(e) {
  e.preventDefault();
  logViolation('Drag and Drop Blocked', 'Student attempted to drag or drop content.');
  return false;
}

function toggleEventBlockers(enable) {
  const action = enable ? 'addEventListener' : 'removeEventListener';
  
  window[action]('keydown', blockShortcuts, true);
  window[action]('contextmenu', preventRightClick, true);
  window[action]('copy', preventDefaultEvent, true);
  window[action]('paste', preventDefaultEvent, true);
  window[action]('cut', preventDefaultEvent, true);
  window[action]('selectstart', preventDefaultEvent, true);
  window[action]('dragstart', preventDragDrop, true);
  window[action]('drop', preventDragDrop, true);
}
