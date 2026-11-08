// faceMonitor.ts - on-device face / head-turn monitoring for the exam camera.
// Runs entirely in the student's browser at ~2 frames per second (about as light as face detection gets) and only
// LOGS events for the admin's integrity report; it never warns, blocks or auto-submits.
// Every failure path is silent: if the model cannot load, the exam simply runs without it.

export const FACE_MONITOR_ENABLED = true;

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';
const MODEL_URL = '/models/blaze_face_short_range.tflite';

const SAMPLE_MS = 500;           // detection rate
const NO_FACE_AFTER_MS = 4000;   // face missing this long before it is logged
const AWAY_AFTER_MS = 3000;      // head turned this long before it is logged
const MULTI_AFTER_MS = 2500;     // more than one face this long before it is logged
const RELOG_EVERY_MS = 30000;    // while a condition persists, add a new entry this often
const YAW_LIMIT = 0.55;          // |nose offset from eye midpoint| / eye distance beyond which the head counts as turned

type Report = (type: string, details: string) => void;

let timer: ReturnType<typeof setInterval> | null = null;
let detector: any = null;
let starting = false;
let generation = 0;

interface Track { since: number | null; lastLog: number }
const fresh = (): Track => ({ since: null, lastLog: 0 });

export async function startFaceMonitor(video: HTMLVideoElement, report: Report): Promise<void> {
  if (!FACE_MONITOR_ENABLED || timer || starting) return;
  starting = true;
  const gen = ++generation;
  try {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const make = (delegate: 'GPU' | 'CPU') => FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
    try { detector = await make('GPU'); } catch { detector = await make('CPU'); }
    if (gen !== generation) { detector.close?.(); detector = null; return; } // stopped while loading

    const noFace = fresh(), away = fresh(), multi = fresh();

    const flag = (t: Track, now: number, afterMs: number, type: string, detail: string) => {
      if (t.since === null) t.since = now;
      const secs = Math.round((now - t.since) / 1000);
      if (now - t.since >= afterMs && now - t.lastLog >= RELOG_EVERY_MS) {
        t.lastLog = now;
        report(type, `${detail} (~${secs}s)`);
      }
    };
    const clear = (t: Track) => { t.since = null; };

    timer = setInterval(() => {
      try {
        if (!detector || document.visibilityState !== 'visible' || video.readyState < 2 || !video.videoWidth) {
          clear(noFace); clear(away); clear(multi);
          return;
        }
        const now = Date.now();
        const faces = detector.detectForVideo(video, performance.now()).detections || [];

        if (faces.length === 0) {
          clear(away); clear(multi);
          flag(noFace, now, NO_FACE_AFTER_MS, 'Face Not Visible', 'No face detected in the camera');
          return;
        }
        clear(noFace);

        if (faces.length > 1) {
          flag(multi, now, MULTI_AFTER_MS, 'Multiple Faces Detected', `${faces.length} faces in the camera`);
        } else {
          clear(multi);
        }

        const kp = faces[0].keypoints || [];
        // BlazeFace keypoints: 0 right eye, 1 left eye, 2 nose tip, 3 mouth
        if (kp.length >= 3) {
          const eyeDist = Math.abs(kp[1].x - kp[0].x);
          if (eyeDist > 0.01) {
            const yaw = (kp[2].x - (kp[0].x + kp[1].x) / 2) / eyeDist;
            if (Math.abs(yaw) > YAW_LIMIT) {
              flag(away, now, AWAY_AFTER_MS, 'Looking Away', 'Head turned away from the screen');
            } else {
              clear(away);
            }
          }
        }
      } catch { /* a bad frame is ignored */ }
    }, SAMPLE_MS);
  } catch (e) {
    console.warn('Face monitoring unavailable; continuing without it.', e);
  } finally {
    starting = false;
  }
}

export function stopFaceMonitor(): void {
  generation++;
  if (timer) { clearInterval(timer); timer = null; }
  try { detector?.close?.(); } catch { /* ignore */ }
  detector = null;
}
