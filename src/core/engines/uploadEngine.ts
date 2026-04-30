/**
 * STRICT UPLOAD SERVICE
 * 
 * - Uses strict parser (zero ambiguity)
 * - Stores all data in single "training_data" collection (flat records)
 * - No silent failures
 * - Comprehensive error reporting
 */

/**
 * STRICT UPLOAD SERVICE
 * 
 * - Uses strict parser (zero ambiguity)
 * - Stores all data in single "training_data" collection (flat records)
 * - No silent failures
 * - Comprehensive error reporting
 */

import { parseExcelFileStrict, getValidRows, getErrorRows, getSummary, ParseResult } from './parsingEngine';
import { addBatch, getCollection } from './apiClient';
import { traceEngine } from '../debug/traceEngine';
import { NotificationRecord } from '../../types/attendance';

export interface UploadOptions {
  mode: 'append';
  chunkSize?: number;           // batch size for MongoDB operations
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  stage: 'parsing' | 'validating' | 'uploading' | 'complete';
  processed: number;
  total: number;
  message: string;
}

export interface UploadResult {
  success: boolean;
  templateType: string;
  totalRows: number;
  uploadedRows: number;
  rejectedRows: number;
  activeEmployees: number;
  inactiveEmployees: number;
  errors: Array<{ rowNum: number; message: string }>;
  warnings: Array<{ rowNum: number; message: string }>;
  debugLog: string;
  isBaseline?: boolean;
}

/**
 * UPLOAD FUNCTION
 * 
 * 1. Parse Excel file with strict validation
 * 2. Report validation errors immediately
 * 3. Upload valid rows to MongoDB
 * 4. Return detailed result
 */
export const uploadTrainingDataStrict = traceEngine("uploadTrainingDataStrict", async (
  file: File,
  options: UploadOptions = { mode: 'append' }
): Promise<UploadResult> => {
  const chunkSize = options.chunkSize || 50;
  const debugLog: string[] = [];

  try {
    // ───────────────────────────────────────────────────────────────────
    // STAGE 1: PARSE EXCEL FILE
    // ───────────────────────────────────────────────────────────────────
    console.log(`[UPLOAD] Starting upload: mode=${options.mode}, file=${file.name}`);
    debugLog.push(`[UPLOAD] Starting upload: mode=${options.mode}, file=${file.name}`);

    if (options.onProgress) {
      options.onProgress({
        stage: 'parsing',
        processed: 0,
        total: 100,
        message: 'Parsing Excel file...'
      });
    }

    let parseResult: ParseResult;
    try {
      parseResult = await parseExcelFileStrict(file);
      debugLog.push(`[UPLOAD] ✅ Parse complete: template=${parseResult.templateType}`);
    } catch (parseError: any) {
      const errorMsg = parseError?.message || 'Parse failed';
      debugLog.push(`[UPLOAD] ❌ Parse error: ${errorMsg}`);
      throw new Error(`Parse failed: ${errorMsg}`);
    }

    // ───────────────────────────────────────────────────────────────────
    // STAGE 2: VALIDATE & COLLECT ERRORS
    // ───────────────────────────────────────────────────────────────────
    if (options.onProgress) {
      options.onProgress({
        stage: 'validating',
        processed: 50,
        total: 100,
        message: 'Validating data...'
      });
    }

    const validRowsRaw = getValidRows(parseResult);
    const errorRows = getErrorRows(parseResult);
    const summary = getSummary(parseResult);

    debugLog.push(`[UPLOAD] Validation summary: ${JSON.stringify(summary)}`);

    // ─── STAGE 2.5: EMPLOYEE MASTER VALIDATION (STRICT) ───
    // Fix: Using 'employees' collection to match MasterDataContext and Employees module
    const employees = await getCollection('employees');
    
    // Advanced normalization helper: handles scientific notation, leading zeros, and non-printable chars
    const norm = (v: any) => {
      if (v === undefined || v === null) return '';
      // 1. Convert to string and trim
      let s = String(v).trim().toLowerCase();
      // 2. Remove non-printable/hidden characters
      s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      // 3. Handle scientific notation (e.g. 8.45E+4 -> 84500)
      if (s.includes('e+')) {
        const num = Number(s);
        if (!isNaN(num)) s = String(num);
      }
      // 4. Remove leading zeros for ID matching (00123 -> 123)
      return s.replace(/^0+/, '');
    };

    // Build lookup maps
    const idMap = new Map();
    const aadhaarMap = new Map();
    const mobileMap = new Map();

    employees.forEach(e => {
      const nid = norm(e.employeeId);
      const nad = norm(e.aadhaarNumber);
      const nmb = norm(e.mobileNumber);
      
      if (nid) idMap.set(nid, e);
      if (nad) aadhaarMap.set(nad, e);
      if (nmb) mobileMap.set(nmb, e);
    });
    
    const mapStats = `IDs=${idMap.size}, Aadhaar=${aadhaarMap.size}, Mobile=${mobileMap.size}`;
    console.log(`[UPLOAD] Lookup maps built: ${mapStats}`);
    debugLog.push(`[UPLOAD] Lookup maps built: ${mapStats}`);

    // Valid training types (standardized)
    const VALID_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PreAP', 'GTG', 'HO', 'RTM'];
    const typeSet = new Set(VALID_TRAINING_TYPES.map(t => t.toLowerCase()));

    const isNotificationHistory = parseResult.templateType === 'NotificationHistory';
    const collectionName = isNotificationHistory ? 'notification_history' : 'training_data';

    let activeEmployees = 0;
    let inactiveEmployees = 0;
    let mismatchCount = 0;
    const finalValidRows: any[] = [];
    const mismatchSamples: string[] = [];

    validRowsRaw.forEach((row, idx) => {
      // 1. Multi-identifier lookup logic
      const rid = norm(row.employeeId);
      const rad = norm(row.aadhaarNumber);
      const rmb = norm(row.mobileNumber);

      let emp = idMap.get(rid);
      if (!emp && rad) emp = aadhaarMap.get(rad);
      if (!emp && rmb) emp = mobileMap.get(rmb);
      
      if (!emp) {
        // ─── SPECIAL HANDLING: NOTIFICATION HISTORY ───
        // For historical records, we allow employees NOT in the current master roster.
        if (isNotificationHistory) {
          activeEmployees++; // Count as success for history
          finalValidRows.push({
            ...row,
            employeeId: String(row.employeeId).trim(),
            _masterStatus: 'unlinked', // Tag for UI identification
            _isHistorical: true
          });
          return;
        }

        mismatchCount++;
        if (mismatchSamples.length < 5) {
          const sample = `Row ${idx+2}: [ID:${row.employeeId}, Aadhaar:${row.aadhaarNumber || 'N/A'}]`;
          mismatchSamples.push(sample);
          console.warn(`[UPLOAD] Mismatch: ${sample}`);
          debugLog.push(`[UPLOAD] ❌ Mismatch: ${sample} -> Not found in Master`);
        }
        
        errorRows.push({
          rowNum: idx + 2,
          errors: [`Employee record not found in active master roster.`],
          warnings: []
        });
        return;
      }

      // Check Active status (Only for current training data, history allows inactive)
      const status = String(emp.status || 'Active').toLowerCase();
      if (!isNotificationHistory && status !== 'active') {
        inactiveEmployees++;
        if (inactiveEmployees <= 5) {
            debugLog.push(`[UPLOAD] ⚠️ Row ${idx+2}: Employee ${emp.employeeId} is ${emp.status}`);
        }
        errorRows.push({
          rowNum: idx + 2,
          errors: [`Employee ${emp.employeeId} (${emp.name}) is marked ${emp.status || 'Inactive'}`],
          warnings: []
        });
        return;
      }

      // 2. Training Type validation (for NotificationHistory)
      if (isNotificationHistory) {
        const tType = String(row.trainingType || '').trim().toLowerCase();
        if (!tType || !typeSet.has(tType)) {
          errorRows.push({
            rowNum: idx + 2,
            errors: [`Invalid Training Type: "${row.trainingType}"`],
            warnings: []
          });
          return;
        }
      }

      // Success: Augment row with canonical master data to ensure ID consistency
      activeEmployees++;
      finalValidRows.push({
        ...row,
        employeeId: emp.employeeId, // Use canonical ID from master
        aadhaarNumber: emp.aadhaarNumber,
        name: emp.name,
        team: emp.team || row.team,
        state: emp.state || row.state,
        hq: emp.hq || row.hq,
        _masterStatus: 'linked'
      });
    });

    // ─── FAIL FAST CHECK ───
    // For Notification History, we never fail fast because many employees might be missing from Master
    if (!isNotificationHistory && activeEmployees === 0 && validRowsRaw.length > 0) {
      const totalRejected = mismatchCount + inactiveEmployees;
      const errorMsg = `❌ High Match Failure (${totalRejected}/${validRowsRaw.length} rows rejected).\n` +
                       `Details: ${mismatchCount} Not Found, ${inactiveEmployees} Inactive.\n` +
                       `Check if Employee IDs in Excel match the Master Roster.\n` +
                       `Samples:\n${mismatchSamples.join('\n')}`;
      debugLog.push(`[UPLOAD] Fatal: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (finalValidRows.length === 0) {
      throw new Error(
        `❌ No valid rows after employee validation.\n` +
        `Matched/Allowed: ${activeEmployees}\n` +
        `Not Found: ${mismatchCount}`
      );
    }

    const validRows = finalValidRows;

    // ───────────────────────────────────────────────────────────────────
    // STAGE 3: UPLOAD TO MONGODB
    // ───────────────────────────────────────────────────────────────────
    if (options.onProgress) {
      options.onProgress({
        stage: 'uploading',
        processed: 60,
        total: 100,
        message: `Uploading ${validRows.length} valid rows to MongoDB...`
      });
    }

    let uploadedCount = 0;
    // activeEmployees and inactiveEmployees are already calculated above

    try {
      const uploadBatchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Upload in chunks
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        const chunkNum = Math.floor(i / chunkSize) + 1;

        try {
          // Create _id and prepare documents
          const docsToInsert = chunk.map(row => {
            let _id = '';
            if (isNotificationHistory) {
              // Deduplicate on (employeeId + trainingType + notificationDate + optional trainingId)
              const tId = row.trainingId ? `_${row.trainingId}` : '';
              _id = `hist_${row.employeeId}_${row.trainingType}_${row.notificationDate}${tId}`;
            } else {
              _id = `att_${row.employeeId}_${row.trainingType}_${row.attendanceDate}`;
            }

            return {
              _id,
              ...row,
              // Notification records don't have attendance status during upload
              attended: isNotificationHistory ? false : (row.attended || false), 
              isVoided: false,
              uploadBatchId,
              uploadedAt: new Date().toISOString(),
              uploadedBy: 'system'
            };

          });

          // Upload batch via API (backend handles upsert)
          await addBatch(collectionName, docsToInsert);
          uploadedCount += chunk.length;

          console.log(`[UPLOAD] Chunk ${chunkNum}: ${uploadedCount}/${validRows.length} rows uploaded`);
          debugLog.push(`[UPLOAD] Chunk ${chunkNum}: ${uploadedCount}/${validRows.length} rows`);

          if (options.onProgress) {
            const progress = 60 + (uploadedCount / validRows.length) * 35;
            options.onProgress({
              stage: 'uploading',
              processed: Math.floor(progress),
              total: 100,
              message: `Uploading... ${uploadedCount}/${validRows.length}`
            });
          }
        } catch (chunkError: any) {
          const errorMsg = chunkError?.message || 'Chunk upload failed';
          console.error(`[UPLOAD] Chunk ${chunkNum} error:`, errorMsg);
          debugLog.push(`[UPLOAD] ❌ Chunk ${chunkNum} error: ${errorMsg}`);
          throw new Error(`Chunk ${chunkNum} upload failed: ${errorMsg}`);
        }
      }

      console.log(`[UPLOAD] ✅ All ${uploadedCount} rows uploaded successfully`);
      debugLog.push(`[UPLOAD] ✅ All ${uploadedCount} rows uploaded successfully`);
    } catch (uploadError: any) {
      const errorMsg = uploadError?.message || 'Upload to MongoDB failed';
      debugLog.push(`[UPLOAD] ❌ Upload error: ${errorMsg}`);
      throw new Error(`MongoDB upload failed: ${errorMsg}`);
    }

    // ───────────────────────────────────────────────────────────────────
    // STAGE 4: RETURN RESULT
    // ───────────────────────────────────────────────────────────────────
    if (options.onProgress) {
      options.onProgress({
        stage: 'complete',
        processed: 100,
        total: 100,
        message: 'Upload complete!'
      });
    }

    const result: UploadResult = {
      success: true,
      templateType: parseResult.templateType,
      totalRows: parseResult.rows.length,
      uploadedRows: uploadedCount,
      rejectedRows: errorRows.length,
      activeEmployees,
      inactiveEmployees,
      errors: errorRows.map(e => ({
        rowNum: e.rowNum,
        message: e.errors.join('; ')
      })),
      warnings: errorRows
        .flatMap(e =>
          e.warnings.map(w => ({
            rowNum: e.rowNum,
            message: w
          }))
        ),
      debugLog: debugLog.join('\n')
    };

    console.log(`[UPLOAD] ✅ Result:`, result);
    return result;
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error';
    debugLog.push(`[UPLOAD] ❌ Fatal error: ${errorMsg}`);

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
});

export async function validateFile(file: File): Promise<ParseResult> {
  return await parseExcelFileStrict(file);
}

/**
 * Format upload result for user display
 */

export function formatUploadResult(result: UploadResult): string {
  if (!result.success) {
    return (
      `❌ Upload Failed\n` +
      `Error: ${result.errors[0]?.message || 'Unknown error'}\n\n` +
      `Debug Log:\n${result.debugLog}`
    );
  }

  let message = `✅ Upload Successful\n\n`;
  message += `Template Type: ${result.templateType}\n`;
  message += `Total Rows: ${result.totalRows}\n`;
  message += `Uploaded: ${result.uploadedRows} ✅\n`;
  message += `Rejected: ${result.rejectedRows} ❌\n`;
  message += `Success Rate: ${((result.uploadedRows / result.totalRows) * 100).toFixed(1)}%\n`;

  if (result.errors.length > 0) {
    message += `\n❌ Errors (first 5):\n`;
    result.errors.slice(0, 5).forEach(e => {
      message += `  Row ${e.rowNum}: ${e.message}\n`;
    });
    if (result.errors.length > 5) {
      message += `  ... and ${result.errors.length - 5} more\n`;
    }
  }

  if (result.warnings.length > 0) {
    message += `\n⚠️ Warnings (first 5):\n`;
    result.warnings.slice(0, 5).forEach(w => {
      message += `  Row ${w.rowNum}: ${w.message}\n`;
    });
    if (result.warnings.length > 5) {
      message += `  ... and ${result.warnings.length - 5} more\n`;
    }
  }

  return message;
}

