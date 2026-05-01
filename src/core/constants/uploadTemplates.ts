import { getSchema } from './trainingSchemas';
/**
 * STRICT TEMPLATE SYSTEM - Zero Ambiguity, No Fallback Logic
 * 
 * Mandatory common columns + template-specific columns.
 * Deterministic template detection.
 * Exact field mapping to MongoDB.
 */

// ─── COMMON BASE COLUMNS (MANDATORY FOR ALL TEMPLATES) ──────────────────────
export const COMMON_COLUMNS = [
  'Aadhaar Number',
  'Employee ID',
  'Mobile Number',
  'Trainer',
  'Team',
  'Name',
  'Designation',
  'HQ',
  'State'
];

export const ATTENDANCE_SPECIFIC_COLUMNS = [
  'Attendance Date',
  'Attendance Status'
];

// ─── TEMPLATE-SPECIFIC COLUMNS ───────────────────────────────────────────────
export const TEMPLATE_SPECIFIC_COLUMNS: Record<string, string[]> = {
  IP: ['Detailing', 'Test Score', 'Trainability Score'],
  AP: [
    'Knowledge',
    'BSE',
    'Grasping',
    'Participation',
    'Detailing & Presentation',
    'Role Play',
    'Punctuality',
    'Grooming & Dress Code',
    'Behaviour'
  ],
  PreAP: ['AP Date', 'Notified', 'Test Score'],
  MIP: ['Science Score', 'Skill Score'],
  Capsule: ['Score'],
  Refresher: ['Knowledge', 'Situation Handling', 'Presentation'],
  NotificationHistory: ['Notification Date', 'Training Type', 'Training ID']
};

// ─── TEMPLATE DETECTION RULES (STRICT) ───────────────────────────────────────
export function detectTemplateType(excelHeaders: string[]): string {
  const headerSet = new Set(excelHeaders.map(h => h.trim()));

  // Detection rules in priority order (most specific first)
  if (headerSet.has('Notification Date')) return 'NotificationHistory';
  if (headerSet.has('Trainability Score')) return 'IP';
  if (headerSet.has('BSE') || headerSet.has('Situation Handling')) {
    if (headerSet.has('Science Score')) return 'MIP'; // MIP also has some common ones
    if (headerSet.has('Knowledge') && !headerSet.has('BSE')) return 'Refresher';
    return 'AP';
  }
  if (headerSet.has('AP Date')) return 'PreAP';
  if (headerSet.has('Science Score')) return 'MIP';
  if (headerSet.has('Situation Handling')) return 'Refresher';
  if (headerSet.has('Test Score') && !headerSet.has('Trainability Score') && !headerSet.has('BSE')) return 'Capsule';

  throw new Error(
    `❌ Template type cannot be determined. Unique columns not found.\n` +
    `Available headers: ${excelHeaders.join(', ')}\n` +
    `Expected one of:\n` +
    `  - "Notification Date" for Notification History\n` +
    `  - "Trainability Score" for IP\n` +
    `  - "BSE" or "Situation Handling" for AP/Refresher\n` +
    `  - "AP Date" for PreAP\n` +
    `  - "Science Score" for MIP\n` +
    `  - "Test Score" (alone) for Capsule`
  );
}

// ─── EXACT COLUMN MAPPING (EXCEL HEADER → MONGODB FIELD) ──────────────────────
export const COLUMN_MAPPING: Record<string, string> = {
  // Common fields
  'Aadhaar Number': 'aadhaarNumber',
  'Employee ID': 'employeeId',
  'Mobile Number': 'mobileNumber',
  'Trainer': 'trainerId',
  'Team': 'team',
  'Name': 'name',
  'Designation': 'designation',
  'HQ': 'hq',
  'State': 'state',
  'Attendance Date': 'attendanceDate',
  'Attendance Status': 'attendanceStatus',
  'Notification Date': 'notificationDate',
  'Training Type': 'trainingType',

  // Training Scores (IP, AP, MIP, Refresher, Capsule)
  'Detailing': 'detailing',
  'Test Score': 'percent',
  'Trainability Score': 'tScore',
  'Knowledge': 'knowledge',
  'BSE': 'bse',
  'Grasping': 'grasping',
  'Participation': 'participation',
  'Presentation': 'presentation',
  'Detailing & Presentation': 'detailing',
  'Situation Handling': 'situationHandling',
  'Role Play': 'rolePlay',
  'Punctuality': 'punctuality',
  'Grooming & Dress Code': 'grooming',
  'Behaviour': 'behaviour',
  'English': 'english',
  'Local Language': 'localLanguage',
  'Involvement': 'involvement',
  'Effort': 'effort',
  'Confidence': 'confidence',
  'Science Score': 'scienceScore',
  'Skill Score': 'skillScore',
  'Score': 'score',

  // PreAP specific
  'AP Date': 'apDate',
  'Notified': 'notified'
};

// ─── VALIDATION ──────────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate common base columns are present
 */
export function validateCommonColumns(excelHeaders: string[]): ValidationResult {
  const headerSet = new Set(excelHeaders.map(h => h.trim()));
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const col of COMMON_COLUMNS) {
    if (!headerSet.has(col)) {
      errors.push(`❌ Missing required column: "${col}"`);
    }
  }

  // Attendance-specific columns are required for everything EXCEPT NotificationHistory
  const isNotificationHistory = headerSet.has('Notification Date');
  if (!isNotificationHistory) {
    for (const col of ATTENDANCE_SPECIFIC_COLUMNS) {
      if (!headerSet.has(col)) {
        errors.push(`❌ Missing required column: "${col}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate template-specific columns exist for detected type
 */
export function validateTemplateColumns(excelHeaders: string[], templateType: string): ValidationResult {
  const headerSet = new Set(excelHeaders.map(h => h.trim()));
  const templateCols = TEMPLATE_SPECIFIC_COLUMNS[templateType];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!templateCols) {
    errors.push(`❌ Unknown template type: "${templateType}"`);
    return { valid: false, errors, warnings };
  }

  // Check for ALL template-specific columns (strict mode)
  for (const col of templateCols) {
    if (!headerSet.has(col)) {
      errors.push(`❌ Missing required score column: "${col}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate row data (strict mode)
 */
export function validateRow(
  rowData: Record<string, any>,
  rowNum: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // MANDATORY: At least one identifier (Employee ID, Aadhaar, or Mobile)
  const hasId = rowData.employeeId && String(rowData.employeeId).trim() !== '';
  const hasAadhaar = rowData.aadhaarNumber && String(rowData.aadhaarNumber).trim() !== '';
  const hasMobile = rowData.mobileNumber && String(rowData.mobileNumber).trim() !== '';

  if (!hasId && !hasAadhaar && !hasMobile) {
    errors.push(`Row ${rowNum}: At least one identifier (Employee ID, Aadhaar, or Mobile) is required`);
  }

  // MANDATORY: Training Type
  if (!rowData.trainingType || String(rowData.trainingType).trim() === '') {
    errors.push(`Row ${rowNum}: Training Type is missing or empty`);
  }

  // MANDATORY: Date (Notification Date for history, Attendance Date for training)
  const isHistory = rowData._templateType === 'NotificationHistory';

  if (isHistory) {
    // For Nominations: Ignore attendanceDate completely. Check notificationDate.
    if (!rowData.notificationDate || String(rowData.notificationDate).trim() === '') {
      errors.push(`Row ${rowNum}: Notification Date is missing or empty`);
    } else if (!parseDate(String(rowData.notificationDate))) {
      errors.push(`Row ${rowNum}: Invalid date format. Use formats like 12-Jan-2025 or 2025-01-12`);
    }
  } else {
    // For Training Data: attendanceDate is mandatory
    if (!rowData.attendanceDate || String(rowData.attendanceDate).trim() === '') {
      errors.push(`Row ${rowNum}: Attendance Date is missing or empty`);
    } else if (!parseDate(String(rowData.attendanceDate))) {
      errors.push(`Row ${rowNum}: Invalid date format. Use formats like 12-Jan-2025 or 2025-01-12`);
    }
  }

  // Attendance Status validation (if present)
  if (rowData.attendanceStatus) {
    const status = String(rowData.attendanceStatus).trim().toLowerCase();
    const validStatuses = ['present', 'absent', 'p', 'a'];
    if (!validStatuses.includes(status)) {
      warnings.push(`Row ${rowNum}: Attendance Status "${rowData.attendanceStatus}" not standard (use Present/Absent)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Detect if a value is an Excel serial date (numeric > 1000)
 */
export const isExcelSerial = (val: any): boolean => 
  typeof val === 'number' && val > 1000;

/**
 * Convert Excel Serial Date to JS Date
 */
export const excelSerialToDate = (serial: number): Date => {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const result = new Date(excelEpoch.getTime() + serial * 86400000);
  return result;
};

/**
 * Parse date string or serial to YYYY-MM-DD with support for multiple formats:
 * - Excel Serial Numbers (numeric)
 * - YYYY-MM-DD
 * - DD-MMM-YYYY (12-Jan-2025)
 * - DD-MMM-YY (12-Jan-25)
 * - DD/MM/YYYY
 */
export function parseDate(dateVal: any): string | null {
  if (dateVal === undefined || dateVal === null || dateVal === '') return null;
  
  let d: Date;

  // 1. Handle Excel Serial Dates
  if (isExcelSerial(dateVal)) {
    d = excelSerialToDate(dateVal);
  } else {
    const str = String(dateVal).trim();

    // 2. Already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // 3. Handle DD-MMM-YYYY or DD-MMM-YY (e.g. 12-Jan-2025, 12-Jan-25)
    const dMmmY = /^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})$/i;
    const match = str.match(dMmmY);
    if (match) {
      const day = parseInt(match[1]);
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const month = monthNames.indexOf(match[2].toLowerCase());
      let year = parseInt(match[3]);
      if (year < 100) year += 2000; 

      d = new Date(year, month, day);
    } else {
      // 4. Fallback to standard Date object
      d = new Date(str);
    }
  }

  if (!isNaN(d.getTime())) {
    // Return formatted YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

/**
 * Validate date string (now uses parseDate internally)
 */
function isValidDate(dateStr: string): boolean {
  return parseDate(dateStr) !== null;
}

/**
 * Normalize attendance status to Present/Absent
 */
export function normalizeStatus(statusStr: string | null): string {
  if (!statusStr) return 'Present';
  const normalized = String(statusStr).trim().toLowerCase();
  return normalized === 'absent' || normalized === 'a' ? 'Absent' : 'Present';
}

/**
 * Normalize Score: Fraction → Percentage
 *
 * Rule:
 *   - If value is 0 < v <= 1.0 → multiply by 100 (fractional format from Excel)
 *   - If value is > 1  → already a percentage, keep as-is
 *   - If value is 0    → keep as 0 (attended but scored 0)
 *   - null / NaN       → null
 *
 * Applied ONLY in the data normalization layer (upload pipeline).
 * Never applied in UI or engines.
 */
export function normalizeScore(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined || isNaN(raw as number)) return null;
  const n = Number(raw);
  if (isNaN(n)) return null;
  // Fraction detection: values between 0 (exclusive) and 1 (inclusive)
  if (n > 0 && n <= 1) return Math.round(n * 100);
  // Already a percentage (0 or >1)
  return Math.round(n * 100) / 100; // keep two-decimal precision for percentage values
}

/**
 * Map row data from Excel headers to MongoDB fields
 */
export function mapRowToMongoDB(
  excelRow: Record<string, any>,
  excelHeaders: string[],
  templateType: string
): { mapped: Record<string, any>; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, any> = {
    trainingType: templateType,  // Default, may be overwritten by Excel
    _templateType: templateType  // Mandatory system field for validation
  };

  const scores: Record<string, number | null> = {};

  // Map each Excel column to MongoDB field
  excelHeaders.forEach(excelHeader => {
    const dbField = COLUMN_MAPPING[excelHeader];
    if (dbField) {
      let value = excelRow[excelHeader];

      // Parse date if it's a date field
      if (dbField.includes('Date')) {
        value = parseDate(value);
      }

      // Normalize status if it's attendance status
      if (dbField === 'attendanceStatus') {
        value = normalizeStatus(value);
      }

      // Specialized Numeric Interpretation for Scores
      // We check against the schema for the detected templateType
      const schema = getSchema(templateType);
      if (schema.scoreFields.includes(dbField)) {
        if (value !== undefined && value !== null && value !== '') {
          const num = Number(value);
          // ✅ Normalize fraction → percentage at the source (data layer only)
          scores[dbField] = isNaN(num) ? null : normalizeScore(num);
        } else {
          scores[dbField] = null;
        }
        // Also keep in root for legacy flat support if needed, but primary is nested scores
        mapped[dbField] = scores[dbField];
      } else if (dbField === 'notified') {
        const num = Number(value);
        mapped[dbField] = isNaN(num) ? null : num;
      } else {
        mapped[dbField] = value;
      }

      // Validation: If it's a numeric field but NOT in schema, warn (debugging only)
      if (dbField.toLowerCase().includes('score') && !schema.scoreFields.includes(dbField)) {
        console.warn(`[UPLOAD] Unmapped score field detected: ${dbField} for template ${templateType}`);
      }
    }
  });

  mapped.scores = scores;
  return { mapped, errors };
}

/**
 * Generate template download data (Excel rows)
 */
export function getTemplateForDownload(templateType: string): {
  headers: string[];
  description: string[];
  sample: Record<string, any>;
} {
  const templateSpecific = TEMPLATE_SPECIFIC_COLUMNS[templateType];
  if (!templateSpecific) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  const headers = [...COMMON_COLUMNS, ...templateSpecific];
  const description = headers.map(h => `${h} (required)` || '(optional)');

  const sample: Record<string, any> = {
    'Aadhaar Number': '123456789012',
    'Employee ID': 'EMP00001',
    'Mobile Number': '9876543210',
    'Trainer': 'Rajesh Kumar',
    'Team': 'Sales',
    'Name': 'John Doe',
    'Designation': 'Executive',
    'HQ': 'Mumbai',
    'State': 'Maharashtra',
    'Attendance Date': '2026-04-19',
    'Attendance Status': 'Present'
  };

  // Add template-specific sample data
  templateSpecific.forEach(col => {
    if (col.includes('Score')) {
      sample[col] = 85;
    } else if (col === 'Trainability Score') {
      sample[col] = 8.5;
    } else if (col === 'Notified') {
      sample[col] = 'Yes';
    } else if (col === 'AP Date') {
      sample[col] = '2026-03-15';
    } else {
      sample[col] = 'Sample Value';
    }
  });

  return { headers, description, sample };
}

/**
 * Get all available templates
 */
export function getAllTemplateTypes(): string[] {
  return Object.keys(TEMPLATE_SPECIFIC_COLUMNS);
}

/**
 * Generate debug log info
 */
export interface ParseDebugInfo {
  templateType: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  errors: Array<{ rowNum: number; error: string }>;
  sampleRecord?: Record<string, any>;
  normalization?: Record<string, number>;
  excluded?: number;
  caseFixes?: {
    teamNamesFormatted: number;
    teamExceptionsApplied: number;
    trainingTypeProtected: number;
  };
}

export function createDebugInfo(
  templateType: string,
  totalRows: number,
  validRows: number,
  rejectedRows: number,
  errors: Array<{ rowNum: number; error: string }>,
  sampleRecord?: Record<string, any>,
  normalization?: Record<string, number>,
  excluded?: number,
  caseFixes?: {
    teamNamesFormatted: number;
    teamExceptionsApplied: number;
    trainingTypeProtected: number;
  }
): ParseDebugInfo {
  return {
    templateType,
    totalRows,
    validRows,
    rejectedRows,
    errors: errors.slice(0, 5), // Keep first 5 errors
    sampleRecord,
    normalization,
    excluded,
    caseFixes
  };
}

