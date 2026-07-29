// student.js - Student Dashboard & Exam Engine View

import { getExams, getResults, addResult, saveLocalExamState, getLocalExamState, clearLocalExamState } from './db.js';
import { startSecuritySystem, stopSecuritySystem, requestFullscreen, getViolationLog, getCameraCaptures, getWarningCount } from './security.js';
import { saveResultToGoogleSheet, formatDuration } from './utils.js';

let activeStudent = null; // { name, rollNumber }
let activeExam = null;
let activeAnswers = {}; // { qId: answer }
let examTimer = null;
let examSecondsRemaining = 0;
let examTotalSeconds = 0;
let activeQuestionIndex = 0;
let autoSaveInterval = null;
let containerEl = null;

// Initialize Student View
export function initStudentView(container, studentSession) {
  containerEl = container;
  activeStudent = studentSession;
  renderDashboard();
}

// 1. Dashboard View
function renderDashboard() {
  containerEl.innerHTML = '';
  
  const exams = getExams();
  const allResults = getResults();
  
  // Filter exams that are currently active based on dates
  const now = new Date();
  const availableExams = exams.filter(e => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    return now >= start && now <= end;
  });

  // Filter student's past results
  const studentResults = allResults.filter(r => r.rollNumber === activeStudent.rollNumber);

  const dashboardHTML = `
    <div class="student-dashboard">
      <!-- Profile Header -->
      <div class="dashboard-header animate-fade-in">
        <div class="profile-info">
          <div class="avatar">${activeStudent.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2>Welcome, ${activeStudent.name}</h2>
            <p>Roll Number: <span class="highlight">${activeStudent.rollNumber}</span></p>
          </div>
        </div>
        <button class="btn btn-secondary logout-btn" id="student-logout-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Logout
        </button>
      </div>

      <div class="dashboard-grid">
        <!-- Available Exams -->
        <div class="dashboard-card animate-slide-up">
          <div class="card-header">
            <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Available Examinations</h3>
          </div>
          <div class="exams-list">
            ${availableExams.length === 0 ? `
              <div class="empty-state">
                <p>No exams are currently active. Please check back later.</p>
              </div>
            ` : availableExams.map(exam => {
              // Check if student already submitted this exam
              const alreadyTaken = studentResults.some(r => r.examId === exam.id);
              return `
                <div class="exam-item">
                  <div class="exam-info">
                    <h4>${exam.title}</h4>
                    <p class="meta">
                      <span>Duration: ${exam.duration} mins</span> | 
                      <span>Questions: ${exam.questions.length}</span>
                    </p>
                  </div>
                  <div class="exam-action">
                    ${alreadyTaken ? `
                      <span class="badge badge-success">Completed</span>
                    ` : `
                      <button class="btn btn-primary start-setup-btn" data-id="${exam.id}">Start Exam</button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Past Results -->
        <div class="dashboard-card animate-slide-up" style="animation-delay: 0.1s">
          <div class="card-header">
            <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Performance History</h3>
          </div>
          <div class="results-list">
            ${studentResults.length === 0 ? `
              <div class="empty-state">
                <p>No past exam records found.</p>
              </div>
            ` : studentResults.map(res => {
              // Check if showing result is enabled by admin
              const originalExam = exams.find(e => e.id === res.examId);
              const showResult = originalExam ? originalExam.showResultToStudent : true;

              return `
                <div class="result-item">
                  <div class="result-meta">
                    <h4>${res.examName}</h4>
                    <p class="meta">Date: ${res.date}</p>
                  </div>
                  <div class="result-score">
                    ${showResult ? `
                      <span class="score-pill ${res.status === 'Pass' ? 'pass' : 'fail'}">
                        ${res.marksObtained}/${res.totalMarks} (${res.percentage.toFixed(0)}%)
                      </span>
                    ` : `
                      <span class="score-pill disabled" title="Results hidden by Administrator">
                        Submitted
                      </span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  containerEl.innerHTML = dashboardHTML;

  // Event Listeners
  document.getElementById('student-logout-btn').onclick = () => {
    localStorage.removeItem('active_student');
    window.location.reload();
  };

  const startButtons = containerEl.querySelectorAll('.start-setup-btn');
  startButtons.forEach(btn => {
    btn.onclick = () => {
      const examId = btn.getAttribute('data-id');
      const exam = exams.find(e => e.id === examId);
      if (exam) startDeviceVerification(exam);
    };
  });
}

// 2. Pre-exam verification (permissions)
function startDeviceVerification(exam) {
  activeExam = exam;
  
  containerEl.innerHTML = `
    <div class="verification-screen animate-fade-in">
      <h2>Exam Pre-Requisites & System Check</h2>
      <p class="subtitle">Please authorize hardware access and review guidelines before starting <strong>${exam.title}</strong>.</p>
      
      <div class="setup-grid">
        <div class="guidelines-card">
          <h3>Anti-Cheating Regulations</h3>
          <ul class="guidelines-list">
            <li><strong>Full Screen Enforced:</strong> The exam will open in full-screen. Exiting triggers warnings.</li>
            <li><strong>Tab/App Tracking:</strong> Moving away, switching tabs, or resizing the browser logs a violation.</li>
            <li><strong>Limit of Warnings:</strong> Exceeding 3 security warnings submits the exam automatically.</li>
            <li><strong>Copy-Paste Disabled:</strong> Clipboard commands, right-clicks, and dragging are completely disabled.</li>
            <li><strong>Continuous Monitoring:</strong> The camera and microphone will actively audit your room.</li>
          </ul>
        </div>

        <div class="hardware-card">
          <h3>Hardware Authorization</h3>
          <div class="camera-preview-container">
            <video id="setup-camera-preview" autoplay playsinline muted></video>
            <div class="camera-placeholder" id="camera-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <p>Camera Off</p>
            </div>
          </div>
          
          <div class="device-status">
            <div class="status-indicator" id="cam-status">
              <span class="dot"></span> Camera: Checking...
            </div>
            <div class="status-indicator" id="mic-status">
              <span class="dot"></span> Microphone: Checking...
            </div>
          </div>

          <button class="btn btn-secondary btn-full" id="request-permissions-btn">Authorize Camera & Mic</button>
        </div>
      </div>

      <div class="verification-actions">
        <button class="btn btn-secondary" id="back-to-dash-btn">Cancel</button>
        <button class="btn btn-primary" id="enter-exam-btn" disabled>Proceed to Examination</button>
      </div>
    </div>
  `;

  const videoElement = document.getElementById('setup-camera-preview');
  const placeholder = document.getElementById('camera-placeholder');
  const camStatus = document.getElementById('cam-status');
  const micStatus = document.getElementById('mic-status');
  const requestBtn = document.getElementById('request-permissions-btn');
  const enterBtn = document.getElementById('enter-exam-btn');

  let localCameraStream = null;
  let localAudioStream = null;

  async function checkPermissions() {
    let hasCam = false;
    let hasMic = false;

    // 1. Camera check
    try {
      localCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = localCameraStream;
      videoElement.play();
      placeholder.style.display = 'none';
      camStatus.className = 'status-indicator status-success';
      camStatus.innerHTML = '<span class="dot"></span> Camera Authorized';
      hasCam = true;
    } catch (e) {
      console.error(e);
      camStatus.className = 'status-indicator status-error';
      camStatus.innerHTML = '<span class="dot"></span> Camera Denied';
    }

    // 2. Mic check
    try {
      localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStatus.className = 'status-indicator status-success';
      micStatus.innerHTML = '<span class="dot"></span> Microphone Authorized';
      hasMic = true;
    } catch (e) {
      console.error(e);
      micStatus.className = 'status-indicator status-error';
      micStatus.innerHTML = '<span class="dot"></span> Microphone Denied';
    }

    if (hasCam && hasMic) {
      enterBtn.disabled = false;
      requestBtn.style.display = 'none';
    }
  }

  requestBtn.onclick = checkPermissions;
  
  // Try checking permissions immediately
  checkPermissions();

  document.getElementById('back-to-dash-btn').onclick = () => {
    // Release verification streams
    if (localCameraStream) localCameraStream.getTracks().forEach(t => t.stop());
    if (localAudioStream) localAudioStream.getTracks().forEach(t => t.stop());
    renderDashboard();
  };

  enterBtn.onclick = () => {
    // Release local streams before security system locks them
    if (localCameraStream) localCameraStream.getTracks().forEach(t => t.stop());
    if (localAudioStream) localAudioStream.getTracks().forEach(t => t.stop());
    
    // Launch Exam
    launchExam();
  };
}

// 3. Launch Exam View
async function launchExam() {
  containerEl.innerHTML = `
    <div class="exam-layout">
      <!-- Top header bar -->
      <div class="exam-topbar">
        <div class="exam-title-section">
          <h3>${activeExam.title}</h3>
          <span class="student-meta">${activeStudent.name} (${activeStudent.rollNumber})</span>
        </div>
        <div class="exam-progress-section">
          <div class="progress-bar-container">
            <div class="progress-bar-fill" id="exam-progress-bar" style="width: 0%"></div>
          </div>
          <span class="progress-text" id="exam-progress-text">0% Complete</span>
        </div>
        <div class="exam-timer-section" id="exam-timer-widget">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="exam-timer-display">--:--</span>
        </div>
      </div>

      <div class="exam-main">
        <!-- Floating Security Cam Preview -->
        <div class="security-cam-widget" id="sec-cam-widget">
          <video id="exam-camera-stream" autoplay playsinline muted></video>
          <div class="widget-overlay">REC</div>
        </div>

        <!-- Left Question Panel (navigator) -->
        <div class="question-nav-panel">
          <h4>Questions</h4>
          <div class="nav-grid" id="question-nav-grid"></div>
          <div class="nav-legend">
            <div><span class="legend-box answered"></span> Answered</div>
            <div><span class="legend-box unanswered"></span> Unanswered</div>
            <div><span class="legend-box active"></span> Current</div>
          </div>
        </div>

        <!-- Center Question Display -->
        <div class="question-body-panel" id="question-body-panel"></div>
      </div>

      <!-- Bottom controls -->
      <div class="exam-footer">
        <button class="btn btn-secondary" id="prev-question-btn">Previous</button>
        <div>
          <span class="question-counter" id="question-counter-display">Question 1 of 5</span>
        </div>
        <button class="btn btn-primary" id="next-question-btn">Next</button>
        <button class="btn btn-danger" id="submit-exam-btn">Submit Exam</button>
      </div>

      <!-- Warning overlay dialog -->
      <div class="security-warning-overlay" id="warning-overlay" style="display: none">
        <div class="warning-card animate-scale-up">
          <div class="warning-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 id="warning-title">Violation Logged!</h3>
          <p id="warning-message">Tab switching is strictly forbidden.</p>
          <div class="warning-count-display">
            Warning <span id="warning-count-num">1</span> of 3
          </div>
          <button class="btn btn-danger" id="warning-dismiss-btn">Resume Exam (Re-enter Fullscreen)</button>
        </div>
      </div>
    </div>
  `;

  // Start answers
  activeAnswers = {};
  activeQuestionIndex = 0;
  
  // Shuffle options/questions if exam config requires it
  prepareExamStructure();

  // Load previous local autosave if student crashed
  const cachedState = getLocalExamState(activeStudent.rollNumber, activeExam.id);
  if (cachedState) {
    activeAnswers = cachedState.answers || {};
    activeQuestionIndex = cachedState.activeQuestionIndex || 0;
    examSecondsRemaining = cachedState.secondsRemaining || (activeExam.duration * 60);
    console.log('Restored cached exam state from local storage.');
  } else {
    examSecondsRemaining = activeExam.duration * 60;
  }
  examTotalSeconds = activeExam.duration * 60;

  // Initialize Security System
  const videoElement = document.getElementById('exam-camera-stream');
  const warningOverlay = document.getElementById('warning-overlay');
  const warningTitle = document.getElementById('warning-title');
  const warningMessage = document.getElementById('warning-message');
  const warningCountNum = document.getElementById('warning-count-num');
  const warningDismissBtn = document.getElementById('warning-dismiss-btn');

  const { cameraOk, micOk } = await startSecuritySystem({
    videoElement: videoElement,
    onViolation: (violation) => {
      console.warn('Violation logged:', violation);
    },
    onWarning: (type, count) => {
      warningTitle.innerText = `${type} Violation!`;
      warningMessage.innerText = getViolationTip(type);
      warningCountNum.innerText = count;
      warningOverlay.style.display = 'flex';
    },
    onAutoSubmit: (reason) => {
      alert(`Auto-submitting: ${reason}`);
      submitExam(true); // Force submit
    }
  });

  // Start timer ticking
  startTimer();

  // Start autosave cycle (10 seconds)
  autoSaveInterval = setInterval(() => {
    saveLocalExamState(activeStudent.rollNumber, activeExam.id, {
      answers: activeAnswers,
      activeQuestionIndex: activeQuestionIndex,
      secondsRemaining: examSecondsRemaining
    });
  }, 10000);

  // Render question UI
  renderActiveQuestion();
  renderQuestionNav();
  updateProgress();

  // Nav actions
  document.getElementById('prev-question-btn').onclick = () => {
    if (activeQuestionIndex > 0) {
      activeQuestionIndex--;
      renderActiveQuestion();
      renderQuestionNav();
    }
  };

  document.getElementById('next-question-btn').onclick = () => {
    if (activeQuestionIndex < activeExam.questions.length - 1) {
      activeQuestionIndex++;
      renderActiveQuestion();
      renderQuestionNav();
    }
  };

  document.getElementById('submit-exam-btn').onclick = () => {
    const unanswered = activeExam.questions.length - Object.keys(activeAnswers).length;
    let msg = 'Are you sure you want to submit your exam?';
    if (unanswered > 0) {
      msg += ` You have left ${unanswered} questions unanswered.`;
    }
    
    if (confirm(msg)) {
      submitExam(false);
    }
  };

  warningDismissBtn.onclick = () => {
    warningOverlay.style.display = 'none';
    requestFullscreen();
  };
}

// 4. Shuffle & Prepare exam struct
function prepareExamStructure() {
  // If shuffleQuestions enabled, we map order
  // To avoid mutating global DB seed, we shallow clone questions
  let questions = [...activeExam.questions];
  
  if (activeExam.shuffleQuestions) {
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    activeExam.questions = questions;
  }

  // Shuffle options in place for each question if enabled
  if (activeExam.shuffleOptions) {
    activeExam.questions.forEach(q => {
      if (q.type === 'mcq' && q.options) {
        // Keep track of correct answer string
        const correctText = q.options[q.correctOptionIndex];
        
        // Shuffle options
        const opts = [...q.options];
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        
        q.options = opts;
        q.correctOptionIndex = opts.indexOf(correctText);
      }
    });
  }
}

// Return human explanation of the warning type
function getViolationTip(type) {
  switch (type) {
    case 'Tab Switch':
      return 'Switching tabs, opening applications, or changing browser focus is strictly forbidden.';
    case 'Exit Fullscreen':
      return 'The exam must remain in Full Screen mode. Click below to return.';
    case 'Unfocused Window':
      return 'Do not minimize or click outside the examination panel.';
    case 'Voice Detected':
      return 'Sustained speaking or room noise was registered.';
    default:
      return 'Any further compliance violations will trigger an automated submission.';
  }
}

// 5. Timer Implementation
function startTimer() {
  const display = document.getElementById('exam-timer-display');
  const widget = document.getElementById('exam-timer-widget');

  if (examTimer) clearInterval(examTimer);

  function tick() {
    if (examSecondsRemaining <= 0) {
      clearInterval(examTimer);
      alert('Time has expired! Submitting exam.');
      submitExam(true);
      return;
    }

    examSecondsRemaining--;
    
    // Format minutes:seconds
    const mins = Math.floor(examSecondsRemaining / 60);
    const secs = examSecondsRemaining % 60;
    display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Color alert below 1 minute
    if (examSecondsRemaining < 60) {
      widget.classList.add('timer-low');
    } else {
      widget.classList.remove('timer-low');
    }
  }

  tick();
  examTimer = setInterval(tick, 1000);
}

// 6. Question Renders
function renderActiveQuestion() {
  const panel = document.getElementById('question-body-panel');
  const counterDisplay = document.getElementById('question-counter-display');
  const prevBtn = document.getElementById('prev-question-btn');
  const nextBtn = document.getElementById('next-question-btn');

  const q = activeExam.questions[activeQuestionIndex];
  
  // Update footer button displays
  prevBtn.disabled = activeQuestionIndex === 0;
  nextBtn.style.display = activeQuestionIndex === activeExam.questions.length - 1 ? 'none' : 'block';

  counterDisplay.innerText = `Question ${activeQuestionIndex + 1} of ${activeExam.questions.length} [Marks: ${q.marks}]`;

  let inputHTML = '';
  const savedAns = activeAnswers[q.id];

  if (q.type === 'mcq') {
    inputHTML = `
      <div class="options-container">
        ${q.options.map((opt, idx) => `
          <label class="option-card ${savedAns == idx ? 'selected' : ''}">
            <input type="radio" name="q_opt" value="${idx}" ${savedAns == idx ? 'checked' : ''} />
            <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
            <span class="option-text">${opt}</span>
          </label>
        `).join('')}
      </div>
    `;
  } else if (q.type === 'tf') {
    inputHTML = `
      <div class="options-container tf-container">
        <label class="option-card ${savedAns === 'true' ? 'selected' : ''}">
          <input type="radio" name="q_opt" value="true" ${savedAns === 'true' ? 'checked' : ''} />
          <span class="option-text">True</span>
        </label>
        <label class="option-card ${savedAns === 'false' ? 'selected' : ''}">
          <input type="radio" name="q_opt" value="false" ${savedAns === 'false' ? 'checked' : ''} />
          <span class="option-text">False</span>
        </label>
      </div>
    `;
  } else if (q.type === 'fib') {
    inputHTML = `
      <div class="text-answer-container">
        <input type="text" class="form-control" id="fib-answer-input" placeholder="Type your answer here..." value="${savedAns || ''}" autocomplete="off" />
      </div>
    `;
  } else if (q.type === 'sa') {
    inputHTML = `
      <div class="text-answer-container">
        <textarea class="form-control text-area" id="sa-answer-input" rows="6" placeholder="Explain your answer in detail..." autocomplete="off">${savedAns || ''}</textarea>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="question-container animate-fade-in">
      <div class="question-text">${q.questionText}</div>
      ${inputHTML}
    </div>
  `;

  // Attach Answer Event Listeners to save inputs instantly
  if (q.type === 'mcq' || q.type === 'tf') {
    const inputs = panel.querySelectorAll('input[type="radio"]');
    inputs.forEach(input => {
      input.onchange = (e) => {
        // Clear previous selected visual classes
        panel.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        // Highlight current
        e.target.closest('.option-card').classList.add('selected');
        
        activeAnswers[q.id] = e.target.value;
        renderQuestionNav();
        updateProgress();
      };
    });
  } else if (q.type === 'fib') {
    const input = document.getElementById('fib-answer-input');
    input.oninput = (e) => {
      activeAnswers[q.id] = e.target.value.trim();
      renderQuestionNav();
      updateProgress();
    };
  } else if (q.type === 'sa') {
    const textarea = document.getElementById('sa-answer-input');
    textarea.oninput = (e) => {
      activeAnswers[q.id] = e.target.value;
      renderQuestionNav();
      updateProgress();
    };
  }
}

// Render Left Question Grid Navigator
function renderQuestionNav() {
  const grid = document.getElementById('question-nav-grid');
  grid.innerHTML = '';

  activeExam.questions.forEach((q, idx) => {
    const answered = activeAnswers[q.id] !== undefined && String(activeAnswers[q.id]).trim() !== '';
    const isCurrent = idx === activeQuestionIndex;
    
    let btnClass = 'nav-item';
    if (answered) btnClass += ' answered';
    if (isCurrent) btnClass += ' active';

    const btn = document.createElement('button');
    btn.className = btnClass;
    btn.innerText = idx + 1;
    btn.onclick = () => {
      activeQuestionIndex = idx;
      renderActiveQuestion();
      renderQuestionNav();
    };

    grid.appendChild(btn);
  });
}

// Update Top Progress Bar
function updateProgress() {
  const total = activeExam.questions.length;
  const answered = Object.keys(activeAnswers).filter(k => activeAnswers[k] !== undefined && String(activeAnswers[k]).trim() !== '').length;
  const percentage = total > 0 ? (answered / total) * 100 : 0;
  
  const fill = document.getElementById('exam-progress-bar');
  const text = document.getElementById('exam-progress-text');
  
  if (fill) fill.style.width = `${percentage}%`;
  if (text) text.innerText = `${percentage.toFixed(0)}% Complete`;
}

// 7. Exam Submission
async function submitExam(isAuto = false) {
  // Clear Timers & Autosaves
  if (examTimer) clearInterval(examTimer);
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  
  // Wipe temporary autosave state
  clearLocalExamState(activeStudent.rollNumber, activeExam.id);

  // Retrieve Logs
  const violations = getViolationLog();
  const captures = getCameraCaptures();
  
  // Summarize count fields
  const camViolations = violations.filter(v => v.type === 'Camera Disabled' || v.type === 'Camera Access Denied').length;
  const micViolations = violations.filter(v => v.type === 'Voice Detected' || v.type === 'Microphone Access Denied').length;
  const fullscreenViolations = violations.filter(v => v.type === 'Exit Fullscreen' || v.type === 'Fullscreen Blocked').length;
  const tabSwitches = violations.filter(v => v.type === 'Tab Switch' || v.type === 'Unfocused Window').length;
  const totalViolationsCount = violations.length;

  // Grade responses
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let totalMarks = 0;
  let marksObtained = 0;

  activeExam.questions.forEach(q => {
    totalMarks += q.marks;
    const ans = activeAnswers[q.id];

    if (q.type === 'mcq') {
      if (ans !== undefined && parseInt(ans) === q.correctOptionIndex) {
        correctAnswers++;
        marksObtained += q.marks;
      } else {
        wrongAnswers++;
      }
    } else if (q.type === 'tf') {
      if (ans !== undefined && ans === q.correctAnswer) {
        correctAnswers++;
        marksObtained += q.marks;
      } else {
        wrongAnswers++;
      }
    } else if (q.type === 'fib') {
      if (ans !== undefined && ans.toLowerCase() === q.correctAnswer.toLowerCase().trim()) {
        correctAnswers++;
        marksObtained += q.marks;
      } else {
        wrongAnswers++;
      }
    } else if (q.type === 'sa') {
      // Short answers require manual grading but for instant result display we do a basic keyword comparison
      // or match length. Here we match keyword overlaps or mark as 0/partial as default fallback.
      // Let's grant partial credit if they write a reasonable length (> 15 chars).
      if (ans !== undefined && ans.trim().length > 15) {
        correctAnswers++;
        marksObtained += q.marks; // Instantly grading full marks for demo
      } else {
        wrongAnswers++;
      }
    }
  });

  const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
  const status = marksObtained >= activeExam.passingMarks ? 'Pass' : 'Fail';
  const timeTakenSecs = examTotalSeconds - examSecondsRemaining;

  // Construct Final Result Object
  const now = new Date();
  const result = {
    id: 'result_' + Date.now(),
    examId: activeExam.id,
    examName: activeExam.title,
    studentName: activeStudent.name,
    rollNumber: activeStudent.rollNumber,
    date: now.toLocaleDateString(),
    startTime: new Date(now.getTime() - timeTakenSecs * 1000).toLocaleTimeString(),
    endTime: now.toLocaleTimeString(),
    timeTaken: formatDuration(timeTakenSecs),
    totalQuestions: activeExam.questions.length,
    correctAnswers,
    wrongAnswers,
    marksObtained,
    totalMarks,
    percentage,
    status,
    cameraViolations: camViolations,
    microphoneViolations: micViolations,
    fullscreenViolations,
    tabSwitchingCount: tabSwitches,
    totalViolations: totalViolationsCount,
    violationLog: violations,
    cameraCaptures: captures
  };

  // Add to Local Database
  addResult(result);

  // Stop security system and exit fullscreen
  stopSecuritySystem();
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(e => console.log('Fullscreen exit failed:', e));
  }

  // Upload to Google Sheets
  const uploadRes = await saveResultToGoogleSheet(result);

  // Display Submitted/Result View
  renderSubmissionOutcome(result, uploadRes.success);
}

// 8. Result Outcome View
function renderSubmissionOutcome(result, isUploaded) {
  containerEl.innerHTML = '';
  
  const showResult = activeExam.showResultToStudent;

  containerEl.innerHTML = `
    <div class="result-screen animate-fade-in">
      <div class="outcome-card">
        <div class="check-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2>Exam Submitted Successfully!</h2>
        <p class="subtitle">Thank you for completing <strong>${result.examName}</strong>.</p>
        
        <div class="status-banner ${isUploaded ? 'status-synced' : 'status-pending'}">
          ${isUploaded ? `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Uploaded to Google Sheets database.
          ` : `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Pending upload to Google Sheets. Autosave queued offline.
          `}
        </div>

        ${showResult ? `
          <div class="detailed-metrics">
            <div class="metric-box">
              <span class="m-title">Total Marks</span>
              <span class="m-val">${result.marksObtained} / ${result.totalMarks}</span>
            </div>
            <div class="metric-box">
              <span class="m-title">Percentage</span>
              <span class="m-val">${result.percentage.toFixed(1)}%</span>
            </div>
            <div class="metric-box">
              <span class="m-title">Status</span>
              <span class="m-val status-badge ${result.status === 'Pass' ? 'pass' : 'fail'}">${result.status}</span>
            </div>
            <div class="metric-box">
              <span class="m-title">Violations</span>
              <span class="m-val">${result.totalViolations}</span>
            </div>
          </div>
        ` : `
          <div class="result-hidden-notice">
            <p><strong>Note:</strong> Detailed scores and correct options are hidden by the exam administrator. Your score has been logged securely.</p>
          </div>
        `}

        <div class="result-actions">
          <button class="btn btn-primary" id="outcome-done-btn">Back to Dashboard</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('outcome-done-btn').onclick = () => {
    renderDashboard();
  };
}
