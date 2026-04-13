import * as XLSX from 'xlsx';
import { parseAnyDate } from '../utils/dateParser';
import { normalizeScore } from '../utils/scoreNormalizer';
import { normalizeText } from '../utils/textNormalizer';
import { getSchema, mapHeader } from './trainingSchemas';

import { Employee } from '../types/employee';

export interface ParsedRow {
  data: any;
  status: 'valid' | 'warn' | 'error';
  messages: string[];
  rowNum: number;
}

// ─── HELPER: build a column→camelKey map for a given set of raw headers ─────
function buildColMap(rawCols: string[]): Record<string, string> {
  const colMap: Record<string, string> = {};
  rawCols.forEach(rc => {
    colMap[rc] = mapHeader(rc);
  });
  return colMap;
}

// ─── EMPLOYEE MASTER PARSER ──────────────────────────────────────────────────
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

        const colMap = buildColMap(Object.keys(json[0]));

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

// ─── NOMINATION PARSER ───────────────────────────────────────────────────────
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

        const colMap = buildColMap(Object.keys(json[0]));
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

// ─── ATTENDANCE + SCORE PARSER (SCHEMA-DRIVEN) ───────────────────────────────
export const parseExcelFile = (
  file: File,
  trainingType: string,
  masterEmployees: Employee[] = []
): Promise<{ rows: ParsedRow[], trainingType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) throw new Error('The Excel sheet is empty.');

        // Build column map from raw headers using schema-aware header normalization
        const rawCols = Object.keys(json[0]);
        const colMap = buildColMap(rawCols);

        // Get schema for this training type
        const schema = getSchema(trainingType);

        // Lookup master data
        const empMap = new Map(masterEmployees.map(e => [e.employeeId, e]));

        const processed: ParsedRow[] = json.map((raw, idx) => {
          // Remap all raw keys to camelCase via schema-aware mapper
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => {
            const mappedKey = colMap[k] || k;
            m[mappedKey] = v;
          });

          const rawEmpId = String(m.employeeId || '').trim();
          const masterData = empMap.get(rawEmpId);

          // Build base record — prefer Master data for identity fields
          const rec: any = {
            employeeId: rawEmpId,
            aadhaarNumber: masterData ? masterData.aadhaarNumber : String(m.aadhaarNumber || '').trim(),
            mobileNumber: masterData ? masterData.mobileNumber : String(m.mobileNumber || '').trim(),
            name: masterData ? masterData.name : normalizeText(m.name),
            designation: masterData ? masterData.designation : normalizeText(m.designation),
            team: masterData ? masterData.team : normalizeText(m.team),
            hq: masterData ? masterData.hq : normalizeText(m.hq),
            state: masterData ? masterData.state : normalizeText(m.state),
            cluster: masterData ? masterData.state : normalizeText(m.cluster || m.state || ''),
            trainerId: String(m.trainerId || '').trim(),
            trainingType,
            attendanceDate: null,
            attendanceStatus: 'Present',
            month: null,
            _scores: {} as Record<string, number | null>,
            _hasScores: false
          };

          // Normalize attendance status
          if (m.attendanceStatus !== undefined && m.attendanceStatus !== '') {
            const st = String(m.attendanceStatus).trim().toLowerCase();
            rec.attendanceStatus = (st === 'present' || st === 'p' || st === 'yes' || st === '1') ? 'Present' : 'Absent';
          }

          // Parse date
          const parsedDate = parseAnyDate(m.attendanceDate);
          rec.attendanceDate = parsedDate || null;
          rec.month = parsedDate ? parsedDate.substring(0, 7) : null;

          // ── Schema-driven score extraction ────────────────────────────────
          // For each scoreField defined in the schema, look it up in the mapped row.
          // Handles cases like 'scienceScore' from 'Science Score' header.
          schema.scoreFields.forEach(scoreKey => {
            // The cell was already mapped by mapHeader if header matched exactly.
            // Also try: direct camelCase key, label lookup
            const rawVal = m[scoreKey];
            if (rawVal !== undefined && rawVal !== '' && rawVal !== null) {
              const norm = normalizeScore(rawVal);
              if (norm !== null) {
                rec._scores[scoreKey] = norm;
              }
            }
          });

          rec._hasScores = Object.keys(rec._scores).length > 0;

          // ── Schema-driven validation ───────────────────────────────────────
          const messages: string[] = [];
          let status: 'valid' | 'warn' | 'error' = 'valid';

          // Hard error: date missing
          if (!rec.attendanceDate) {
            messages.push('Date missing or invalid');
            status = 'error';
          }

          // Hard error: employee ID missing
          if (!rec.employeeId) {
            messages.push('Employee ID missing');
            status = 'error';
          }

          // Warning: employee not in master
          if (!masterData && status !== 'error') {
            messages.push('Employee not found in Master');
            status = 'warn';
          }

          // Warning: no scores found (only relevant for types that have scores)
          if (schema.scoreFields.length > 0 && !rec._hasScores && status !== 'error') {
            const missingFields = schema.scoreFields
              .filter(f => rec._scores[f] === undefined)
              .map(f => schema.scoreLabels[f] || f)
              .join(', ');
            messages.push(`Score fields missing: ${missingFields}`);
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
