/**
 * Upload Template Definitions
 * Standardized schemas for each training type to eliminate data mismatches
 */

export interface TemplateColumn {
  name: string;           // Display name
  excelHeader: string;    // Exact header in Excel template
  dbField: string;        // MongoDB field name
  required: boolean;      // Is this field required?
  type: 'string' | 'date' | 'number' | 'status';
  description: string;
  format?: string;        // e.g., "YYYY-MM-DD" for dates
}

export interface UploadTemplate {
  trainingType: string;
  templateName: string;
  fileName: string;
  columns: TemplateColumn[];
  description: string;
}

// ─── STANDARD COLUMN DEFINITIONS (SHARED ACROSS ALL TEMPLATES) ──────────────
const STANDARD_COLUMNS: Record<string, TemplateColumn> = {
  employeeId: {
    name: 'Employee ID',
    excelHeader: 'Employee ID',
    dbField: 'employeeId',
    required: true,
    type: 'string',
    description: 'Unique employee identifier from Master'
  },
  employeeName: {
    name: 'Employee Name',
    excelHeader: 'Employee Name',
    dbField: 'name',
    required: false,
    type: 'string',
    description: 'Full name of employee'
  },
  trainingDate: {
    name: 'Training Date',
    excelHeader: 'Training Date',
    dbField: 'attendanceDate',
    required: true,
    type: 'date',
    format: 'YYYY-MM-DD',
    description: 'Date of training (YYYY-MM-DD format)'
  },
  attendanceStatus: {
    name: 'Attendance Status',
    excelHeader: 'Attendance Status',
    dbField: 'attendanceStatus',
    required: false,
    type: 'status',
    description: 'Present or Absent'
  },
  score: {
    name: 'Score',
    excelHeader: 'Score',
    dbField: 'score',
    required: false,
    type: 'number',
    description: 'Training score (0-100)'
  },
  batch: {
    name: 'Batch',
    excelHeader: 'Batch',
    dbField: 'batch',
    required: false,
    type: 'string',
    description: 'Training batch identifier'
  },
  trainerName: {
    name: 'Trainer Name',
    excelHeader: 'Trainer Name',
    dbField: 'trainerName',
    required: false,
    type: 'string',
    description: 'Name of trainer'
  },
  region: {
    name: 'Region',
    excelHeader: 'Region',
    dbField: 'region',
    required: false,
    type: 'string',
    description: 'Geographic region'
  }
};

// ─── TRAINING TYPE TEMPLATES ────────────────────────────────────────────────

export const UPLOAD_TEMPLATES: Record<string, UploadTemplate> = {
  AP: {
    trainingType: 'AP',
    templateName: 'Attendance Programme Training',
    fileName: 'AP_Training_Template.xlsx',
    description: 'Template for Attendance Programme (AP) training data',
    columns: [
      STANDARD_COLUMNS.employeeId,
      STANDARD_COLUMNS.employeeName,
      STANDARD_COLUMNS.trainingDate,
      STANDARD_COLUMNS.attendanceStatus,
      STANDARD_COLUMNS.score,
      STANDARD_COLUMNS.batch,
      STANDARD_COLUMNS.trainerName,
      STANDARD_COLUMNS.region
    ]
  },

  IP: {
    trainingType: 'IP',
    templateName: 'Induction Programme Training',
    fileName: 'IP_Training_Template.xlsx',
    description: 'Template for Induction Programme (IP) training data',
    columns: [
      STANDARD_COLUMNS.employeeId,
      STANDARD_COLUMNS.employeeName,
      STANDARD_COLUMNS.trainingDate,
      STANDARD_COLUMNS.attendanceStatus,
      STANDARD_COLUMNS.score,
      STANDARD_COLUMNS.batch,
      STANDARD_COLUMNS.trainerName,
      STANDARD_COLUMNS.region
    ]
  },

  Refresher: {
    trainingType: 'Refresher',
    templateName: 'Refresher Training',
    fileName: 'Refresher_Training_Template.xlsx',
    description: 'Template for Refresher training data',
    columns: [
      STANDARD_COLUMNS.employeeId,
      STANDARD_COLUMNS.employeeName,
      STANDARD_COLUMNS.trainingDate,
      STANDARD_COLUMNS.attendanceStatus,
      STANDARD_COLUMNS.score,
      STANDARD_COLUMNS.batch,
      STANDARD_COLUMNS.trainerName,
      STANDARD_COLUMNS.region
    ]
  },

  Capsule: {
    trainingType: 'Capsule',
    templateName: 'Capsule Training',
    fileName: 'Capsule_Training_Template.xlsx',
    description: 'Template for Capsule training data',
    columns: [
      STANDARD_COLUMNS.employeeId,
      STANDARD_COLUMNS.employeeName,
      STANDARD_COLUMNS.trainingDate,
      STANDARD_COLUMNS.attendanceStatus,
      STANDARD_COLUMNS.score,
      STANDARD_COLUMNS.batch,
      STANDARD_COLUMNS.trainerName,
      STANDARD_COLUMNS.region
    ]
  },

  MIP: {
    trainingType: 'MIP',
    templateName: 'Middle Management IP Training',
    fileName: 'MIP_Training_Template.xlsx',
    description: 'Template for Middle Management IP training data',
    columns: [
      STANDARD_COLUMNS.employeeId,
      STANDARD_COLUMNS.employeeName,
      STANDARD_COLUMNS.trainingDate,
      STANDARD_COLUMNS.attendanceStatus,
      STANDARD_COLUMNS.score,
      STANDARD_COLUMNS.batch,
      STANDARD_COLUMNS.trainerName,
      STANDARD_COLUMNS.region
    ]
  }
};

/**
 * Get template for a training type
 */
export function getTemplate(trainingType: string): UploadTemplate {
  const template = UPLOAD_TEMPLATES[trainingType];
  if (!template) {
    throw new Error(
      `Template not found for training type: ${trainingType}. ` +
      `Available types: ${Object.keys(UPLOAD_TEMPLATES).join(', ')}`
    );
  }
  return template;
}

/**
 * Build column header map from template
 * Maps exact Excel headers to database field names
 */
export function buildTemplateColumnMap(trainingType: string): Record<string, string> {
  const template = getTemplate(trainingType);
  const map: Record<string, string> = {};

  template.columns.forEach(col => {
    // Map exact Excel header to db field
    map[col.excelHeader] = col.dbField;
    // Also support variations with extra spaces
    map[col.excelHeader.trim().toLowerCase()] = col.dbField;
  });

  return map;
}

/**
 * Validate row against template
 * Returns array of errors if validation fails
 */
export function validateRowAgainstTemplate(
  row: Record<string, any>,
  trainingType: string
): { valid: boolean; errors: string[] } {
  const template = getTemplate(trainingType);
  const errors: string[] = [];

  // Check required fields
  template.columns.forEach(col => {
    const value = row[col.dbField] || row[col.excelHeader];
    
    if (col.required && (!value || String(value).trim() === '')) {
      errors.push(`Required field missing: "${col.name}"`);
    }

    // Type validation
    if (value && col.type === 'date') {
      if (!isValidDate(value)) {
        errors.push(`Invalid date format for "${col.name}": ${value}. Expected YYYY-MM-DD`);
      }
    }

    if (value && col.type === 'number') {
      if (isNaN(Number(value))) {
        errors.push(`Invalid number for "${col.name}": ${value}`);
      }
    }

    if (value && col.type === 'status') {
      const validStatuses = ['Present', 'Absent', 'p', 'a', 'yes', 'no', '1', '0'];
      if (!validStatuses.includes(String(value).toLowerCase())) {
        errors.push(`Invalid status for "${col.name}": ${value}. Use: Present/Absent`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if date string is valid
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  
  // Try YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Generate CSV representation of template for download
 */
export function generateTemplateCSV(trainingType: string): string {
  const template = getTemplate(trainingType);
  
  // Header row
  const headers = template.columns.map(col => `"${col.excelHeader}"`).join(',');
  
  // Example row with descriptions
  const example = template.columns
    .map(col => `"${col.description}"`)
    .join(',');

  return `${headers}\n${example}`;
}

/**
 * Generate sample data for template preview
 */
export function generateSampleTemplateData(trainingType: string, count: number = 3): Record<string, any>[] {
  const template = getTemplate(trainingType);
  const samples: Record<string, any>[] = [];

  for (let i = 1; i <= count; i++) {
    const row: Record<string, any> = {};

    template.columns.forEach(col => {
      switch (col.type) {
        case 'string':
          row[col.excelHeader] = col.name === 'Employee ID' ? `EMP${String(i).padStart(5, '0')}` : `Sample ${col.name} ${i}`;
          break;
        case 'date':
          row[col.excelHeader] = '2026-04-15';
          break;
        case 'number':
          row[col.excelHeader] = Math.floor(Math.random() * 100);
          break;
        case 'status':
          row[col.excelHeader] = i % 2 === 0 ? 'Present' : 'Absent';
          break;
        default:
          row[col.excelHeader] = '';
      }
    });

    samples.push(row);
  }

  return samples;
}
