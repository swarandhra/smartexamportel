/**
 * Smart Exam Portal - Google Apps Script Web App Template
 * 
 * Instructions:
 * 1. Open Google Sheets and create a new Spreadsheet.
 * 2. Go to "Extensions" > "Apps Script".
 * 3. Delete any boilerplate code and paste the script below.
 * 4. Save and click "Deploy" > "New Deployment".
 * 5. Choose "Web App" type.
 * 6. Set "Execute as" to "Me".
 * 7. Set "Who has access" to "Anyone".
 * 8. Deploy, authorize permissions, copy the Web App URL, and save it in the portal settings.
 */

function doPost(e) {
  try {
    // Parse incoming JSON payload
    var data = JSON.parse(e.postData.contents);
    
    // Get active spreadsheet and sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // If the sheet is completely empty, append headers first
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Student Name",
        "Roll Number",
        "Exam Name",
        "Date",
        "Start Time",
        "End Time",
        "Total Questions",
        "Correct Answers",
        "Wrong Answers",
        "Marks",
        "Percentage",
        "Pass/Fail",
        "Time Taken",
        "Camera Violations",
        "Microphone Violations",
        "Full Screen Violations",
        "Tab Switching Count",
        "Total Violations"
      ]);
      
      // Format header row to look professional
      var headerRange = sheet.getRange(1, 1, 1, 18);
      headerRange.setFontWeight("bold");
      headerRange.setBackgroundColor("#1e3a8a"); // Navy Blue
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
    }
    
    // Append the student's result data
    sheet.appendRow([
      data.studentName,
      data.rollNumber,
      data.examName,
      data.date,
      data.startTime,
      data.endTime,
      data.totalQuestions,
      data.correctAnswers,
      data.wrongAnswers,
      data.marks,
      data.percentage,
      data.passFail,
      data.timeTaken,
      data.cameraViolations,
      data.microphoneViolations,
      data.fullscreenViolations,
      data.tabSwitchingCount,
      data.totalViolations
    ]);
    
    // Return standard success response
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", message: "Result saved successfully" })
    )
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*"); // Allow browser CORS requests
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    )
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  }
}
