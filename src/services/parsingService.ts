import * as XLSX from 'xlsx';
import { parseAnyDate } from '../utils/dateParser';
import { normalizeScore } from '../utils/scoreNormalizer';
import { normalizeText } from '../utils/textNormalizer';
import { normalizeTrainerName, standardizeTrainer } from '../utils/trainerMapper';
import { getSchema, mapHeader } from './trainingSchemas';
import { buildTemplateColumnMap, validateRowAgainstTemplate, getTemplate } from './uploadTemplates';
import { STATE_ZONE } from '../seed/masterData';
import { getFiscalYearFromDate } from '../utils/fiscalYear';

import { Employee } from '../types/employee';

export interface ParsedRow {
  data: any;
  status: 'valid' | 'warn' | 'error';
  messages: string[];
  rowNum: number;
}

// ─── STRICT TEMPLATE VALIDATION ─────────────────────────────────────────────
/**
 * Validates Excel headers against template requirements
 * Returns: { valid, errors, columnMap }
 */
export function validateHeadersAgainstTemplate(
  excelHeaders: string[],
  trainingType: string
): { valid: boolean; errors: string[]; columnMap: Record<string, string> } {
  const template = getTemplate(trainingType);
  const errors: string[] = [];
  const columnMap: Record<string, string> = {};

  // Build set of required headers (exact match)
  const requiredHeaders = new Set(template.columns.map(col => col.excelHeader));
  
  // Find missing required headers
  template.columns.forEach(col => {
    const found = excelHeaders.some(h => h.trim() === col.excelHeader);
    if (!found && col.required) {
      errors.push(
        `❌ Required column missing: "${col.excelHeader}". ` +
        `Make sure you're using the official template.`
      );
    }
  });

  // Build column map (strict matching)
  template.columns.forEach(col => {
    const found = excelHeaders.find(h => h.trim() === col.excelHeader);
    if (found) {
      columnMap[found] = col.dbField;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    columnMap
  };
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

// ─── ATTENDANCE + SCORE PARSER (STRICT TEMPLATE VALIDATION) ──────────────────
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

        // ✅ STEP 1: VALIDATE HEADERS AGAINST TEMPLATE (STRICT MODE)
        const rawHeaders = Object.keys(json[0]);
        const headerValidation = validateHeadersAgainstTemplate(rawHeaders, trainingType);

        if (!headerValidation.valid) {
          const errorMsg =
            `❌ COLUMN HEADERS DO NOT MATCH TEMPLATE!\n` +
            `Required columns: ${getTemplate(trainingType).columns.map(c => `"${c.excelHeader}"`).join(', ')}\n` +
            `Errors:\n${headerValidation.errors.map(e => `  • ${e}`).join('\n')}`;
          throw new Error(errorMsg);
        }

        console.log(`[PARSER] ✅ Headers validated against ${trainingType} template`);
        console.log('[PARSER] Column mapping:', headerValidation.columnMap);

        // ✅ STEP 2: BUILD MULTI-IDENTIFIER INDEXES FOR LOOKUP
        const empById = new Map(masterEmployees.map(e => [normalize(e.employeeId), e]));
        const empByAadhaar = new Map(masterEmployees.map(e => [normalize(e.aadhaarNumber), e]));
        const empByMobile = new Map(masterEmployees.map(e => [normalize(e.mobileNumber), e]));

        // ✅ STEP 3: PARSE ROWS WITH STRICT VALIDATION
        const processed: ParsedRow[] = json.map((raw, idx) => {
          // ✅ REMAP COLUMNS USING STRICT TEMPLATE MAPPING
          const m: any = {};
          Object.entries(raw).forEach(([rawHeader, value]) => {
            const dbField = headerValidation.columnMap[rawHeader];
            if (dbField) {
              m[dbField] = value;
            }
          });

          const rawEmpId = normalize(m.employeeId);
          let masterData: Employee | null = null;
          let matchedBy = '';

          // Priority 1: Employee ID
          if (rawEmpId && empById.has(rawEmpId)) {
            masterData = empById.get(rawEmpId) || null;
            matchedBy = 'ID';
          } else if (m.aadhaarNumber && empByAadhaar.has(normalize(m.aadhaarNumber))) {
            masterData = empByAadhaar.get(normalize(m.aadhaarNumber)) || null;
            matchedBy = 'Aadhaar';
          } else if (m.mobileNumber && empByMobile.has(normalize(m.mobileNumber))) {
            masterData = empByMobile.get(normalize(m.mobileNumber)) || null;
            matchedBy = 'Mobile';
          }

          const isPerfectMatch =
            masterData &&
            matchedBy === 'ID' &&
            rawEmpId === normalize(masterData.employeeId);

          const matchQuality = !masterData ? 'NONE' : isPerfectMatch ? 'PERFECT' : 'PARTIAL';

          // Parse date (STRICT: must be valid YYYY-MM-DD)
          let parsedDate = parseAnyDate(m.attendanceDate);
          let dateError = '';
          if (!parsedDate && m.attendanceDate) {
            dateError = `Invalid date: "${m.attendanceDate}" - use YYYY-MM-DD format`;
          }

          // Build record
          const rec: any = {
            employeeId: masterData?.employeeId || m.employeeId || '',
            aadhaarNumber: masterData?.aadhaarNumber || m.aadhaarNumber || '',
            mobileNumber: masterData?.mobileNumber || m.mobileNumber || '',
            name: masterData?.name || m.name || '',
            designation: masterData?.designation || m.designation || '',
            team: masterData?.team || m.team || '',
            hq: masterData?.hq || m.hq || '',
            state: masterData?.state || m.state || '',
            cluster: masterData?.cluster || m.cluster || '',
            zone: masterData?.zone || '',
            trainingType,
            attendanceDate: parsedDate || null,
            attendanceStatus: normalizeAttendanceStatus(m.attendanceStatus),
            month: parsedDate ? parsedDate.substring(0, 7) : null,
            batch: m.batch || '',
            trainerName: m.trainerName || '',
            region: m.region || '',
            score: m.score ? parseInt(m.score) : null,
            _matchedBy: matchedBy,
            _matchQuality: matchQuality,
            _matchStrength: matchedBy === 'ID' ? 'HIGH' : matchedBy === 'Aadhaar' ? 'MEDIUM' : matchedBy === 'Mobile' ? 'LOW' : 'NONE',
            isHistorical: !masterData,
            employeeStatus: masterData ? 'ACTIVE' : 'INACTIVE'
          };

          // ✅ VALIDATION AGAINST TEMPLATE
          const templateValidation = validateRowAgainstTemplate(rec, trainingType);
          const messages: string[] = [...templateValidation.errors];
          let status: 'valid' | 'warn' | 'error' = templateValidation.valid ? 'valid' : 'error';

          // Additional warnings
          if (!masterData) {
            messages.push('Employee not found in Master (historical record)');
            if (status === 'valid') status = 'warn';
          } else if (matchedBy !== 'ID') {
            messages.push(`⚠️ Matched via ${matchedBy} (not by Employee ID)`);
            if (status === 'valid') status = 'warn';
          }

          if (dateError) {
            messages.push(dateError);
            status = 'error';
          }

          return { data: rec, status, messages, rowNum: idx + 2 };
        });

        console.log(`[PARSER] ✅ Parsed ${processed.length} rows from Excel`);
        const errorCount = processed.filter(r => r.status === 'error').length;
        const warnCount = processed.filter(r => r.status === 'warn').length;
        console.log(`[PARSER] Results: ${errorCount} errors, ${warnCount} warnings, ${processed.filter(r => r.status === 'valid').length} valid`);

        resolve({ rows: processed, trainingType });
      } catch (err: any) {
        console.error('[PARSER] Error:', err.message);
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Normalize attendance status to Present/Absent
 */
function normalizeAttendanceStatus(value: any): string {
  if (!value) return 'Present'; // Default
  const normalized = String(value).trim().toLowerCase();
  return (normalized === 'present' || normalized === 'p' || normalized === 'yes' || normalized === '1')
    ? 'Present'
    : 'Absent';
}

// ─── END OF FILE ───────────────────────────────────────────────────────────
