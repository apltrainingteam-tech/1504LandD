/**
 * ✅ ENHANCED PARSING SERVICE - ACTIVE SYSTEM IN PRODUCTION
 * 
 * This is the MAIN parser currently used by the application.
 * It is used by uploadServiceEnriched and AttendanceUploadStrict.
 * 
 * KEY FEATURES:
 * ✓ Template-driven parsing with master data enrichment
 * ✓ Flexible identity validation (Employee ID, Aadhaar, Mobile)
 * ✓ Excel date handling: parseExcelDate() supports multiple formats
 * ✓ Automatic master data enrichment
 * ✓ Conflict detection
 * ✓ Row-level validation and detailed error reporting
 * 
 * ACCEPTS (does NOT reject):
 * ✓ Rows without Employee ID (if Aadhaar/Mobile present)
 * ✓ Excel numeric dates (serial format)
 * ✓ ISO dates (YYYY-MM-DD)
 * ✓ Common formats (DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.)
 * 
 * REPLACES:
 * ❌ parsingService (legacy)
 * ❌ parsingServiceStrict (strict-only, less flexible)
 * 
 * Template-driven parsing with master data enrichment, flexible identity validation, and advanced date handling
 */

import * as XLSX from 'xlsx';
import { detectTemplateType, validateCommonColumns, validateTemplateColumns, mapRowToMongoDB, COLUMN_MAPPING } from './uploadTemplatesStrict';
import { parseExcelDate } from './dateParserService';
import { enrichRowWithMasterData, loadMasterData, clearCache } from './masterDataService';

/**
 * Parsed row with enrichment status
 */
export interface EnrichedRow {
  rowNum: number;
  status: 'valid' | 'error';
  data?: any;
  errors: string[];
  warnings: string[];
  employeeStatus?: 'Active' | 'Inactive';
  enrichmentSource?: string;
}

/**
 * Parse result with enrichment statistics
 */
export interface EnrichedParseResult {
  templateType: string;
  rows: EnrichedRow[];
  stats: {
    totalRows: number;
    validRows: number;
    rejectedRows: number;
    activeEmployees: number;
    inactiveEmployees: number;
  };
  debug: {
    templateType: string;
    commonColumnsValidated: boolean;
    templateColumnsValidated: boolean;
    masterDataLoaded: boolean;
    totalRows: number;
    validRows: number;
    rejectedRows: number;
    activeCount: number;
    inactiveCount: number;
    errors: Array<{ rowNum: number; message: string }>;
    sampleRecord?: any;
  };
}

/**
 * Parse Excel file with template detection, master data enrichment, and flexible validation
 */
export async function parseExcelFileEnriched(file: File): Promise<EnrichedParseResult> {
  console.log('[PARSER] Starting enhanced parse with enrichment...');
  console.log(`[PARSER] File: ${file.name}`);

  const errors: Array<{ rowNum: number; message: string }> = [];

  try {
    // Step 1: Load Excel file
    console.log('[PARSER] Loading Excel file...');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { cellDates: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (json.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = json[0] as string[];
    const dataRows = json.slice(1);

    console.log(`[PARSER] Headers: ${headers.join(', ')}`);
    console.log(`[PARSER] Total data rows: ${dataRows.length}`);

    // Step 2: Detect template type (strict)
    console.log('[PARSER] Detecting template type...');
    let templateType: string;
    try {
      templateType = detectTemplateType(headers);
      console.log(`[PARSER] ✅ Template type detected: ${templateType}`);
    } catch (err: any) {
      throw new Error(`Template detection failed: ${err.message}`);
    }

    // Step 3: Validate common columns (strict)
    console.log('[PARSER] Validating common columns...');
    try {
      validateCommonColumns(headers);
      console.log('[PARSER] ✅ All common columns present');
    } catch (err: any) {
      throw new Error(`Common column validation failed: ${err.message}`);
    }

    // Step 4: Validate template-specific columns
    console.log('[PARSER] Validating template-specific columns...');
    try {
      validateTemplateColumns(headers, templateType);
      console.log('[PARSER] ✅ Template columns valid');
    } catch (err: any) {
      throw new Error(`Template column validation failed: ${err.message}`);
    }

    // Step 5: Load master data for enrichment
    console.log('[PARSER] Loading master data for enrichment...');
    let masterDataLoaded = false;
    try {
      await loadMasterData();
      masterDataLoaded = true;
      console.log('[PARSER] ✅ Master data loaded');
    } catch (err) {
      console.warn('[PARSER] ⚠️ Could not load master data - enrichment disabled:', err);
      // Don't fail - enrichment is optional
    }

    // Step 6: Parse rows with enrichment and flexible validation
    console.log('[PARSER] Parsing rows with enrichment...');
    const rows: EnrichedRow[] = [];
    let validCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const rowNum = rowIndex + 2; // Excel row number (header is row 1)
      const rowData = dataRows[rowIndex];

      if (!rowData || rowData.length === 0) {
        continue; // Skip empty rows
      }

      const enrichedRow: EnrichedRow = {
        rowNum,
        status: 'valid',
        errors: [],
        warnings: []
      };

      try {
        // Convert row array to object using headers
        const rowObject: Record<string, any> = {};
        for (let i = 0; i < headers.length; i++) {
          rowObject[headers[i]] = rowData[i];
        }

        // Extract identity fields
        const employeeId = rowObject['Employee ID'];
        const aadhaarNumber = rowObject['Aadhaar Number'];
        const mobileNumber = rowObject['Mobile Number'];

        // Step 6a: FLEXIBLE IDENTITY VALIDATION
        // Row is valid if ANY ONE identifier is present
        const hasAnyId = employeeId || aadhaarNumber || mobileNumber;
        if (!hasAnyId) {
          throw new Error('No identifier present (need Employee ID, Aadhaar, or Mobile)');
        }

        // Step 6b: Parse and validate date
        const attendanceDateRaw = rowObject['Attendance Date'];
        let attendanceDate: string;
        try {
          attendanceDate = parseExcelDate(attendanceDateRaw);
        } catch (err: any) {
          throw new Error(`Date parsing failed: ${err.message}`);
        }

        // Step 6c: Map to MongoDB field names
        const mappedRow = mapRowToMongoDB(rowObject, headers, templateType);
        mappedRow.attendanceDate = attendanceDate;
        mappedRow.trainingType = templateType;

        // Step 6d: Master data enrichment (if available)
        let employeeStatus: 'Active' | 'Inactive' = 'Inactive';
        let enrichmentSource = 'Not enriched (master data unavailable)';

        if (masterDataLoaded) {
          try {
            const enrichResult = await enrichRowWithMasterData(
              mappedRow,
              employeeId,
              aadhaarNumber,
              mobileNumber
            );

            mappedRow.employeeStatus = enrichResult.status;
            employeeStatus = enrichResult.status;
            enrichmentSource = enrichResult.source || '';
            
            // Merge enriched fields
            Object.assign(mappedRow, enrichResult.enriched);

            console.log(
              `[PARSER] Row ${rowNum}: ✅ Enriched (${employeeStatus} - ${enrichmentSource})`
            );
          } catch (enrichErr: any) {
            throw new Error(`Enrichment failed: ${enrichErr.message}`);
          }
        }

        // Row is valid
        enrichedRow.data = mappedRow;
        enrichedRow.employeeStatus = employeeStatus;
        enrichedRow.enrichmentSource = enrichmentSource;
        enrichedRow.status = 'valid';
        validCount++;

        if (employeeStatus === 'Active') {
          activeCount++;
        } else {
          inactiveCount++;
        }

        // Log sample record
        if (validCount === 1) {
          console.log('[PARSER] Sample valid record:', mappedRow);
        }
      } catch (err: any) {
        enrichedRow.status = 'error';
        enrichedRow.errors.push(err.message);
        const errorMsg = `Row ${rowNum}: ${err.message}`;
        errors.push({ rowNum, message: err.message });
        console.warn(`[PARSER] ${errorMsg}`);
      }

      rows.push(enrichedRow);
    }

    // Step 7: Log summary
    const rejectedCount = rows.length - validCount;
    console.log('[PARSER] ✅ Parse complete');
    console.log(`[PARSER] Total rows: ${rows.length}`);
    console.log(`[PARSER] Valid rows: ${validCount}`);
    console.log(`[PARSER] Rejected rows: ${rejectedCount}`);
    console.log(`[PARSER] Active employees: ${activeCount}`);
    console.log(`[PARSER] Inactive employees: ${inactiveCount}`);

    if (errors.length > 0) {
      console.log(`[PARSER] First 5 errors:`);
      errors.slice(0, 5).forEach(e => {
        console.log(`  ${e.message}`);
      });
    }

    // DEBUG: Log validRows details
    const validRows = rows.filter(r => r.status === 'valid' && r.data);
    console.log(`[PARSER] ✅ DEBUG: validRows.length = ${validRows.length}`);
    if (validRows.length > 0) {
      console.log('[PARSER] ✅ DEBUG: Sample valid row:', JSON.stringify(validRows[0].data, null, 2));
    } else {
      console.log('[PARSER] ⚠️ DEBUG: NO VALID ROWS FOUND!');
    }

    // Return result
    const result = {
      templateType,
      rows,
      stats: {
        totalRows: rows.length,
        validRows: validCount,
        rejectedRows: rejectedCount,
        activeEmployees: activeCount,
        inactiveEmployees: inactiveCount
      },
      debug: {
        templateType,
        commonColumnsValidated: true,
        templateColumnsValidated: true,
        masterDataLoaded,
        totalRows: rows.length,
        validRows: validCount,
        rejectedRows: rejectedCount,
        activeCount,
        inactiveCount,
        errors: errors.slice(0, 10),
        sampleRecord: rows.find(r => r.status === 'valid')?.data
      }
    };

    console.log('[PARSER] ✅ Returning parseResult:', result);
    return result;
  } catch (error: any) {
    console.error('[PARSER] Parse error:', error);
    throw error;
  } finally {
    // Clear cache after parsing
    clearCache();
  }
}

/**
 * Get valid rows from parse result
 */
export function getValidRowsEnriched(result: EnrichedParseResult): any[] {
  console.log('[PARSER] getValidRowsEnriched() called');
  console.log(`[PARSER]   - Input result.rows.length: ${result.rows.length}`);
  console.log(`[PARSER]   - Input result.stats.validRows: ${result.stats.validRows}`);
  
  const validRows = result.rows.filter(r => r.status === 'valid' && r.data).map(r => r.data!);
  
  console.log(`[PARSER] ✅ Extracted validRows.length: ${validRows.length}`);
  if (validRows.length > 0) {
    console.log('[PARSER] ✅ First valid row:', JSON.stringify(validRows[0], null, 2));
    console.log(`[PARSER] ✅ Last valid row keys:`, Object.keys(validRows[validRows.length - 1]));
  } else {
    console.log('[PARSER] ⚠️ WARNING: NO VALID ROWS EXTRACTED!');
  }
  
  return validRows;
}

/**
 * Get error rows from parse result
 */
export function getErrorRowsEnriched(result: EnrichedParseResult): EnrichedRow[] {
  return result.rows.filter(r => r.status === 'error');
}

export default {
  parseExcelFileEnriched,
  getValidRowsEnriched,
  getErrorRowsEnriched
};
