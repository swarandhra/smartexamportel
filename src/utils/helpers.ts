// helpers.ts - Helper Functions & API Integrations

import { getSettings, getOfflineQueue, clearOfflineQueue, addToOfflineQueue } from './db';
import type { Result } from './db';

// Send student's result to the configured Google Apps Script Web App URL
export async function saveResultToGoogleSheet(resultData: Result): Promise<{ success: boolean; reason?: string; error?: string }> {
  const settings = getSettings();
  const url = settings.googleAppsScriptUrl;

  if (!url || url.includes('SAMPLE_URL')) {
    console.warn('Google Apps Script URL is not configured. Saving locally only.');
    return { success: false, reason: 'Not configured' };
  }

  const payload = {
    studentName: resultData.studentName,
    rollNumber: resultData.rollNumber,
    examName: resultData.examName,
    date: resultData.date,
    startTime: resultData.startTime,
    endTime: resultData.endTime,
    totalQuestions: resultData.totalQuestions,
    correctAnswers: resultData.correctAnswers,
    wrongAnswers: resultData.wrongAnswers,
    marks: resultData.marksObtained,
    percentage: resultData.percentage.toFixed(1) + '%',
    passFail: resultData.status,
    timeTaken: resultData.timeTaken,
    cameraViolations: resultData.cameraViolations,
    microphoneViolations: resultData.microphoneViolations,
    fullscreenViolations: resultData.fullscreenViolations,
    tabSwitchingCount: resultData.tabSwitchingCount,
    totalViolations: resultData.totalViolations
  };

  try {
    if (!navigator.onLine) {
      throw new TypeError('Failed to fetch (offline)');
    }

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Result successfully sent to Google Sheets (no-cors mode).');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving to Google Sheets:', error);
    addToOfflineQueue(resultData);
    return { success: false, reason: 'offline_queued', error: error.message };
  }
}

// Sync queued offline results when connection is restored
export async function syncOfflineResults(): Promise<void> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`Attempting to sync ${queue.length} offline result(s) to Google Sheets...`);
  const remaining: Result[] = [];

  for (const result of queue) {
    const res = await saveResultToGoogleSheetWithoutQueueing(result);
    if (!res.success) {
      remaining.push(result);
    }
  }

  if (remaining.length === 0) {
    clearOfflineQueue();
    console.log('All offline results synced successfully.');
    showSyncNotification(queue.length);
  } else {
    localStorage.setItem('failed_uploads_queue', JSON.stringify(remaining));
    console.warn(`${remaining.length} results failed to sync and remain in queue.`);
  }
}

// Internal helper to avoid double-queueing
async function saveResultToGoogleSheetWithoutQueueing(resultData: Result): Promise<{ success: boolean }> {
  const settings = getSettings();
  const url = settings.googleAppsScriptUrl;
  if (!url || url.includes('SAMPLE_URL')) return { success: false };

  const payload = {
    studentName: resultData.studentName,
    rollNumber: resultData.rollNumber,
    examName: resultData.examName,
    date: resultData.date,
    startTime: resultData.startTime,
    endTime: resultData.endTime,
    totalQuestions: resultData.totalQuestions,
    correctAnswers: resultData.correctAnswers,
    wrongAnswers: resultData.wrongAnswers,
    marks: resultData.marksObtained,
    percentage: resultData.percentage.toFixed(1) + '%',
    passFail: resultData.status,
    timeTaken: resultData.timeTaken,
    cameraViolations: resultData.cameraViolations,
    microphoneViolations: resultData.microphoneViolations,
    fullscreenViolations: resultData.fullscreenViolations,
    tabSwitchingCount: resultData.tabSwitchingCount,
    totalViolations: resultData.totalViolations
  };

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

// Download Results as Excel/CSV
export function downloadResultsCSV(results: Result[], examName = 'All_Exams'): void {
  if (results.length === 0) return;

  const headers = [
    'Student Name', 'Roll Number', 'Exam Name', 'Date', 'Start Time', 'End Time',
    'Total Questions', 'Correct Answers', 'Wrong Answers', 'Marks Obtained',
    'Percentage', 'Pass/Fail', 'Time Taken', 'Camera Violations',
    'Microphone Violations', 'Full Screen Violations', 'Tab Switches', 'Total Violations'
  ];

  const rows = results.map(r => [
    r.studentName,
    r.rollNumber,
    r.examName,
    r.date,
    r.startTime,
    r.endTime,
    r.totalQuestions,
    r.correctAnswers,
    r.wrongAnswers,
    r.marksObtained,
    r.percentage.toFixed(1) + '%',
    r.status,
    r.timeTaken,
    r.cameraViolations,
    r.microphoneViolations,
    r.fullscreenViolations,
    r.tabSwitchingCount,
    r.totalViolations
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Smart_Exam_${examName.replace(/\s+/g, '_')}_Results_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const out = [];
  if (hrs > 0) out.push(`${hrs} hr${hrs > 1 ? 's' : ''}`);
  if (mins > 0) out.push(`${mins} min${mins > 1 ? 's' : ''}`);
  if (secs > 0 || out.length === 0) out.push(`${secs} sec${secs > 1 ? 's' : ''}`);
  
  return out.join(' ');
}

// Simple non-intrusive notification banner for sync completion
function showSyncNotification(count: number): void {
  const banner = document.createElement('div');
  banner.style.position = 'fixed';
  banner.style.bottom = '20px';
  banner.style.right = '20px';
  banner.style.backgroundColor = '#10b981';
  banner.style.color = '#ffffff';
  banner.style.padding = '12px 24px';
  banner.style.borderRadius = '8px';
  banner.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
  banner.style.zIndex = '99999';
  banner.style.fontFamily = 'Plus Jakarta Sans, sans-serif';
  banner.style.fontSize = '14px';
  banner.style.fontWeight = '600';
  banner.innerText = `Synced ${count} offline exam results to Google Sheets!`;

  document.body.appendChild(banner);
  setTimeout(() => {
    banner.style.transition = 'opacity 0.5s ease';
    banner.style.opacity = '0';
    setTimeout(() => document.body.removeChild(banner), 500);
  }, 4000);
}
