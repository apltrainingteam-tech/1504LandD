import * as XLSX from 'xlsx';
import { parseAnyDate } from '../utils/dateParser';
import { normalizeScore } from '../utils/scoreNormalizer';
import { normalizeText } from '../utils/textNormalizer';
import { getSchema, mapHeader } from './trainingSchemas';
import { STATE_ZONE } from '../seed/masterData';

import { Employee } from '../types/employee';

export interface ParsedRow {
  data: any;
  status: 'valid' | 'warn' | 'error';
  messages: string[];
  rowNum: number;
}

// ─── NORMALIZATION HELPER ───────────────────────────────────────────────────
const normalize = (val?: string | number): string =>
  String(val ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

// ─── ZONE LOOKUP FROM STATE ───────────────────────────────────────────────────
const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

// ─── SMART EMPLOYEE MASTER INDEX ────────────────────────────────────────────
interface MasterIndex {
  empById: Map<string, Employee>;
  empByAadhaar: Map<string, Employee>;
  empByMobile: Map<string, Employee>;
}

const buildMasterIndex = (employees: Employee[]): MasterIndex => {
  const empById = new Map<string, Employee>();
  const empByAadhaar = new Map<string, Employee>();
  const empByMobile = new Map<string, Employee>();

  employees.forEach(emp => {
    if (emp.employeeId) {
      empById.set(normalize(emp.employeeId), emp);
    }
    if (emp.aadhaarNumber) {
      empByAadhaar.set(normalize(emp.aadhaarNumber), emp);
    }
    if (emp.mobileNumber) {
      empByMobile.set(normalize(emp.mobileNumber), emp);
    }
  });

  return { empById, empByAadhaar, empByMobile };
};

// ─── MATCHING PRIORITY LOGIC ─────────────────────────────────────────────────
const findEmployeeInMaster = (
  row: any,
  index: MasterIndex
): { employee: Employee | null; matchedBy: string } => {
  const empId = normalize(row.employeeId);
  const aadhaar = normalize(row.aadhaarNumber);
  const mobile = normalize(row.mobileNumber);

  // Priority 1: Employee ID
  if (empId && index.empById.has(empId)) {
    return { employee: index.empById.get(empId)!, matchedBy: 'ID' };
  }

  // Priority 2: Aadhaar
  if (aadhaar && index.empByAadhaar.has(aadhaar)) {
    return { employee: index.empByAadhaar.get(aadhaar)!, matchedBy: 'Aadhaar' };
  }

  // Priority 3: Mobile
  if (mobile && index.empByMobile.has(mobile)) {
    return { employee: index.empByMobile.get(mobile)!, matchedBy: 'Mobile' };
  }

  return { employee: null, matchedBy: '' };
};

// ─── MISMATCH VALIDATION ────────────────────────────────────────────────────
const validateMismatch = (row: any, emp: Employee): string[] => {
  const issues: string[] = [];

  // Name mismatch
  if (row.name && normalize(row.name) !== normalize(emp.name)) {
    issues.push(`Name mismatch: "${row.name}" vs "${emp.name}"`);
  }

  // State mismatch
  if (row.state && normalize(row.state) !== normalize(emp.state)) {
    issues.push(`State mismatch: "${row.state}" vs "${emp.state}"`);
  }

  // Mobile mismatch
  if (row.mobileNumber && normalize(row.mobileNumber) !== normalize(emp.mobileNumber)) {
    issues.push(`Mobile mismatch: "${row.mobileNumber}" vs "${emp.mobileNumber}"`);
  }

  // Aadhaar mismatch
  if (row.aadhaarNumber && normalize(row.aadhaarNumber) !== normalize(emp.aadhaarNumber)) {
    issues.push(`Aadhaar mismatch: "${row.aadhaarNumber}" vs "${emp.aadhaarNumber}"`);
  }

  return issues;
};

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

// ─── ATTENDANCE + SCORE PARSER (SCHEMA-DRIVEN WITH SMART MATCHING) ───────────
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

        // 🔥 NORMALIZATION HELPER
        const normalize = (val?: string | number) =>
          String(val ?? '')
            .trim()
            .replace(/\s+/g, '')
            .toLowerCase();

        // 🔥 BUILD MULTI-IDENTIFIER INDEXES FOR FAST LOOKUP
        const empById = new Map(masterEmployees.map(e => [normalize(e.employeeId), e]));
        const empByAadhaar = new Map(masterEmployees.map(e => [normalize(e.aadhaarNumber), e]));
        const empByMobile = new Map(masterEmployees.map(e => [normalize(e.mobileNumber), e]));

        const processed: ParsedRow[] = json.map((raw, idx) => {
          // Remap all raw keys to camelCase via schema-aware mapper
          const m: any = {};
          Object.entries(raw).forEach(([k, v]) => {
            const mappedKey = colMap[k] || k;
            m[mappedKey] = v;
          });

          // 🔥 EXTRACT & NORMALIZE INPUT VALUES
          const rawEmpId = normalize(m.employeeId);
          const rawAadhaar = normalize(m.aadhaarNumber);
          const rawMobile = normalize(m.mobileNumber);

          // 🔥 MATCH PRIORITY: ID → Aadhaar → Mobile
          let masterData = null;
          let matchedBy = '';

          if (rawEmpId && empById.has(rawEmpId)) {
            masterData = empById.get(rawEmpId);
            matchedBy = 'ID';
          } else if (rawAadhaar && empByAadhaar.has(rawAadhaar)) {
            masterData = empByAadhaar.get(rawAadhaar);
            matchedBy = 'Aadhaar';
          } else if (rawMobile && empByMobile.has(rawMobile)) {
            masterData = empByMobile.get(rawMobile);
            matchedBy = 'Mobile';
          }

          // 🔥 CALCULATE MATCH QUALITY (for strict mode)
          const isPerfectMatch =
            masterData &&
            matchedBy === 'ID' &&
            rawEmpId === normalize(masterData.employeeId);

          const matchQuality = !masterData ? 'NONE' : isPerfectMatch ? 'PERFECT' : 'PARTIAL';

          // Build base record — STRICT MASTER OVERRIDE when matched
          const rec: any = {
            // 🔥 ALWAYS USE MASTER IF MATCHED (ignore uploaded identifiers)
            employeeId: masterData?.employeeId || rawEmpId,
            aadhaarNumber: masterData?.aadhaarNumber || rawAadhaar,
            mobileNumber: masterData?.mobileNumber || rawMobile,
            
            name: masterData ? masterData.name : normalizeText(m.name),
            designation: masterData ? masterData.designation : normalizeText(m.designation),
            team: masterData ? masterData.team : normalizeText(m.team),
            hq: masterData ? masterData.hq : normalizeText(m.hq),
            state: masterData ? masterData.state : normalizeText(m.state),
            cluster: masterData ? masterData.cluster : normalizeText(m.cluster || m.state || ''),
            zone: masterData ? (masterData.zone || getZoneFromState(masterData.state)) : getZoneFromState(m.state),
            doj: masterData ? masterData.doj : '',
            trainerId: String(m.trainerId || '').trim(),
            trainingType,
            attendanceDate: null,
            attendanceStatus: 'Present',
            month: null,
            _scores: {} as Record<string, number | null>,
            _hasScores: false,
            _matchedBy: matchedBy, // Track which field matched (ID, Aadhaar, Mobile, or '')
            _matchQuality: matchQuality, // PERFECT | PARTIAL | NONE
            _matchStrength: matchedBy === 'ID' ? 'HIGH' : matchedBy === 'Aadhaar' ? 'MEDIUM' : matchedBy === 'Mobile' ? 'LOW' : 'NONE',
            _mismatches: [] as string[] // Track any mismatches
          };

          // Validate mismatches if matched
          if (masterData) {
            rec._mismatches = validateMismatch(m, masterData);
          }

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
          schema.scoreFields.forEach(scoreKey => {
            const rawVal = m[scoreKey];
            if (rawVal !== undefined && rawVal !== '' && rawVal !== null) {
              const norm = normalizeScore(rawVal);
              if (norm !== null) {
                rec._scores[scoreKey] = norm;
              }
            }
          });

          rec._hasScores = Object.keys(rec._scores).length > 0;

          // ── VALIDATION WITH SMART MATCHING & MATCH QUALITY ────────────────
          const messages: string[] = [];
          let status: 'valid' | 'warn' | 'error' = 'valid';

          // Hard error: date missing
          if (!rec.attendanceDate) {
            messages.push('Date missing or invalid');
            status = 'error';
          }

          // Hard error: No identifier fields at all
          if (!m.employeeId && !m.aadhaarNumber && !m.mobileNumber) {
            messages.push('No identifier (ID, Aadhaar, or Mobile)');
            status = 'error';
          }

          // Error: employee not found in master
          if (!masterData && status !== 'error') {
            messages.push('❌ Employee not found in Master (tried ID, Aadhaar, Mobile)');
            status = 'error';
          }

          // Warning: ID override (matched by non-ID, uploaded ID differs from master)
          if (masterData && matchedBy && matchedBy !== 'ID' && rawEmpId && status !== 'error') {
            if (rawEmpId !== normalize(masterData.employeeId)) {
              messages.push(`⚠️ Employee ID overridden by Master (matched via ${matchedBy})`);
              if (status === 'valid') status = 'warn';
            }
          }

          // Warning: Found by non-ID match (partial match)
          if (masterData && matchedBy && matchedBy !== 'ID' && status !== 'error') {
            messages.push(`⚠️ Matched via ${matchedBy} → identity auto-filled from Master`);
            if (status === 'valid') status = 'warn';
          }

          // Warning: Mismatches detected
          if (rec._mismatches.length > 0 && status !== 'error') {
            rec._mismatches.forEach((m: string) => messages.push(m));
            if (status === 'valid') status = 'warn';
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
