// admin.js - Teacher/Admin Control Panel

import { getExams, addExam, deleteExam, getResults, getSettings, saveSettings } from './db.js';
import { downloadResultsCSV, formatDuration } from './utils.js';

let containerEl = null;
let activeTab = 'exams'; // exams, create, results, analytics, settings
let currentQuestions = []; // Temporary questions array when building an exam

export function initAdminView(container) {
  containerEl = container;
  renderAdminWorkspace();
}

function renderAdminWorkspace() {
  containerEl.innerHTML = `
    <div class="admin-workspace">
      <!-- Sidebar -->
      <div class="admin-sidebar">
        <div class="sidebar-brand">
          <h2>Smart Exam Portal</h2>
          <span>Teacher Dashboard</span>
        </div>
        <nav class="sidebar-nav">
          <button class="nav-btn ${activeTab === 'exams' ? 'active' : ''}" id="tab-exams-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            Manage Exams
          </button>
          <button class="nav-btn ${activeTab === 'create' ? 'active' : ''}" id="tab-create-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Exam
          </button>
          <button class="nav-btn ${activeTab === 'results' ? 'active' : ''}" id="tab-results-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Student Results
          </button>
          <button class="nav-btn ${activeTab === 'analytics' ? 'active' : ''}" id="tab-analytics-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Portal Analytics
          </button>
          <button class="nav-btn ${activeTab === 'settings' ? 'active' : ''}" id="tab-settings-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            System Settings
          </button>
        </nav>
        <button class="btn btn-secondary logout-btn" id="admin-logout-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Exit Admin
        </button>
      </div>

      <!-- Main Panel Work Area -->
      <div class="admin-content" id="admin-workspace-pane"></div>
    </div>
  `;

  // Attach Sidebar buttons
  document.getElementById('tab-exams-btn').onclick = () => switchTab('exams');
  document.getElementById('tab-create-btn').onclick = () => {
    currentQuestions = []; // reset question list
    switchTab('create');
  };
  document.getElementById('tab-results-btn').onclick = () => switchTab('results');
  document.getElementById('tab-analytics-btn').onclick = () => switchTab('analytics');
  document.getElementById('tab-settings-btn').onclick = () => switchTab('settings');

  document.getElementById('admin-logout-btn').onclick = () => {
    localStorage.removeItem('active_role');
    window.location.reload();
  };

  // Render first tab
  renderActiveTab();
}

function switchTab(tabId) {
  activeTab = tabId;
  renderAdminWorkspace();
}

function renderActiveTab() {
  const pane = document.getElementById('admin-workspace-pane');
  if (!pane) return;

  switch (activeTab) {
    case 'exams':
      renderExamsTab(pane);
      break;
    case 'create':
      renderCreateTab(pane);
      break;
    case 'results':
      renderResultsTab(pane);
      break;
    case 'analytics':
      renderAnalyticsTab(pane);
      break;
    case 'settings':
      renderSettingsTab(pane);
      break;
  }
}

// =================== TAB 1: EXAMS LIST ===================
function renderExamsTab(pane) {
  const exams = getExams();
  
  pane.innerHTML = `
    <div class="tab-pane animate-fade-in">
      <div class="pane-header">
        <div>
          <h2>Manage Scheduled Examinations</h2>
          <p>Create, update, and review exams available for students.</p>
        </div>
        <button class="btn btn-primary" id="add-exam-shortcut-btn">+ Create New Exam</button>
      </div>

      <div class="exams-grid">
        ${exams.length === 0 ? `
          <div class="empty-state card-full">
            <p>No exams configured yet. Click 'Create Exam' to get started.</p>
          </div>
        ` : exams.map(exam => `
          <div class="admin-exam-card animate-slide-up">
            <div class="card-body">
              <h3>${exam.title}</h3>
              <div class="exam-meta-details">
                <div><strong>Duration:</strong> ${exam.duration} Minutes</div>
                <div><strong>Questions:</strong> ${exam.questions.length}</div>
                <div><strong>Passing Marks:</strong> ${exam.passingMarks}</div>
                <div><strong>Start:</strong> ${new Date(exam.startDate).toLocaleString()}</div>
                <div><strong>End:</strong> ${new Date(exam.endDate).toLocaleString()}</div>
              </div>
              <div class="exam-status-pills">
                <span class="badge ${exam.shuffleQuestions ? 'badge-primary' : 'badge-secondary'}">Shuffle Qs</span>
                <span class="badge ${exam.shuffleOptions ? 'badge-primary' : 'badge-secondary'}">Shuffle Options</span>
                <span class="badge ${exam.showResultToStudent ? 'badge-success' : 'badge-warning'}">
                  ${exam.showResultToStudent ? 'Results Public' : 'Results Hidden'}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <button class="btn btn-danger btn-sm delete-exam-btn" data-id="${exam.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('add-exam-shortcut-btn').onclick = () => switchTab('create');

  const delBtns = pane.querySelectorAll('.delete-exam-btn');
  delBtns.forEach(btn => {
    btn.onclick = () => {
      const examId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to permanently delete this exam? All student results will remain, but the exam will be deleted.')) {
        deleteExam(examId);
        renderActiveTab();
      }
    };
  });
}

// =================== TAB 2: CREATE EXAM ===================
function renderCreateTab(pane) {
  pane.innerHTML = `
    <div class="tab-pane animate-fade-in">
      <div class="pane-header">
        <div>
          <h2>Create New Examination</h2>
          <p>Fill in details and build questions manually below.</p>
        </div>
      </div>

      <div class="form-container">
        <!-- Part A: Exam Settings -->
        <div class="dashboard-card">
          <div class="card-header"><h3>General Details</h3></div>
          <div class="card-body form-grid">
            <div class="form-group col-span-2">
              <label for="exam-title-input">Exam Title *</label>
              <input type="text" id="exam-title-input" class="form-control" placeholder="e.g. Midterm Physics exam" required />
            </div>
            
            <div class="form-group">
              <label for="exam-duration-input">Duration (Minutes) *</label>
              <input type="number" id="exam-duration-input" class="form-control" placeholder="60" min="1" required />
            </div>

            <div class="form-group">
              <label for="exam-passing-input">Passing Marks *</label>
              <input type="number" id="exam-passing-input" class="form-control" placeholder="40" min="0" required />
            </div>

            <div class="form-group">
              <label for="exam-start-input">Start Date & Time *</label>
              <input type="datetime-local" id="exam-start-input" class="form-control" required />
            </div>

            <div class="form-group">
              <label for="exam-end-input">End Date & Time *</label>
              <input type="datetime-local" id="exam-end-input" class="form-control" required />
            </div>

            <div class="form-group col-span-2 checkbox-grid">
              <label class="checkbox-label">
                <input type="checkbox" id="exam-shuffle-qs" checked /> Shuffle Questions Order
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="exam-shuffle-opts" checked /> Shuffle Options
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="exam-show-res" checked /> Show Results to Student Immediately
              </label>
            </div>
          </div>
        </div>

        <!-- Part B: Question Creator -->
        <div class="dashboard-card" style="margin-top: 24px">
          <div class="card-header flex-header">
            <h3>Add Questions manually</h3>
            <div class="builder-actions">
              <select id="question-type-select" class="form-control inline-select">
                <option value="mcq">Multiple Choice (MCQ)</option>
                <option value="tf">True / False</option>
                <option value="fib">Fill in the Blank</option>
                <option value="sa">Short Answer</option>
              </select>
              <button class="btn btn-primary" id="add-question-btn">+ Add Question</button>
            </div>
          </div>
          
          <div class="card-body">
            <div class="question-builder-list" id="builder-questions-list"></div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="form-actions" style="margin-top: 24px">
          <button class="btn btn-secondary" id="cancel-create-btn">Cancel</button>
          <button class="btn btn-primary" id="save-exam-btn">Save & Schedule Exam</button>
        </div>
      </div>
    </div>
  `;

  // Pre-fill Start & End Dates
  const now = new Date();
  document.getElementById('exam-start-input').value = now.toISOString().slice(0, 16);
  document.getElementById('exam-end-input').value = new Date(now.getTime() + 86400000).toISOString().slice(0, 16); // 1 day out

  // Bind Actions
  const qListContainer = document.getElementById('builder-questions-list');

  function renderBuilderQuestions() {
    qListContainer.innerHTML = '';
    
    if (currentQuestions.length === 0) {
      qListContainer.innerHTML = `<div class="empty-state"><p>No questions added yet. Choose a question type and click '+ Add Question'.</p></div>`;
      return;
    }

    currentQuestions.forEach((q, qIdx) => {
      const card = document.createElement('div');
      card.className = 'builder-question-card animate-fade-in';
      card.innerHTML = `
        <div class="card-head">
          <h4>Question ${qIdx + 1} (${q.type.toUpperCase()})</h4>
          <button class="btn-icon delete-q-btn" data-idx="${qIdx}">&times;</button>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>Question Text *</label>
            <input type="text" class="form-control q-text-input" data-idx="${qIdx}" value="${q.questionText}" placeholder="Enter question description..." required />
          </div>
          
          <div class="form-group inline-marks">
            <label>Question Marks *</label>
            <input type="number" class="form-control q-marks-input" data-idx="${qIdx}" value="${q.marks}" min="1" style="width: 100px" required />
          </div>

          <!-- Type Specific Elements -->
          <div class="type-elements-area">
            ${renderTypeSpecificControls(q, qIdx)}
          </div>
        </div>
      `;
      qListContainer.appendChild(card);
    });

    // Bind dynamic inputs inside question cards
    qListContainer.querySelectorAll('.q-text-input').forEach(input => {
      input.oninput = (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        currentQuestions[idx].questionText = e.target.value;
      };
    });

    qListContainer.querySelectorAll('.q-marks-input').forEach(input => {
      input.oninput = (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        currentQuestions[idx].marks = parseInt(e.target.value) || 1;
      };
    });

    // Delete question trigger
    qListContainer.querySelectorAll('.delete-q-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        currentQuestions.splice(idx, 1);
        renderBuilderQuestions();
      };
    });

    // Binding Option specific actions
    bindOptionsListeners();
  }

  function renderTypeSpecificControls(q, qIdx) {
    if (q.type === 'mcq') {
      return `
        <div class="mcq-options-builder">
          <label>Options (Check correct one) *</label>
          <div class="options-inputs-list" id="mcq-list-${qIdx}">
            ${q.options.map((opt, optIdx) => `
              <div class="option-row">
                <input type="radio" name="correct_${qIdx}" value="${optIdx}" ${q.correctOptionIndex === optIdx ? 'checked' : ''} class="mcq-radio-correct" data-qidx="${qIdx}" />
                <input type="text" class="form-control mcq-option-text" data-qidx="${qIdx}" data-optidx="${optIdx}" value="${opt}" placeholder="Option text..." required />
                <button class="btn-icon delete-opt-btn" data-qidx="${qIdx}" data-optidx="${optIdx}">&times;</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-secondary btn-sm add-option-row-btn" data-qidx="${qIdx}" style="margin-top: 8px">+ Add Option</button>
        </div>
      `;
    } else if (q.type === 'tf') {
      return `
        <div class="tf-options-builder">
          <label>Correct Answer *</label>
          <div class="radio-group-horizontal">
            <label><input type="radio" name="tf_correct_${qIdx}" value="true" ${q.correctAnswer === 'true' ? 'checked' : ''} class="tf-radio-correct" data-qidx="${qIdx}" /> True</label>
            <label><input type="radio" name="tf_correct_${qIdx}" value="false" ${q.correctAnswer === 'false' ? 'checked' : ''} class="tf-radio-correct" data-qidx="${qIdx}" /> False</label>
          </div>
        </div>
      `;
    } else if (q.type === 'fib') {
      return `
        <div class="fib-builder">
          <label>Correct Phrase *</label>
          <input type="text" class="form-control fib-answer-text" data-qidx="${qIdx}" value="${q.correctAnswer}" placeholder="Exact answer expected..." required />
        </div>
      `;
    } else if (q.type === 'sa') {
      return `
        <div class="sa-builder">
          <label>Correct Answer Guidelines / Key Phrases *</label>
          <textarea class="form-control sa-answer-text" data-qidx="${qIdx}" rows="3" placeholder="Reference answer or phrases for grading grading evaluation..." required>${q.correctAnswer}</textarea>
        </div>
      `;
    }
    return '';
  }

  function bindOptionsListeners() {
    // MCQ option radio change
    qListContainer.querySelectorAll('.mcq-radio-correct').forEach(radio => {
      radio.onchange = (e) => {
        const qidx = parseInt(e.target.getAttribute('data-qidx'));
        currentQuestions[qidx].correctOptionIndex = parseInt(e.target.value);
      };
    });

    // MCQ option text update
    qListContainer.querySelectorAll('.mcq-option-text').forEach(input => {
      input.oninput = (e) => {
        const qidx = parseInt(e.target.getAttribute('data-qidx'));
        const optidx = parseInt(e.target.getAttribute('data-optidx'));
        currentQuestions[qidx].options[optidx] = e.target.value;
      };
    });

    // Add option button
    qListContainer.querySelectorAll('.add-option-row-btn').forEach(btn => {
      btn.onclick = () => {
        const qidx = parseInt(btn.getAttribute('data-qidx'));
        currentQuestions[qidx].options.push('');
        renderBuilderQuestions();
      };
    });

    // Delete option button
    qListContainer.querySelectorAll('.delete-opt-btn').forEach(btn => {
      btn.onclick = () => {
        const qidx = parseInt(btn.getAttribute('data-qidx'));
        const optidx = parseInt(btn.getAttribute('data-optidx'));
        currentQuestions[qidx].options.splice(optidx, 1);
        
        // Correct option index adjustments
        if (currentQuestions[qidx].correctOptionIndex >= currentQuestions[qidx].options.length) {
          currentQuestions[qidx].correctOptionIndex = 0;
        }
        renderBuilderQuestions();
      };
    });

    // TF Correct Radio change
    qListContainer.querySelectorAll('.tf-radio-correct').forEach(radio => {
      radio.onchange = (e) => {
        const qidx = parseInt(e.target.getAttribute('data-qidx'));
        currentQuestions[qidx].correctAnswer = e.target.value;
      };
    });

    // FIB key phrase update
    qListContainer.querySelectorAll('.fib-answer-text').forEach(input => {
      input.oninput = (e) => {
        const qidx = parseInt(e.target.getAttribute('data-qidx'));
        currentQuestions[qidx].correctAnswer = e.target.value;
      };
    });

    // SA criteria update
    qListContainer.querySelectorAll('.sa-answer-text').forEach(textarea => {
      textarea.oninput = (e) => {
        const qidx = parseInt(e.target.getAttribute('data-qidx'));
        currentQuestions[qidx].correctAnswer = e.target.value;
      };
    });
  }

  // Hook 'Add Question' action
  document.getElementById('add-question-btn').onclick = () => {
    const select = document.getElementById('question-type-select');
    const type = select.value;
    
    let template = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      questionText: '',
      marks: 10
    };

    if (type === 'mcq') {
      template.options = ['', ''];
      template.correctOptionIndex = 0;
    } else if (type === 'tf') {
      template.correctAnswer = 'true';
    } else {
      template.correctAnswer = '';
    }

    currentQuestions.push(template);
    renderBuilderQuestions();
  };

  // Initial draw
  renderBuilderQuestions();

  // Save buttons
  document.getElementById('cancel-create-btn').onclick = () => switchTab('exams');

  document.getElementById('save-exam-btn').onclick = () => {
    const title = document.getElementById('exam-title-input').value.trim();
    const duration = parseInt(document.getElementById('exam-duration-input').value);
    const passingMarks = parseInt(document.getElementById('exam-passing-input').value);
    const startDate = document.getElementById('exam-start-input').value;
    const endDate = document.getElementById('exam-end-input').value;

    if (!title || isNaN(duration) || isNaN(passingMarks) || !startDate || !endDate) {
      alert('Please fill out all general exam details.');
      return;
    }

    if (currentQuestions.length === 0) {
      alert('You must add at least one question to the exam.');
      return;
    }

    // Basic validity loops
    for (let i = 0; i < currentQuestions.length; i++) {
      const q = currentQuestions[i];
      if (!q.questionText.trim()) {
        alert(`Question ${i + 1} has no text description.`);
        return;
      }
      if (q.type === 'mcq') {
        if (q.options.some(opt => !opt.trim())) {
          alert(`All options in MCQ Question ${i + 1} must be filled out.`);
          return;
        }
      } else if (q.type === 'fib' || q.type === 'sa') {
        if (!q.correctAnswer.trim()) {
          alert(`Correct answer context for Question ${i + 1} is empty.`);
          return;
        }
      }
    }

    const exam = {
      id: 'exam_' + Date.now(),
      title,
      duration,
      passingMarks,
      startDate,
      endDate,
      shuffleQuestions: document.getElementById('exam-shuffle-qs').checked,
      shuffleOptions: document.getElementById('exam-shuffle-opts').checked,
      showResultToStudent: document.getElementById('exam-show-res').checked,
      questions: currentQuestions
    };

    addExam(exam);
    alert('Exam created successfully!');
    switchTab('exams');
  };
}

// =================== TAB 3: STUDENT RESULTS ===================
function renderResultsTab(pane) {
  const results = getResults();
  
  pane.innerHTML = `
    <div class="tab-pane animate-fade-in">
      <div class="pane-header">
        <div>
          <h2>Examination Results</h2>
          <p>Review logs, marks, cheating violation graphs, and download sheets.</p>
        </div>
        <div class="results-toolbar">
          <input type="text" class="form-control filter-input" id="result-search-box" placeholder="Search by student, roll, or exam..." />
          <button class="btn btn-secondary" id="export-results-csv-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Download CSV
          </button>
        </div>
      </div>

      <div class="results-table-container">
        <table class="results-table" id="results-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Exam Name</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Status</th>
              <th>Violations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="results-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Violation Logs Detail Modal Overlay -->
    <div class="modal-overlay" id="violation-modal" style="display: none">
      <div class="modal-card animate-scale-up">
        <div class="modal-header">
          <h3 id="violation-modal-title">Student Integrity Report</h3>
          <button class="btn-icon close-modal-btn" id="close-violation-modal">&times;</button>
        </div>
        <div class="modal-body" id="violation-modal-body"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="print-result-report-btn">Print Report / Save PDF</button>
          <button class="btn btn-primary" id="close-violation-modal-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const searchBox = document.getElementById('result-search-box');
  const tbody = document.getElementById('results-table-body');
  const exportBtn = document.getElementById('export-results-csv-btn');

  // Modal elements
  const modal = document.getElementById('violation-modal');
  const modalBody = document.getElementById('violation-modal-body');
  const modalTitle = document.getElementById('violation-modal-title');
  const closeMod1 = document.getElementById('close-violation-modal');
  const closeMod2 = document.getElementById('close-violation-modal-btn');
  const printBtn = document.getElementById('print-result-report-btn');

  let activeModalResult = null;

  function renderTableRows(filteredResults) {
    tbody.innerHTML = '';
    if (filteredResults.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">No student records found.</td></tr>`;
      return;
    }

    filteredResults.forEach(res => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${res.studentName}</strong></td>
        <td>${res.rollNumber}</td>
        <td>${res.examName}</td>
        <td>${res.marksObtained} / ${res.totalMarks}</td>
        <td>${res.percentage.toFixed(1)}%</td>
        <td><span class="status-badge ${res.status === 'Pass' ? 'pass' : 'fail'}">${res.status}</span></td>
        <td>
          <span class="badge ${res.totalViolations > 0 ? 'badge-danger' : 'badge-success'}">
            ${res.totalViolations} Violations
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm view-log-btn" data-id="${res.id}">Integrity Log</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // View Log handler
    tbody.querySelectorAll('.view-log-btn').forEach(btn => {
      btn.onclick = () => {
        const resId = btn.getAttribute('data-id');
        const res = results.find(r => r.id === resId);
        if (res) {
          activeModalResult = res;
          openIntegrityModal(res);
        }
      };
    });
  }

  function openIntegrityModal(res) {
    modalTitle.innerText = `Audit Report: ${res.studentName} (${res.rollNumber})`;
    
    let snapsHTML = '';
    if (res.cameraCaptures && res.cameraCaptures.length > 0) {
      snapsHTML = `
        <div class="report-section">
          <h4>Webcam Audits (${res.cameraCaptures.length})</h4>
          <div class="scrolling-captures">
            ${res.cameraCaptures.map(snap => `
              <div class="capture-card">
                <img src="${snap.image}" alt="Cap @ ${snap.timestamp}" />
                <span>${snap.timestamp}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let logsHTML = `
      <div class="report-section">
        <h4>Anti-Cheating Log</h4>
        ${res.violationLog.length === 0 ? `
          <div class="clean-audit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Perfect Integrity. No browser violations detected.</div>
        ` : `
          <div class="violations-table-mini">
            <div class="v-header">
              <span>Time</span>
              <span>Violation Type</span>
              <span>Warning #</span>
            </div>
            <div class="v-body">
              ${res.violationLog.map(v => `
                <div class="v-row">
                  <span>${v.time}</span>
                  <span class="v-type">${v.type}</span>
                  <span>${v.warningNumber || '-'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
    `;

    modalBody.innerHTML = `
      <div class="print-printable-area">
        <!-- Print Header -->
        <div class="print-only print-header-block">
          <h2>Smart Exam Portal - Student Certificate & Audit Report</h2>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <hr/>
        </div>

        <div class="modal-info-summary">
          <div class="summary-item"><strong>Exam Name:</strong> ${res.examName}</div>
          <div class="summary-item"><strong>Completion Date:</strong> ${res.date}</div>
          <div class="summary-item"><strong>Duration Ticked:</strong> ${res.timeTaken}</div>
          <div class="summary-item"><strong>Final Score:</strong> ${res.marksObtained} / ${res.totalMarks} (${res.percentage.toFixed(1)}%)</div>
          <div class="summary-item"><strong>Status:</strong> ${res.status}</div>
          <div class="summary-item"><strong>Total Violations:</strong> ${res.totalViolations}</div>
        </div>

        ${logsHTML}
        ${snapsHTML}
      </div>
    `;

    modal.style.display = 'flex';
  }

  // Close modals
  const closeModal = () => modal.style.display = 'none';
  closeMod1.onclick = closeModal;
  closeMod2.onclick = closeModal;
  
  // Search filtering
  searchBox.oninput = (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = results.filter(r => 
      r.studentName.toLowerCase().includes(query) ||
      r.rollNumber.toLowerCase().includes(query) ||
      r.examName.toLowerCase().includes(query)
    );
    renderTableRows(filtered);
  };

  // Download CSV
  exportBtn.onclick = () => {
    downloadResultsCSV(results);
  };

  // Print view
  printBtn.onclick = () => {
    if (!activeModalResult) return;
    
    // Add temporary styling body tag to support isolated printing
    document.body.classList.add('printing-active');
    window.print();
    document.body.classList.remove('printing-active');
  };

  // Initial draw
  renderTableRows(results);
}

// =================== TAB 4: PORTAL ANALYTICS ===================
function renderAnalyticsTab(pane) {
  const results = getResults();
  const exams = getExams();

  if (results.length === 0) {
    pane.innerHTML = `
      <div class="tab-pane animate-fade-in">
        <div class="pane-header">
          <h2>System Performance & Analytics</h2>
        </div>
        <div class="empty-state card-full">
          <p>Analytics require student results. Once students submit exams, charts will generate here.</p>
        </div>
      </div>
    `;
    return;
  }

  // Group metrics
  const totalSubmissions = results.length;
  const passCount = results.filter(r => r.status === 'Pass').length;
  const failCount = totalSubmissions - passCount;
  const passRate = (passCount / totalSubmissions) * 100;

  // Average score
  const totalPercentSum = results.reduce((acc, r) => acc + r.percentage, 0);
  const avgPercentage = totalPercentSum / totalSubmissions;

  // Total violations
  const totalViolationsCount = results.reduce((acc, r) => acc + r.totalViolations, 0);

  // Group violations by type
  let camCount = 0;
  let micCount = 0;
  let fsCount = 0;
  let tabCount = 0;

  results.forEach(r => {
    camCount += r.cameraViolations || 0;
    micCount += r.microphoneViolations || 0;
    fsCount += r.fullscreenViolations || 0;
    tabCount += r.tabSwitchingCount || 0;
  });

  // SVG Chart: Pass vs Fail Pie Chart
  const pieRadius = 50;
  const pieCircum = 2 * Math.PI * pieRadius;
  const passStrokeDash = (passRate / 100) * pieCircum;
  const failStrokeDash = pieCircum - passStrokeDash;

  // SVG Bar Chart: average scores per exam
  // Get unique exams that have results
  const examAverages = {};
  results.forEach(r => {
    if (!examAverages[r.examName]) {
      examAverages[r.examName] = { sum: 0, count: 0 };
    }
    examAverages[r.examName].sum += r.percentage;
    examAverages[r.examName].count += 1;
  });

  const chartExams = Object.keys(examAverages).map(name => ({
    name: name,
    avg: examAverages[name].sum / examAverages[name].count
  }));

  pane.innerHTML = `
    <div class="tab-pane animate-fade-in">
      <div class="pane-header">
        <h2>System Performance & Analytics</h2>
        <p>A summary of exam statistics, pass rates, and security health.</p>
      </div>

      <!-- Stat Cards -->
      <div class="analytics-stats-grid">
        <div class="stat-card">
          <span class="s-label">Total Submissions</span>
          <span class="s-val">${totalSubmissions}</span>
        </div>
        <div class="stat-card">
          <span class="s-label">Average Score</span>
          <span class="s-val">${avgPercentage.toFixed(1)}%</span>
        </div>
        <div class="stat-card">
          <span class="s-label">Class Pass Rate</span>
          <span class="s-val">${passRate.toFixed(1)}%</span>
        </div>
        <div class="stat-card">
          <span class="s-label">Total Integrity Alerts</span>
          <span class="s-val red-text">${totalViolationsCount}</span>
        </div>
      </div>

      <div class="analytics-charts-grid" style="margin-top: 24px">
        <!-- Chart 1: Pass/Fail -->
        <div class="dashboard-card">
          <div class="card-header"><h3>Completion Outcomes (Pass vs Fail)</h3></div>
          <div class="card-body flex-center flex-column">
            <svg width="200" height="200" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
              <!-- Background -->
              <circle cx="60" cy="60" r="${pieRadius}" fill="transparent" stroke="#f1f5f9" stroke-width="12" />
              <!-- Pass portion -->
              <circle cx="60" cy="60" r="${pieRadius}" fill="transparent" stroke="#10b981" stroke-width="12" 
                stroke-dasharray="${passStrokeDash} ${pieCircum}" />
              <!-- Fail portion -->
              <circle cx="60" cy="60" r="${pieRadius}" fill="transparent" stroke="#ef4444" stroke-width="12" 
                stroke-dasharray="${failStrokeDash} ${pieCircum}" stroke-dashoffset="-${passStrokeDash}" />
            </svg>
            <div class="chart-legend" style="margin-top: 16px; display: flex; gap: 24px">
              <div><span class="legend-box pass"></span> Pass: ${passCount} (${passRate.toFixed(0)}%)</div>
              <div><span class="legend-box fail"></span> Fail: ${failCount} (${(100 - passRate).toFixed(0)}%)</div>
            </div>
          </div>
        </div>

        <!-- Chart 2: Security Violations -->
        <div class="dashboard-card">
          <div class="card-header"><h3>Integrity Violation Breakdown</h3></div>
          <div class="card-body">
            <div class="analytics-bar-chart">
              <!-- Visual Bar rows -->
              ${renderBarRow('Tab Switches', tabCount, totalViolationsCount)}
              ${renderBarRow('Fullscreen Exit', fsCount, totalViolationsCount)}
              ${renderBarRow('Mic Activity', micCount, totalViolationsCount)}
              ${renderBarRow('Cam Disabled', camCount, totalViolationsCount)}
            </div>
          </div>
        </div>
      </div>

      <!-- Part C: Score per exam -->
      <div class="dashboard-card" style="margin-top: 24px">
        <div class="card-header"><h3>Performance by Exam Title</h3></div>
        <div class="card-body">
          <div class="custom-bar-grid">
            <div class="bar-chart-y-axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div class="bar-chart-columns">
              ${chartExams.map(ce => `
                <div class="chart-col">
                  <div class="col-fill-box">
                    <div class="fill-bar" style="height: ${ce.avg}%" title="${ce.avg.toFixed(1)}%"></div>
                  </div>
                  <span class="col-title">${ce.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBarRow(label, count, total) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return `
    <div class="analytics-row">
      <div class="row-label">${label} (${count})</div>
      <div class="row-bar-track">
        <div class="row-bar-fill red" style="width: ${percentage}%"></div>
      </div>
    </div>
  `;
}

// =================== TAB 5: SYSTEM SETTINGS ===================
function renderSettingsTab(pane) {
  const settings = getSettings();
  
  pane.innerHTML = `
    <div class="tab-pane animate-fade-in">
      <div class="pane-header">
        <h2>System Configuration</h2>
        <p>Manage Apps Script webhooks and security authentication credentials.</p>
      </div>

      <div class="form-container max-w-md">
        <div class="dashboard-card">
          <div class="card-header"><h3>Configuration Details</h3></div>
          <div class="card-body">
            
            <div class="form-group">
              <label for="settings-script-url">Google Apps Script Web App URL</label>
              <input type="url" id="settings-script-url" class="form-control" value="${settings.googleAppsScriptUrl}" placeholder="https://script.google.com/macros/s/..." />
              <p class="field-tip">All student responses will automatically post to this endpoint when exams are completed.</p>
            </div>

            <div class="form-group" style="margin-top: 16px">
              <label for="settings-admin-pass">Admin/Teacher Portal Password</label>
              <input type="text" id="settings-admin-pass" class="form-control" value="${settings.adminPassword}" placeholder="Change default 'admin' password" />
            </div>

            <button class="btn btn-primary" id="save-settings-btn" style="margin-top: 16px">Update Configurations</button>
          </div>
        </div>

        <div class="dashboard-card" style="margin-top: 24px">
          <div class="card-header"><h3>Google Spreadsheet Deployment Guide</h3></div>
          <div class="card-body docs-body">
            <p>To view submissions in your Google Sheet, configure the connection as follows:</p>
            <ol>
              <li>Create a new Google Sheet.</li>
              <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Delete any existing code and copy-paste the template file contents from <code>google_script_template.js</code>.</li>
              <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
              <li>Set <em>Select type</em> to <strong>Web App</strong>.</li>
              <li>Set <em>Execute as</em> to <strong>Me</strong>.</li>
              <li>Set <em>Who has access</em> to <strong>Anyone</strong> (necessary for client-side API requests).</li>
              <li>Click <strong>Deploy</strong>, authorize the permissions, and copy the generated <strong>Web App URL</strong>.</li>
              <li>Paste the URL into the box above and click "Update Configurations".</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-settings-btn').onclick = () => {
    const url = document.getElementById('settings-script-url').value.trim();
    const pass = document.getElementById('settings-admin-pass').value.trim();

    if (!pass) {
      alert('Admin password cannot be empty.');
      return;
    }

    saveSettings({
      googleAppsScriptUrl: url,
      adminPassword: pass
    });

    alert('Settings updated successfully!');
    renderActiveTab();
  };
}
