import * as XLSX from 'xlsx';
import { ALIAS_MAP, detectTrainingType, toCamel } from '../utils/columnMapper';
import { parseAnyDate } from '../utils/dateParser';
import { normalizeScore } from '../utils/scoreNormalizer';
import { SCORE_SCHEMAS } from '../types/reports';
import { normalizeText } from '../utils/textNormalizer';

import { Employee } from '../types/employee';

export interface ParsedRow {
  data: any;
  status: 'valid' | 'warn' | 'error';
  messages: string[];
  rowNum: number;
}

export const parseEmployeeMasterExcel = (file: File): Promise<{ rows: ParsedRow[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) throw new Error('Excel sheet is empty.');

        const rawCols = Object.keys(json[0]);
        const colMap: Record<string, string> = {};
        rawCols.forEach(rc => {
          colMap[rc] = ALIAS_MAP[rc.toLowerCase().trim()] || rc;
        });

        const processed: ParsedRow[] = json.map((raw, idx) => {
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => { m[colMap[k] || k] = v; });

          const aplExp = parseFloat(m.aplExperience) || 0;
          const pastExp = parseFloat(m.pastExperience) || 0;
          const totalExp = aplExp + pastExp;
          
          let parsedDoj = parseAnyDate(m.doj);
          if (parsedDoj) parsedDoj = parsedDoj.substring(0, 10);
          
          let parsedDob = parseAnyDate(m.dob);
          if (parsedDob) parsedDob = parsedDob.substring(0, 10);
          
          const age = parsedDob ? Math.floor((new Date().getTime() - new Date(parsedDob).getTime()) / 31557600000) : 0;

          const rec: Employee = {
            id: String(m.employeeId || '').trim(),
            employeeId: String(m.employeeId || '').trim(),
            aadhaarNumber: String(m.aadhaarNumber || '').trim(),
            mobileNumber: String(m.mobileNumber || '').trim(),
            name: normalizeText(m.name),
            designation: normalizeText(m.designation),
            team: normalizeText(m.team),
            hq: normalizeText(m.hq),
            state: normalizeText(m.state),
            doj: parsedDoj || '',
            aplExperience: aplExp,
            pastExperience: pastExp,
            totalExperience: totalExp,
            age: age,
            dob: parsedDob || '',
            email: String(m.email || '').trim(),
            basicQualification: String(m.basicQualification || '').trim(),
            status: 'Active'
          };

          const messages: string[] = [];
          let status: 'valid' | 'warn' | 'error' = 'valid';

          if (!rec.employeeId) { messages.push('Employee ID missing'); status = 'error'; }
          if (!rec.name && status !== 'error') { messages.push('Name missing'); status = 'warn'; }
          if (!rec.mobileNumber && status !== 'error') { messages.push('Mobile missing'); status = 'warn'; }
          if (!rec.aadhaarNumber && status !== 'error') { messages.push('Aadhaar missing'); status = 'warn'; }

          return { data: rec, status, messages, rowNum: idx + 2 };
        });

        resolve({ rows: processed });
      } catch (err: any) { reject(err); }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const parseNominationExcel = (file: File, trainingType: string, masterEmployees: Employee[] = []): Promise<{ rows: ParsedRow[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) throw new Error('Excel sheet is empty.');

        const rawCols = Object.keys(json[0]);
        const colMap: Record<string, string> = {};
        rawCols.forEach(rc => { colMap[rc] = ALIAS_MAP[rc.toLowerCase().trim()] || rc; });

        const empMap = new Map(masterEmployees.map(e => [e.employeeId, e]));

        const processed: ParsedRow[] = json.map((raw, idx) => {
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => { m[colMap[k] || k] = v; });

          const rawEmpId = String(m.employeeId || '').trim();
          const masterData = empMap.get(rawEmpId);

          let parsedDate = parseAnyDate(m.notificationDate);
          if (parsedDate) parsedDate = parsedDate.substring(0, 10);

          const rec: any = {
            employeeId: rawEmpId,
            aadhaarNumber: masterData ? masterData.aadhaarNumber : String(m.aadhaarNumber || '').trim(),
            mobileNumber: masterData ? masterData.mobileNumber : String(m.mobileNumber || '').trim(),
            name: masterData ? masterData.name : normalizeText(m.name),
            designation: masterData ? masterData.designation : normalizeText(m.designation),
            team: masterData ? masterData.team : normalizeText(m.team),
            hq: masterData ? masterData.hq : normalizeText(m.hq),
            state: masterData ? masterData.state : normalizeText(m.state),
            trainingType,
            notificationDate: parsedDate || '',
            month: parsedDate ? parsedDate.substring(0, 7) : '',
            createdAt: new Date().getTime()
          };

          const messages: string[] = [];
          let status: 'valid' | 'warn' | 'error' = 'valid';

          if (!rec.employeeId) { messages.push('Employee ID missing'); status = 'error'; }
          if (!rec.notificationDate) { messages.push('Notification Date missing'); status = 'error'; }
          if (!rec.name && status !== 'error') { messages.push('Name missing'); status = 'warn'; }
          if (!masterData && status !== 'error') { messages.push('Employee not found in Master'); status = 'warn'; }

          return { data: rec, status, messages, rowNum: idx + 2 };
        });

        resolve({ rows: processed });
      } catch (err: any) { reject(err); }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const parseExcelFile = (file: File, forcedType?: string, masterEmployees: Employee[] = []): Promise<{ rows: ParsedRow[], trainingType: string }> => {
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
        const trainingType = forcedType || detectTrainingType(rawCols);
        const scoreSchema = SCORE_SCHEMAS[trainingType] || [];

        // Build mapping for this file
        const colMap: Record<string, string> = {};
        rawCols.forEach(rc => {
          const lc = rc.toLowerCase().trim();
          colMap[rc] = ALIAS_MAP[lc] || rc;
        });

        // Create instant lookup map
        const empMap = new Map(masterEmployees.map(e => [e.employeeId, e]));

        const processed: ParsedRow[] = json.map((raw, idx) => {
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => {
            m[colMap[k] || k] = v;
          });

          const rawEmpId = String(m.employeeId || '').trim();
          const masterData = empMap.get(rawEmpId);

          const rec: any = {
            // Identity & Demographics pulled entirely from Master if available, otherwise fallback
            employeeId: rawEmpId,
            aadhaarNumber: masterData ? masterData.aadhaarNumber : String(m.aadhaarNumber || '').trim(),
            mobileNumber: masterData ? masterData.mobileNumber : String(m.mobileNumber || '').trim(),
            name: masterData ? masterData.name : normalizeText(m.name),
            designation: masterData ? masterData.designation : normalizeText(m.designation),
            team: masterData ? masterData.team : normalizeText(m.team),
            cluster: masterData ? masterData.state : normalizeText(m.cluster), // Fallback map
            hq: masterData ? masterData.hq : normalizeText(m.hq),
            state: masterData ? masterData.state : normalizeText(m.state),
            trainerId: normalizeText(m.trainerId),
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
          
          if (!masterData) {
            messages.push('Employee not found in Master');
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
