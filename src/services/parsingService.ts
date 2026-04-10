import * as XLSX from 'xlsx';
import { ALIAS_MAP, detectTrainingType, toCamel } from '../utils/columnMapper';
import { parseAnyDate } from '../utils/dateParser';
import { normalizeScore } from '../utils/scoreNormalizer';
import { SCORE_SCHEMAS } from '../types/reports';

export interface ParsedRow {
  data: any;
  status: 'valid' | 'warn' | 'error';
  messages: string[];
  rowNum: number;
}

export const parseExcelFile = (file: File): Promise<{ rows: ParsedRow[], trainingType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) {
          throw new Error('The excel sheet is empty.');
        }

        const rawCols = Object.keys(json[0]);
        const trainingType = detectTrainingType(rawCols);
        const scoreSchema = SCORE_SCHEMAS[trainingType] || [];

        // Build mapping for this file
        const colMap: Record<string, string> = {};
        rawCols.forEach(rc => {
          const lc = rc.toLowerCase().trim();
          colMap[rc] = ALIAS_MAP[lc] || rc;
        });

        const processed: ParsedRow[] = json.map((raw, idx) => {
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => {
            m[colMap[k] || k] = v;
          });

          const rec: any = {
            aadhaarNumber: String(m.aadhaarNumber || '').trim(),
            employeeId: String(m.employeeId || '').trim(),
            mobileNumber: String(m.mobileNumber || '').trim(),
            employeeName: toCamel(m.employeeName),
            trainerId: String(m.trainerId || '').trim(),
            team: toCamel(m.team),
            designation: toCamel(m.designation),
            cluster: toCamel(m.cluster),
            hq: toCamel(m.hq),
            state: toCamel(m.state),
            attendanceDate: null,
            attendanceStatus: 'Present',
            month: null,
            _scores: {},
            _hasScores: false
          };

          // Normalize attendance status
          if (m.attendanceStatus) {
            const st = String(m.attendanceStatus).trim().toLowerCase();
            rec.attendanceStatus = (st === 'present' || st === 'p' || st === 'yes' || st === '1') ? 'Present' : 'Absent';
          }

          // Parse date
          const parsedDate = parseAnyDate(m.attendanceDate);
          rec.attendanceDate = parsedDate;
          rec.month = parsedDate ? parsedDate.substring(0, 7) : null;

          // Extract scores
          scoreSchema.forEach(key => {
            const rawVal = m[key.toLowerCase()]; // excel headers might be mixed case
            const fallbackVal = m[key];
            const finalVal = rawVal !== undefined ? rawVal : fallbackVal;

            if (finalVal !== undefined && finalVal !== '' && finalVal !== null) {
              const norm = normalizeScore(finalVal);
              if (norm !== null) rec._scores[key] = norm;
            }
          });
          rec._hasScores = Object.keys(rec._scores).length > 0;

          // Validate
          const messages: string[] = [];
          let status: 'valid' | 'warn' | 'error' = 'valid';
          if (!rec.attendanceDate) {
            messages.push('Date missing/invalid');
            status = 'error';
          }
          if (!rec.aadhaarNumber) {
            messages.push('Aadhaar missing');
            if (status === 'valid') status = 'warn';
          }
          if (!rec.mobileNumber) {
            messages.push('Mobile missing');
            if (status === 'valid') status = 'warn';
          }

          return { data: rec, status, messages, rowNum: idx + 2 };
        });

        resolve({ rows: processed, trainingType });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
