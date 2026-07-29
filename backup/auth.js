// auth.js - User Authentication Gateway

import { getSettings } from './db.js';

export function renderAuthScreen(container, onLoginSuccess) {
  // Clear any existing contents
  container.innerHTML = '';

  const authWrapper = document.createElement('div');
  authWrapper.className = 'auth-wrapper animate-fade-in';
  authWrapper.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h1>Smart Exam Portal</h1>
        <p>Secure Online Assessment Environment</p>
      </div>

      <!-- Tab Switchers -->
      <div class="auth-tabs">
        <button class="auth-tab-btn active" id="btn-student-tab">Student Access</button>
        <button class="auth-tab-btn" id="btn-admin-tab">Teacher Panel</button>
      </div>

      <!-- Forms Container -->
      <div class="auth-forms">
        <!-- Student Form -->
        <form id="student-login-form" class="auth-form animate-fade-in">
          <div class="form-group">
            <label for="student-name">Full Name *</label>
            <input type="text" id="student-name" class="form-control" placeholder="e.g. John Doe" required autocomplete="name" />
          </div>
          
          <div class="form-group">
            <label for="student-roll">Roll Number *</label>
            <input type="text" id="student-roll" class="form-control" placeholder="e.g. CS-2026-004" required autocomplete="username" />
          </div>

          <div class="form-group">
            <label for="student-pass">Access Password *</label>
            <input type="password" id="student-pass" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top: 8px">
            Login as Student
          </button>
        </form>

        <!-- Admin Form (hidden initially) -->
        <form id="admin-login-form" class="auth-form animate-fade-in" style="display: none">
          <div class="form-group">
            <label for="admin-pass">Administrator Access Password *</label>
            <input type="password" id="admin-pass" class="form-control" placeholder="Enter teacher password (default: admin)" required autocomplete="current-password" />
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top: 8px">
            Login as Administrator
          </button>
        </form>
      </div>
    </div>
  `;

  container.appendChild(authWrapper);

  const studentTab = document.getElementById('btn-student-tab');
  const adminTab = document.getElementById('btn-admin-tab');
  const studentForm = document.getElementById('student-login-form');
  const adminForm = document.getElementById('admin-login-form');

  // Tab switching logic
  studentTab.onclick = () => {
    studentTab.classList.add('active');
    adminTab.classList.remove('active');
    studentForm.style.display = 'block';
    adminForm.style.display = 'none';
  };

  adminTab.onclick = () => {
    adminTab.classList.add('active');
    studentTab.classList.remove('active');
    adminForm.style.display = 'block';
    studentForm.style.display = 'none';
  };

  // Submit student form
  studentForm.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('student-name').value.trim();
    const roll = document.getElementById('student-roll').value.trim().toUpperCase();
    const pass = document.getElementById('student-pass').value.trim();

    if (!name || !roll || !pass) {
      alert('Please fill out all credentials.');
      return;
    }

    const session = { name, rollNumber: roll };
    localStorage.setItem('active_student', JSON.stringify(session));
    localStorage.removeItem('active_role'); // clear admin status if any

    onLoginSuccess('student', session);
  };

  // Submit admin form
  adminForm.onsubmit = (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value.trim();
    const settings = getSettings();

    if (pass === settings.adminPassword) {
      localStorage.setItem('active_role', 'admin');
      localStorage.removeItem('active_student'); // clear student session if any
      
      onLoginSuccess('admin', null);
    } else {
      alert('Invalid administrator password. Try "admin".');
    }
  };
}
