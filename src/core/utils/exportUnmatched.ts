import * as XLSX from 'xlsx';

/**
 * Export rows that are not perfectly matched (PARTIAL or NONE quality)
 * Allows users to fix and resubmit these records
 */
export const exportUnmatchedRows = (rows: any[], filename: string = 'Unmatched_Records.xlsx') => {
  // Filter to only problematic rows
  const unmatchedRows = rows.filter(r => r._matchQuality !== 'PERFECT');
  
  if (unmatchedRows.length === 0) {
    alert('No unmatched records to export. All rows are perfectly matched!');
    return;
  }

  // Transform for export
  const exportData = unmatchedRows.map(r => ({
    '#': r.rowNum || '',
    Employee_Status: r.employeeStatus || 'UNKNOWN',
    Employee_ID: r.employeeId || '',
    Aadhaar: r.aadhaarNumber || '',
    Mobile: r.mobileNumber || '',
    Name: r.name || '',
    Status: r.status?.toUpperCase() || 'UNKNOWN',
    Match_Quality: r._matchQuality || 'NONE',
    Matched_By: r._matchedBy || 'NOT_MATCHED',
    Match_Strength: r._matchStrength || 'NONE',
    Issues: (r.messages || []).join('; ') || 'No details'
  }));

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    if (!ws[address]) continue;
    ws[address].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Auto-adjust column widths
  const colWidths = exportData.length > 0 ? Object.keys(exportData[0]).map(key => ({
    wch: Math.max(
      key.length + 2,
      Math.max(...exportData.map(row => String(row[key as keyof typeof row] || '').length + 1))
    )
  })) : [];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Unmatched');

  XLSX.writeFile(wb, filename);
};

/**
 * Export all rows with full diagnostic information
 * Useful for detailed troubleshooting
 */
export const exportFullDiagnostics = (rows: any[], filename: string = 'Full_Upload_Diagnostics.xlsx') => {
  const exportData = rows.map(r => ({
    Row_Num: r.rowNum || '',
    Employee_Status: r.employeeStatus || 'UNKNOWN',
    Status: r.status?.toUpperCase() || 'UNKNOWN',
    Match_Quality: r._matchQuality || 'NONE',
    Matched_By: r._matchedBy || 'NOT_MATCHED',
    Match_Strength: r._matchStrength || 'NONE',
    Employee_ID: r.employeeId || '',
    Aadhaar: r.aadhaarNumber || '',
    Mobile: r.mobileNumber || '',
    Name: r.name || '',
    Designation: r.designation || '',
    Team: r.team || '',
    HQ: r.hq || '',
    State: r.state || '',
    Cluster: r.cluster || '',
    Zone: r.zone || '',
    Trainer_ID: r.trainerId || '',
    Attendance_Date: r.attendanceDate || '',
    Attendance_Status: r.attendanceStatus || '',
    Issues: (r.messages || []).join('; ') || 'No issues'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    if (!ws[address]) continue;
    ws[address].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F2937' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    };
  }

  // Auto-adjust column widths
  const colWidths = exportData.length > 0 ? Object.keys(exportData[0]).map(key => ({
    wch: Math.max(
      key.length + 2,
      Math.max(...exportData.map(row => String(row[key as keyof typeof row] || '').length + 1), 15)
    )
  })) : [];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Diagnostics');

  XLSX.writeFile(wb, filename);
};

