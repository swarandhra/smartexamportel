// notifications.ts - Global custom toast and modal alerts manager

export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('global-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-toast-container';
    container.style.position = 'fixed';
    container.style.top = '24px';
    container.style.right = '24px';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
  toast.style.color = '#ffffff';
  toast.style.padding = '14px 24px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '600';
  toast.style.minWidth = '280px';
  toast.style.maxWidth = '400px';
  toast.style.pointerEvents = 'auto';
  toast.style.cursor = 'pointer';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.animation = 'toast-slide-in 0.3s ease-out forwards';

  // Add simple animation style inline if not present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      @keyframes toast-slide-in {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes modal-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><div style="flex: 1">${message}</div>`;
  container.appendChild(toast);

  // Click to close
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  };
  toast.onclick = removeToast;

  // Auto remove after 5 seconds
  setTimeout(removeToast, 5000);
}

export function showModal(title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', onConfirm?: () => void) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(15, 23, 42, 0.75)';
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999999';
  overlay.style.animation = 'modal-fade-in 0.2s ease-out forwards';

  const modal = document.createElement('div');
  modal.style.background = '#1e293b';
  modal.style.border = '1px solid #334155';
  modal.style.borderRadius = '16px';
  modal.style.padding = '24px';
  modal.style.width = '90%';
  modal.style.maxWidth = '460px';
  modal.style.color = '#f8fafc';
  modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
  modal.style.textAlign = 'center';
  modal.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const titleColor = type === 'error' ? '#f87171' : type === 'warning' ? '#fbbf24' : type === 'success' ? '#4ade80' : '#38bdf8';
  
  modal.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 700; color: ${titleColor}">${title}</h3>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">${message}</p>
    <div style="display: flex; justify-content: center; gap: 12px;">
      <button id="modal-ok-btn" style="background: ${titleColor}; color: #0f172a; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">
        OK
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const okBtn = modal.querySelector('#modal-ok-btn') as HTMLButtonElement;
  okBtn.focus();
  
  const close = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };

  okBtn.onclick = close;
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel'
) {
  // Ensure animations are injected
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      @keyframes toast-slide-in {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes modal-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes modal-scale-in {
        from { transform: scale(0.92); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100vw;height:100vh;
    background:rgba(15,23,42,0.8);backdrop-filter:blur(10px);
    display:flex;align-items:center;justify-content:center;
    z-index:9999999;animation:modal-fade-in 0.2s ease-out;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:#1e293b;border:1px solid #334155;
    border-radius:20px;padding:32px;width:90%;max-width:480px;
    color:#f8fafc;box-shadow:0 25px 60px rgba(0,0,0,0.6);
    text-align:center;font-family:system-ui,-apple-system,sans-serif;
    animation:modal-scale-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
  `;

  modal.innerHTML = `
    <div style="width:52px;height:52px;background:rgba(251,191,36,0.15);border:2px solid #fbbf24;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <h3 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#fbbf24">${title}</h3>
    <p style="margin:0 0 28px;font-size:14.5px;color:#94a3b8;line-height:1.6;white-space:pre-wrap">${message}</p>
    <div style="display:flex;justify-content:center;gap:12px">
      <button id="confirm-cancel-btn" style="background:#334155;color:#cbd5e1;border:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s">${cancelLabel}</button>
      <button id="confirm-ok-btn" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 15px rgba(239,68,68,0.4)">${confirmLabel}</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const okBtn = modal.querySelector('#confirm-ok-btn') as HTMLButtonElement;
  const cancelBtn = modal.querySelector('#confirm-cancel-btn') as HTMLButtonElement;

  const close = () => overlay.remove();

  okBtn.onclick = () => { close(); onConfirm(); };
  cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };

  // Hover effects
  okBtn.onmouseenter = () => okBtn.style.transform = 'translateY(-1px)';
  okBtn.onmouseleave = () => okBtn.style.transform = '';
  cancelBtn.onmouseenter = () => { cancelBtn.style.background = '#475569'; cancelBtn.style.color = '#f8fafc'; };
  cancelBtn.onmouseleave = () => { cancelBtn.style.background = '#334155'; cancelBtn.style.color = '#cbd5e1'; };

  okBtn.focus();
}
