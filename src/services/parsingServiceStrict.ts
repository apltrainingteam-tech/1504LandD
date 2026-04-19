/**
 * STRICT EXCEL PARSER - Zero Ambiguity, No Fallback Logic
 * 
 * - Detects template type from unique columns (strict rules)
 * - Validates headers against common + template-specific columns
 * - Maps columns exactly using provided mapping
 * - Validates every row (no silent failures)
 * - Returns detailed errors with row numbers
 */

import * as XLSX from 'xlsx';
import {
  detectTemplateType,
  validateCommonColumns,
  validateTemplateColumns,
  validateRow,
  mapRowToMongoDB,
  COLUMN_MAPPING,
  COMMON_COLUMNS,
  TEMPLATE_SPECIFIC_COLUMNS,
  parseDate,
  normalizeStatus,
  createDebugInfo,
  ParseDebugInfo
} from './uploadTemplatesStrict';

export interface ParsedRowStrict {
  rowNum: number;
  data?: Record<string, any>;
  status: 'valid' | 'error';
  errors: string[];
  warnings: string[];
}

export interface ParseResult {
  templateType: string;
  rows: ParsedRowStrict[];
  debug: ParseDebugInfo;
}

/**
 * MAIN: Parse Excel file with strict template validation
 */
export async function parseExcelFileStrict(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) {
          throw new Error('❌ Excel sheet is empty. No data rows found.');
        }

        console.log(`[PARSER] Loaded ${json.length} rows from Excel`);

        // ─────────────────────────────────────────────────────────────────
        // STEP 1: DETECT TEMPLATE TYPE (STRICT)
        // ─────────────────────────────────────────────────────────────────
        const excelHeaders = Object.keys(json[0]);
        console.log(`[PARSER] Excel headers:`, excelHeaders);

        let templateType: string;
        try {
          templateType = detectTemplateType(excelHeaders);
          console.log(`[PARSER] ✅ Template type detected: ${templateType}`);
        } catch (detectionError: any) {
          throw new Error(`❌ Template detection failed: ${detectionError.message}`);
        }

        // ─────────────────────────────────────────────────────────────────
        // STEP 2: VALIDATE HEADERS (STRICT)
        // ─────────────────────────────────────────────────────────────────
        const commonValidation = validateCommonColumns(excelHeaders);
        if (!commonValidation.valid) {
          const errorMsg = commonValidation.errors.join('\n');
          throw new Error(`❌ Common column validation failed:\n${errorMsg}`);
        }
        console.log(`[PARSER] ✅ All common columns present`);

        const templateValidation = validateTemplateColumns(excelHeaders, templateType);
        if (templateValidation.warnings.length > 0) {
          console.warn(`[PARSER] ⚠️ Template validation warnings:`, templateValidation.warnings);
        }

        // ─────────────────────────────────────────────────────────────────
        // STEP 3: PARSE ROWS WITH STRICT VALIDATION
        // ─────────────────────────────────────────────────────────────────
        const parsedRows: ParsedRowStrict[] = [];
        const rowErrors: Array<{ rowNum: number; error: string }> = [];
        let validCount = 0;

        json.forEach((excelRow, idx) => {
          const rowNum = idx + 2; // +2 because row 1 is headers, xlsx rows are 0-indexed

          try {
            // Map Excel row to MongoDB fields
            const { mapped: mongoData, errors: mapErrors } = mapRowToMongoDB(
              excelRow,
              excelHeaders,
              templateType
            );

            // Validate row data (strict mode)
            const validation = validateRow(mongoData, rowNum);

            if (!validation.valid) {
              // Row has errors → reject it
              const errorMsg = validation.errors.join('; ');
              console.error(`[PARSER] Row ${rowNum} rejected:`, errorMsg);

              parsedRows.push({
                rowNum,
                status: 'error',
                errors: validation.errors,
                warnings: validation.warnings
              });

              rowErrors.push({ rowNum, error: errorMsg });
            } else {
              // Row is valid
              validCount++;

              parsedRows.push({
                rowNum,
                data: mongoData,
                status: 'valid',
                errors: [],
                warnings: validation.warnings
              });

              if (validCount === 1) {
                console.log(`[PARSER] Sample parsed row:`, mongoData);
              }
            }
          } catch (rowError: any) {
            const errorMsg = rowError?.message || 'Unknown error';
            console.error(`[PARSER] Row ${rowNum} error:`, errorMsg);

            parsedRows.push({
              rowNum,
              status: 'error',
              errors: [errorMsg],
              warnings: []
            });

            rowErrors.push({ rowNum, error: errorMsg });
          }
        });

        // ─────────────────────────────────────────────────────────────────
        // STEP 4: GENERATE RESULT
        // ─────────────────────────────────────────────────────────────────
        const rejectedCount = parsedRows.filter(r => r.status === 'error').length;

        console.log(`[PARSER] ✅ Parse complete`);
        console.log(`[PARSER] Total rows: ${json.length}`);
        console.log(`[PARSER] Valid rows: ${validCount}`);
        console.log(`[PARSER] Rejected rows: ${rejectedCount}`);

        if (rejectedCount > 0) {
          console.log(`[PARSER] First 5 errors:`, rowErrors.slice(0, 5));
        }

        const debugInfo = createDebugInfo(
          templateType,
          json.length,
          validCount,
          rejectedCount,
          rowErrors,
          parsedRows.find(r => r.status === 'valid')?.data
        );

        resolve({
          templateType,
          rows: parsedRows,
          debug: debugInfo
        });
      } catch (err: any) {
        const errorMsg = err?.message || 'Unknown error during parsing';
        console.error(`[PARSER] Fatal error:`, errorMsg);
        reject(new Error(`Parse failed: ${errorMsg}`));
      }
    };

    reader.onerror = (err) => {
      console.error('[PARSER] File read error:', err);
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract valid rows from parse result
 */
export function getValidRows(result: ParseResult): Record<string, any>[] {
  return result.rows
    .filter(r => r.status === 'valid' && r.data)
    .map(r => r.data!);
}

/**
 * Extract error rows from parse result
 */
export function getErrorRows(
  result: ParseResult
): Array<{ rowNum: number; errors: string[]; warnings: string[] }> {
  return result.rows
    .filter(r => r.status === 'error')
    .map(r => ({
      rowNum: r.rowNum,
      errors: r.errors,
      warnings: r.warnings
    }));
}

/**
 * Get summary of parse result
 */
export function getSummary(result: ParseResult): {
  templateType: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  successRate: string;
} {
  const validRows = result.rows.filter(r => r.status === 'valid').length;
  const rejectedRows = result.rows.filter(r => r.status === 'error').length;
  const total = result.rows.length;
  const rate = total > 0 ? ((validRows / total) * 100).toFixed(1) : '0';

  return {
    templateType: result.templateType,
    totalRows: total,
    validRows,
    rejectedRows,
    successRate: `${rate}%`
  };
}
