import { useEffect, useRef, useState } from 'react';
import type { Exam } from '../utils/db';

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

  return (
    <div className="verification-screen animate-fade-in">
      <h2>Exam Pre-Requisites & System Check</h2>
      <p className="subtitle">
        Please authorize hardware access and review guidelines before starting <strong>{exam.title}</strong>.
      </p>
      
      <div className="setup-grid">
        <div className="guidelines-card">
          <h3>Anti-Cheating Regulations</h3>
          <ul className="guidelines-list">
            <li><strong>Full Screen Enforced:</strong> The exam will open in full-screen. Exiting triggers warnings.</li>
            <li><strong>Tab/App Tracking:</strong> Moving away, switching tabs, or resizing the browser logs a violation.</li>
            <li><strong>Limit of Warnings:</strong> Exceeding 3 security warnings submits the exam automatically.</li>
            <li><strong>Copy-Paste Disabled:</strong> Clipboard commands, right-clicks, and dragging are completely disabled.</li>
            <li><strong>Continuous Monitoring:</strong> The camera will actively audit your environment.</li>
          </ul>
        </div>

        <div className="hardware-card">
          <h3>Hardware Authorization</h3>
          <div className="camera-preview-container">
            <video ref={videoRef} id="setup-camera-preview" autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
            {camStatus !== 'success' && (
              <div className="camera-placeholder" id="camera-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <p>Camera Off</p>
              </div>
            )}
          </div>
          
          <div className="device-status">
            <div className={`status-indicator ${camStatus === 'success' ? 'status-success' : camStatus === 'error' ? 'status-error' : ''}`}>
              <span className="dot"></span> 
              {camStatus === 'success' ? 'Camera Authorized' : camStatus === 'error' ? 'Camera Access Denied' : 'Camera: Checking...'}
            </div>
          </div>

          {!isReady && (
            <button className="btn btn-secondary btn-full" onClick={checkDevices}>
              Authorize Camera
            </button>
          )}
        </div>
      </div>

      <div className="verification-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleProceed} 
          disabled={!isReady}
        >
          Proceed to Examination
        </button>
      </div>
    </div>
  );
}
