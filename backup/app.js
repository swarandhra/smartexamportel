// app.js - SPA Orchestrator and Route Manager

import { renderAuthScreen } from './auth.js';
import { initStudentView } from './student.js';
import { initAdminView } from './admin.js';
import { syncOfflineResults } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');
  if (!root) return;

  // Initialize Route Check
  route(root);

  // Sync results when the browser goes online
  window.addEventListener('online', () => {
    console.log('Network connection restored. Syncing offline results...');
    syncOfflineResults();
  });

  // Run initial sync on load in case there are pending uploads
  if (navigator.onLine) {
    syncOfflineResults();
  }
});

function route(root) {
  const activeRole = localStorage.getItem('active_role');
  const activeStudentRaw = localStorage.getItem('active_student');

  if (activeRole === 'admin') {
    // Admin user logged in
    initAdminView(root);
  } else if (activeStudentRaw) {
    // Student user logged in
    try {
      const studentSession = JSON.parse(activeStudentRaw);
      initStudentView(root, studentSession);
    } catch (e) {
      console.error('Failed to parse student session:', e);
      localStorage.removeItem('active_student');
      showLogin(root);
    }
  } else {
    // Show authentication
    showLogin(root);
  }
}

function showLogin(root) {
  renderAuthScreen(root, (role, session) => {
    // Route successful callback
    route(root);
  });
}
