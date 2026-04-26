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
import { addBatch, clearCollection } from './apiClient';
import { traceEngine } from '../debug/traceEngine';

export interface UploadOptions {
  mode: 'append' | 'replace';  // append: add to existing; replace: clear collection first
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
  errors: Array<{ rowNum: number; message: string }>;
  warnings: Array<{ rowNum: number; message: string }>;
  debugLog: string;
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

    const validRows = getValidRows(parseResult);
    const errorRows = getErrorRows(parseResult);
    const summary = getSummary(parseResult);

    debugLog.push(`[UPLOAD] Validation summary: ${JSON.stringify(summary)}`);

    if (validRows.length === 0) {
      throw new Error(
        `❌ No valid rows to upload. All ${parseResult.rows.length} rows were rejected.\n` +
        `Errors:\n${errorRows.slice(0, 3).map(e => `  Row ${e.rowNum}: ${e.errors.join('; ')}`).join('\n')}` +
        (errorRows.length > 3 ? `\n  ... and ${errorRows.length - 3} more` : '')
      );
    }

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
    const collectionName = 'training_data';

    try {
      // IMPORTANT: Clear collection if replace mode
      if (options.mode === 'replace') {
        console.log(`[UPLOAD] Clearing collection "${collectionName}" (replace mode)`);
        debugLog.push(`[UPLOAD] Clearing collection "${collectionName}" (replace mode)`);
        await clearCollection(collectionName);
      }

      const uploadBatchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Upload in chunks
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        const chunkNum = Math.floor(i / chunkSize) + 1;

        try {
          // Create _id from templateType + employeeId + attendanceDate
          const docsToInsert = chunk.map(row => {
            const _id = `${row.trainingType}_${row.employeeId}_${row.attendanceDate}`;
            return {
              _id,
              ...row,
              uploadBatchId,
              uploadedAt: new Date(),
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

