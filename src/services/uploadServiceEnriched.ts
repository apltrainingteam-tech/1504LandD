/**
 * ✅ ENRICHED UPLOAD SERVICE - ACTIVE SYSTEM IN PRODUCTION
 * 
 * This is the MAIN upload service currently used by the application.
 * It is used by AttendanceUploadStrict, which is active in App.tsx.
 * 
 * KEY FEATURES:
 * ✓ Flexible validation: Accepts Employee ID, Aadhaar, or Mobile number
 * ✓ Master data enrichment: Automatically enriches rows with employee data
 * ✓ Excel date handling: Parses serial, ISO, and common date formats
 * ✓ Conflict detection: Identifies when identifiers conflict
 * ✓ Detailed error reporting: Row-level errors with status
 * ✓ Active/Inactive status: Tracks employment status for each row
 * 
 * VALIDATES (does NOT reject):
 * ✓ Rows without Employee ID (if Aadhaar/Mobile present)
 * ✓ Excel numeric dates (serial format)
 * ✓ Common date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
 * 
 * REPLACES:
 * ❌ uploadService (legacy)
 * ❌ uploadServiceStrict (strict-only, less flexible)
 * 
 * Orchestrates upload with master data enrichment, flexible validation, and comprehensive logging
 */

import { parseExcelFileEnriched, EnrichedParseResult, getValidRowsEnriched } from './parsingServiceEnriched';
import { createBatch, clearCollection } from './apiService';

/**
 * Upload progress callback
 */
export interface UploadProgressCallback {
  (progress: UploadProgress): void;
}

/**
 * Upload progress tracking
 */
export interface UploadProgress {
  stage: 'parsing' | 'validating' | 'uploading' | 'complete';
  processed: number;
  total: number;
  message: string;
}

/**
 * Upload result
 */
export interface UploadResultEnriched {
  success: boolean;
  templateType: string;
  totalRows: number;
  uploadedRows: number;
  rejectedRows: number;
  activeEmployees: number;
  inactiveEmployees: number;
  errors: Array<{ rowNum: number; message: string }>;
  warnings: string[];
  debugLog: string;
}

/**
 * Upload options
 */
export interface UploadOptionsEnriched {
  mode: 'append' | 'replace';
  chunkSize?: number;
  onProgress?: UploadProgressCallback;
}

/**
 * Upload training data with enrichment
 */
export async function uploadTrainingDataEnriched(
  file: File,
  options: UploadOptionsEnriched = { mode: 'append' }
): Promise<UploadResultEnriched> {
  const startTime = Date.now();
  const debugLog: string[] = [];
  
  // Helper to add debug log
  const log = (msg: string) => {
    console.log(msg);
    debugLog.push(msg);
  };

  log('[UPLOAD] Starting upload with enrichment...');

  const chunkSize = options.chunkSize || 100;
  const progressCallback = options.onProgress;

  try {
    // Progress: parsing
    if (progressCallback) {
      progressCallback({
        stage: 'parsing',
        processed: 0,
        total: 100,
        message: 'Parsing Excel file...'
      });
    }

    // Step 1: Parse file
    log('[UPLOAD] Parsing Excel file...');
    const parseResult = await parseExcelFileEnriched(file);

    log(`[UPLOAD] Parse complete - template: ${parseResult.templateType}`);
    log(`[UPLOAD] Total rows: ${parseResult.stats.totalRows}`);
    log(`[UPLOAD] Valid rows: ${parseResult.stats.validRows}`);
    log(`[UPLOAD] Rejected rows: ${parseResult.stats.rejectedRows}`);
    log(`[UPLOAD] Active employees: ${parseResult.stats.activeEmployees}`);
    log(`[UPLOAD] Inactive employees: ${parseResult.stats.inactiveEmployees}`);

    // Progress: validating
    if (progressCallback) {
      progressCallback({
        stage: 'validating',
        processed: 33,
        total: 100,
        message: `Validation complete: ${parseResult.stats.validRows} valid, ${parseResult.stats.rejectedRows} rejected`
      });
    }

    // Get valid rows
    const validRows = getValidRowsEnriched(parseResult);
    const errorRows = parseResult.rows.filter(r => r.status === 'error');

    // DEBUG: Log before upload
    log(`[UPLOAD] ✅ DEBUG: validRows.length = ${validRows.length}`);
    log(`[UPLOAD] ✅ DEBUG: errorRows.length = ${errorRows.length}`);
    if (validRows.length > 0) {
      log('[UPLOAD] ✅ DEBUG: First record to upload:');
      log(JSON.stringify(validRows[0], null, 2));
    } else {
      log('[UPLOAD] ⚠️ WARNING: NO VALID ROWS TO UPLOAD!');
    }

    log(`[UPLOAD] Found ${validRows.length} valid rows to upload`);

    if (validRows.length === 0) {
      log('[UPLOAD] ⚠️ No valid rows to upload');
      return {
        success: false,
        templateType: parseResult.templateType,
        totalRows: parseResult.stats.totalRows,
        uploadedRows: 0,
        rejectedRows: parseResult.stats.rejectedRows,
        activeEmployees: 0,
        inactiveEmployees: 0,
        errors: errorRows.map(r => ({ rowNum: r.rowNum, message: r.errors[0] || 'Unknown error' })),
        warnings: [`No valid rows found to upload`],
        debugLog: debugLog.join('\n')
      };
    }

    // Progress: uploading
    if (progressCallback) {
      progressCallback({
        stage: 'uploading',
        processed: 66,
        total: 100,
        message: `Uploading ${validRows.length} rows...`
      });
    }

    // Step 2: Clear collection if replace mode
    if (options.mode === 'replace') {
      log('[UPLOAD] Mode: REPLACE - clearing existing collection');
      await clearCollection('training_data');
    } else {
      log('[UPLOAD] Mode: APPEND - adding to existing collection');
    }

    // Step 3: Upload in chunks
    let uploadedCount = 0;
    log(`[UPLOAD] Uploading ${validRows.length} rows in chunks of ${chunkSize}...`);

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(validRows.length / chunkSize);

      try {
        log(`[UPLOAD] Chunk ${chunkNum}/${totalChunks}: Processing ${chunk.length} records...`);
        
        const batchResult = await createBatch('training_data', chunk);
        log(`[UPLOAD] ✅ Chunk ${chunkNum}/${totalChunks} SUCCESS: ${chunk.length} records uploaded`);
        
        uploadedCount += chunk.length;
        
        const progressPct = 66 + Math.floor((uploadedCount / validRows.length) * 33);
        if (progressCallback) {
          progressCallback({
            stage: 'uploading',
            processed: progressPct,
            total: 100,
            message: `Chunk ${chunkNum}/${totalChunks}: ${uploadedCount}/${validRows.length} rows uploaded`
          });
        }
      } catch (err: any) {
        log(`[UPLOAD] ❌ Chunk ${chunkNum}/${totalChunks} FAILED: ${err.message}`);
        throw new Error(`Chunk ${chunkNum} upload failed: ${err.message}`);
      }
    }

    log(`[UPLOAD] ✅ All ${uploadedCount} rows uploaded successfully`);

    // Progress: complete
    if (progressCallback) {
      progressCallback({
        stage: 'complete',
        processed: 100,
        total: 100,
        message: `Upload complete: ${uploadedCount} rows uploaded`
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`[UPLOAD] ⏱️  Duration: ${duration}s`);
    log('[UPLOAD] ✅ Upload complete');

    // Success result
    return {
      success: true,
      templateType: parseResult.templateType,
      totalRows: parseResult.stats.totalRows,
      uploadedRows: uploadedCount,
      rejectedRows: parseResult.stats.rejectedRows,
      activeEmployees: parseResult.stats.activeEmployees,
      inactiveEmployees: parseResult.stats.inactiveEmployees,
      errors: errorRows.map(r => ({ rowNum: r.rowNum, message: r.errors[0] || 'Unknown error' })),
      warnings: parseResult.rows
        .filter(r => r.status === 'valid' && r.warnings.length > 0)
        .flatMap(r => r.warnings.map(w => `Row ${r.rowNum}: ${w}`)),
      debugLog: debugLog.join('\n')
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Upload failed';
    log(`[UPLOAD] ❌ Error: ${errorMsg}`);
    
    return {
      success: false,
      templateType: 'UNKNOWN',
      totalRows: 0,
      uploadedRows: 0,
      rejectedRows: 0,
      activeEmployees: 0,
      inactiveEmployees: 0,
      errors: [{ rowNum: 0, message: errorMsg }],
      warnings: [],
      debugLog: debugLog.join('\n')
    };
  }
}

/**
 * Format upload result for display
 */
export function formatUploadResultEnriched(result: UploadResultEnriched): string {
  if (!result.success) {
    return `❌ Upload Failed\n${result.errors.map(e => `Row ${e.rowNum}: ${e.message}`).join('\n')}`;
  }

  const successRate = result.totalRows > 0 ? ((result.uploadedRows / result.totalRows) * 100).toFixed(1) : '0';

  return `
✅ Upload Successful

Template Type: ${result.templateType}
Total Rows: ${result.totalRows}
Uploaded: ${result.uploadedRows} ✅
Rejected: ${result.rejectedRows} ❌
Success Rate: ${successRate}%

Active Employees: ${result.activeEmployees}
Inactive Employees: ${result.inactiveEmployees}

${result.errors.length > 0 ? `❌ Errors (${result.errors.length}):\n${result.errors.slice(0, 5).map(e => `  Row ${e.rowNum}: ${e.message}`).join('\n')}` : ''}

${result.warnings.length > 0 ? `⚠️ Warnings (${result.warnings.length}):\n${result.warnings.slice(0, 5).join('\n')}` : ''}
  `.trim();
}

export default {
  uploadTrainingDataEnriched,
  formatUploadResultEnriched
};
