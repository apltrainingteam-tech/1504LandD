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
  'State',
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
  Capsule: ['Test Score'],
  Refresher: ['Knowledge', 'Situation Handling', 'Presentation']
};

// ─── TEMPLATE DETECTION RULES (STRICT) ───────────────────────────────────────
export function detectTemplateType(excelHeaders: string[]): string {
  const headerSet = new Set(excelHeaders.map(h => h.trim()));

  // Detection rules in priority order (most specific first)
  if (headerSet.has('Trainability Score')) return 'IP';
  if (headerSet.has('BSE')) return 'AP';
  if (headerSet.has('AP Date')) return 'PreAP';
  if (headerSet.has('Science Score')) return 'MIP';
  if (headerSet.has('Situation Handling')) return 'Refresher';
  if (headerSet.has('Test Score') && !headerSet.has('Trainability Score') && !headerSet.has('BSE')) return 'Capsule';

  throw new Error(
    `❌ Template type cannot be determined. Unique columns not found.\n` +
    `Available headers: ${excelHeaders.join(', ')}\n` +
    `Expected one of:\n` +
    `  - "Trainability Score" for IP\n` +
    `  - "BSE" for AP\n` +
    `  - "AP Date" for PreAP\n` +
    `  - "Science Score" for MIP\n` +
    `  - "Situation Handling" for Refresher\n` +
    `  - "Test Score" (alone) for Capsule`
  );
}

// ─── EXACT COLUMN MAPPING (EXCEL HEADER → MONGODB FIELD) ──────────────────────
export const COLUMN_MAPPING: Record<string, string> = {
  // Common fields
  'Aadhaar Number': 'aadhaarNumber',
  'Employee ID': 'employeeId',
  'Mobile Number': 'mobileNumber',
  'Trainer': 'trainer',
  'Team': 'team',
  'Name': 'name',
  'Designation': 'designation',
  'HQ': 'hq',
  'State': 'state',
  'Attendance Date': 'attendanceDate',
  'Attendance Status': 'attendanceStatus',

  // IP template
  'Detailing': 'detailingScore',
  'Test Score': 'testScore',
  'Trainability Score': 'trainabilityScore',

  // AP template
  'Knowledge': 'knowledgeScore',
  'BSE': 'bseScore',
  'Grasping': 'graspingScore',
  'Participation': 'participationScore',
  'Detailing & Presentation': 'detailingPresentationScore',
  'Role Play': 'rolePlayScore',
  'Punctuality': 'punctualityScore',
  'Grooming & Dress Code': 'groomingScore',
  'Behaviour': 'behaviourScore',

  // PreAP template
  'AP Date': 'apDate',
  'Notified': 'notified',

  // MIP template
  'Science Score': 'scienceScore',
  'Skill Score': 'skillScore',

  // Refresher template
  'Situation Handling': 'situationHandlingScore',
  'Presentation': 'presentationScore'
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

  // Check for at least one template-specific column (graceful degradation)
  const foundCols = templateCols.filter(col => headerSet.has(col));
  if (foundCols.length === 0) {
    warnings.push(`⚠️ No ${templateType} template columns found. Expected at least one of: ${templateCols.join(', ')}`);
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

  // MANDATORY: Employee ID
  if (!rowData.employeeId || String(rowData.employeeId).trim() === '') {
    errors.push(`Row ${rowNum}: Employee ID is missing or empty`);
  }

  // MANDATORY: Attendance Date (must be valid date)
  if (!rowData.attendanceDate || String(rowData.attendanceDate).trim() === '') {
    errors.push(`Row ${rowNum}: Attendance Date is missing or empty`);
  } else {
    // Validate date format (YYYY-MM-DD or other common formats)
    const dateStr = String(rowData.attendanceDate).trim();
    if (!isValidDate(dateStr)) {
      errors.push(`Row ${rowNum}: Attendance Date "${dateStr}" is invalid. Use YYYY-MM-DD format`);
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
 * Validate date string
 */
function isValidDate(dateStr: string): boolean {
  // Try multiple date formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/   // DD-MM-YYYY
  ];

  for (const fmt of formats) {
    if (fmt.test(dateStr)) {
      const date = new Date(dateStr);
      return date instanceof Date && !isNaN(date.getTime());
    }
  }

  return false;
}

/**
 * Parse date string to YYYY-MM-DD
 */
export function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const str = String(dateStr).trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try parsing with Date object
  const date = new Date(str);
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
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
 * Map row data from Excel headers to MongoDB fields
 */
export function mapRowToMongoDB(
  excelRow: Record<string, any>,
  excelHeaders: string[],
  templateType: string
): { mapped: Record<string, any>; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, any> = {
    trainingType: templateType  // Add system field
  };

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

      // Parse numeric scores
      if (dbField.includes('Score') || dbField === 'notified') {
        if (value && value !== '') {
          const num = Number(value);
          value = isNaN(num) ? null : num;
        } else {
          value = null;
        }
      }

      mapped[dbField] = value;
    }
  });

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
}

export function createDebugInfo(
  templateType: string,
  totalRows: number,
  validRows: number,
  rejectedRows: number,
  errors: Array<{ rowNum: number; error: string }>,
  sampleRecord?: Record<string, any>
): ParseDebugInfo {
  return {
    templateType,
    totalRows,
    validRows,
    rejectedRows,
    errors: errors.slice(0, 5), // Keep first 5 errors
    sampleRecord
  };
}
