import { useEffect, useRef, useState } from 'react';
import type { Exam } from '../utils/db';
import { Camera, CameraOff, Maximize, Eye, Ban, ClipboardX, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Stepper from './Stepper';
import '../styles/setup.css';

interface VerificationScreenProps {
  exam: Exam;
  onVerifySuccess: () => void;
  onCancel: () => void;
}

export default function VerificationScreen({ exam, onVerifySuccess, onCancel }: VerificationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camStatus, setCamStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const checkDevices = async () => {
    // 1. Camera check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log('Preview play failed:', e));
      }
      
      setLocalStream(stream);
      setCamStatus('success');
    } catch (e) {
      console.error('Camera initialization failed:', e);
      setCamStatus('error');
    }

  };

  useEffect(() => {
    checkDevices();

    // Clean up local media tracks on unmount
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleProceed = () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    onVerifySuccess();
  };

  const isReady = camStatus === 'success';

  const rules = [
    { icon: Maximize, title: 'Full screen enforced', text: 'The exam will open in full-screen. Exiting triggers warnings.' },
    { icon: Eye, title: 'Tab/app tracking', text: 'Moving away, switching tabs, or resizing the browser logs a violation.' },
    { icon: AlertTriangle, title: 'Limit of warnings', text: 'Exceeding 3 security warnings submits the exam automatically.' },
    { icon: ClipboardX, title: 'Copy-paste disabled', text: 'Clipboard commands, right-clicks, and dragging are completely disabled.' },
    { icon: Camera, title: 'Continuous monitoring', text: 'The camera will actively audit your environment.' },
  ];

  return (
    <div className="ui-shell">
      <div className="su-wrap ui-page">
        <Stepper current={1} />
        <div className="su-head">
          <h1>Exam pre-requisites &amp; system check</h1>
          <p>Please authorize hardware access and review guidelines before starting <strong>{exam.title}</strong>.</p>
        </div>

        <div className="su-grid">
          <section className="ui-card su-panel">
            <h2 className="su-panel-title"><Ban size={18} strokeWidth={1.75} /> Anti-cheating regulations</h2>
            <ul className="su-rules">
              {rules.map(r => (
                <li key={r.title}>
                  <span className="su-rule-icon"><r.icon size={18} strokeWidth={1.75} /></span>
                  <span><strong>{r.title}:</strong> {r.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ui-card su-panel">
            <h2 className="su-panel-title"><Camera size={18} strokeWidth={1.75} /> Hardware authorization</h2>
            <div className="su-cam">
              <video ref={videoRef} id="setup-camera-preview" autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
              {camStatus !== 'success' && (
                <div className="su-cam__ph" id="camera-placeholder">
                  <CameraOff size={40} strokeWidth={1.5} />
                  <p>Camera off</p>
                </div>
              )}
            </div>

            <div role="status" aria-live="polite" className={`ui-badge su-status ${camStatus === 'success' ? 'ui-badge--success' : camStatus === 'error' ? 'ui-badge--danger' : 'ui-badge--info'}`}>
              {camStatus === 'success' ? <CheckCircle2 size={16} /> : camStatus === 'error' ? <XCircle size={16} /> : <Loader2 size={16} className="ui-spinner" />}
              {camStatus === 'success' ? 'Camera authorized' : camStatus === 'error' ? 'Camera access denied' : 'Camera: checking…'}
            </div>
            {camStatus === 'error' && (
              <p className="su-fix">Click the camera icon in your browser's address bar, choose “Allow”, then press Authorize camera.</p>
            )}

            {!isReady && (
              <button className="ui-btn ui-btn--secondary" style={{ width: '100%' }} onClick={checkDevices}>
                Authorize camera
              </button>
            )}
          </section>
        </div>

        <div className="su-actions">
          <button className="ui-btn ui-btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="ui-btn ui-btn--primary" onClick={handleProceed} disabled={!isReady}>
            Proceed to examination
          </button>
        </div>
      </div>
    </div>
  );
}
