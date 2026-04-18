import { addBatch, clearCollectionByField } from './apiClient';

/** ============================================================================
 * TYPES
 * ============================================================================ */

export interface UploadProgressState {
  totalRows: number;
  uploadedRows: number;
  currentChunk: number;
  totalChunks: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  currentError?: string;
}

export interface ChunkError {
  chunkIndex: number;
  rowIndices: number[];
  error: string;
}

export interface UploadResult {
  successCount: number;
  failureCount: number;
  totalProcessed: number;
  failedChunks: ChunkError[];
  errors: string[];
  payloadSizeKB: number;
  duration: number;
}

/** ============================================================================
 * MONGODB FIELD MAPPER
 * ============================================================================ */

/**
 * CRITICAL: Maps parsed row to ONLY required MongoDB fields.
 * Strips warnings, errors, UI flags, nested objects, and undefined values.
 */
export function mapToMongoDB(row: any): Record<string, any> {
  const d = row.data || row;

  // Whitelist ONLY these fields
  const mongoPayload: Record<string, any> = {};

  // String fields
  if (d.aadhaarNumber) mongoPayload.aadhaarNumber = String(d.aadhaarNumber).trim();
  if (d.mobileNumber) mongoPayload.mobileNumber = String(d.mobileNumber).trim();
  if (d.cluster) mongoPayload.cluster = String(d.cluster).trim();
  if (d.designation) mongoPayload.designation = String(d.designation).trim();
  if (d.employeeId) mongoPayload.employeeId = String(d.employeeId).trim();
  if (d.hq) mongoPayload.hq = String(d.hq).trim();
  if (d.attendanceStatus) mongoPayload.attendanceStatus = String(d.attendanceStatus).trim();
  if (d.attendanceDate) mongoPayload.attendanceDate = String(d.attendanceDate).trim();
  if (d.month) mongoPayload.month = String(d.month).trim();

  // ID field (required)
  if (d.id) mongoPayload.id = String(d.id);

  // ✅ EXCLUDED (never sent):
  // - _matchQuality, _hasScores, _scores, status, warnings, errors, flags
  // - name, trainerId, team, state (not in required list)
  // - Any nested objects or arrays

  return mongoPayload;
}

// Keep old function name for backwards compatibility
export const mapToFirestore = mapToMongoDB;

/** ============================================================================
 * PAYLOAD SIZE CALCULATOR
 * ============================================================================ */

export function calculatePayloadSize(data: any[]): { sizeKB: number; sizeBytes: number } {
  try {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json).length;
    return { sizeBytes: bytes, sizeKB: Math.round(bytes / 1024) };
  } catch (e) {
    return { sizeBytes: 0, sizeKB: 0 };
  }
}

/** ============================================================================
 * RETRY LOGIC
 * ============================================================================ */

const retryWithBackoff = async (
  fn: () => Promise<void>,
  maxRetries: number = 1,
  initialDelayMs: number = 100
): Promise<void> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(
          `[RETRY] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delayMs}ms:`,
          error.message
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
};

/** ============================================================================
 * BATCH PROCESSOR
 * ============================================================================ */

async function processBatchChunk(
  rows: any[],
  trainingType: string,
  chunkIndex: number
): Promise<{ attCount: number; scoreCount: number }> {
  let attCount = 0;
  let scoreCount = 0;

  const attPayloads: any[] = [];
  const scorePayloads: any[] = [];

  for (const row of rows) {
    try {
      const cleanData = mapToMongoDB(row);

      // Skip if critical fields missing
      if (!cleanData.employeeId || !cleanData.attendanceDate) {
        console.warn(`[BATCH] Skipping row in chunk ${chunkIndex}: missing employeeId or date`, cleanData);
        continue;
      }

      // Generate deterministic ID for deduplication in append mode
      const attId = `${cleanData.employeeId}_${trainingType}_${cleanData.attendanceDate}`;

      // Add attendance record
      const attPayload = {
        id: attId,
        _id: attId,
        trainingType,
        ...cleanData
      };

      attPayloads.push(attPayload);
      attCount++;

      // Add training scores if present
      const d = row.data || row;
      if (d._hasScores && d._scores && typeof d._scores === 'object') {
        const scoreId = `${cleanData.employeeId}_${trainingType}_${cleanData.attendanceDate}`;

        const scorePayload = {
          id: scoreId,
          _id: scoreId,
          employeeId: cleanData.employeeId,
          trainingType,
          dateStr: cleanData.attendanceDate,
          scores: d._scores
        };

        scorePayloads.push(scorePayload);
        scoreCount++;
      }
    } catch (rowError: any) {
      console.error(`[BATCH] Error processing row in chunk ${chunkIndex}:`, rowError.message);
      // Continue to next row instead of crashing
    }
  }

  // Only execute if there are operations
  if (attPayloads.length > 0 || scorePayloads.length > 0) {
    await retryWithBackoff(
      async () => {
        if (attPayloads.length > 0) {
          await addBatch('attendance', attPayloads);
        }
        if (scorePayloads.length > 0) {
          await addBatch('training_scores', scorePayloads);
        }
      },
      2, // maxRetries
      100 // initialDelayMs
    );
  }

  return { attCount, scoreCount };
}

/** ============================================================================
 * MAIN UPLOAD FUNCTION
 * ============================================================================ */

export async function uploadAttendanceData(
  rows: any[],
  trainingType: string,
  mode: 'append' | 'replace' = 'append',
  onProgress?: (state: UploadProgressState) => void,
  chunkSize: number = 25
): Promise<UploadResult> {
  const startTime = performance.now();
  
  // Validate input
  if (!rows || rows.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      totalProcessed: 0,
      failedChunks: [],
      errors: ['No rows provided for upload'],
      payloadSizeKB: 0,
      duration: 0
    };
  }

  const totalRows = rows.length;
  const totalChunks = Math.ceil(totalRows / chunkSize);

  const result: UploadResult = {
    successCount: 0,
    failureCount: 0,
    totalProcessed: 0,
    failedChunks: [],
    errors: [],
    payloadSizeKB: 0,
    duration: 0
  };

  // Calculate payload size BEFORE upload (with error handling)
  let payloadInfo = { sizeKB: 0, sizeBytes: 0 };
  try {
    const cleanData = rows.map(r => mapToMongoDB(r)).filter(d => d && d.employeeId);
    payloadInfo = calculatePayloadSize(cleanData);
  } catch (e) {
    console.warn('Could not calculate payload size:', e);
  }
  result.payloadSizeKB = payloadInfo.sizeKB;

  console.log(`
[UPLOAD] Starting upload
  - Total Rows: ${totalRows}
  - Chunk Size: ${chunkSize}
  - Total Chunks: ${totalChunks}
  - Training Type: ${trainingType}
  - Mode: ${mode}
  - Payload Size: ${payloadInfo.sizeKB} KB
  `);

  // Initial progress state
  const progressState: UploadProgressState = {
    totalRows,
    uploadedRows: 0,
    currentChunk: 0,
    totalChunks,
    status: 'uploading'
  };

  if (onProgress) {
    try {
      onProgress(progressState);
    } catch (e) {
      console.warn('[PROGRESS] Callback error:', e);
    }
  }

  let processedCount = 0;

  // Process each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, totalRows);
    const chunk = rows.slice(start, end);

    console.log(`[CHUNK ${chunkIndex + 1}/${totalChunks}] Processing ${chunk.length} records...`);

    try {
      const { attCount, scoreCount } = await processBatchChunk(chunk, trainingType, chunkIndex);

      result.successCount += attCount + scoreCount;
      processedCount += chunk.length;

      // Update progress
      progressState.uploadedRows = processedCount;
      progressState.currentChunk = chunkIndex + 1;
      if (onProgress) {
        try {
          onProgress(progressState);
        } catch (e) {
          console.warn('[PROGRESS] Callback error:', e);
        }
      }

      console.log(
        `[CHUNK ${chunkIndex + 1}/${totalChunks}] ✓ Uploaded ${attCount} attendance + ${scoreCount} score records`
      );

      // Delay between batches (reduce MongoDB load)
      if (chunkIndex < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`[CHUNK ${chunkIndex + 1}/${totalChunks}] ✗ FAILED: ${errorMsg}`);

      result.failedChunks.push({
        chunkIndex,
        rowIndices: Array.from({ length: chunk.length }, (_, i) => start + i),
        error: errorMsg
      });

      result.errors.push(`Chunk ${chunkIndex + 1}: ${errorMsg}`);
      result.failureCount += chunk.length;

      // Continue to next chunk (graceful failure)
      progressState.currentError = errorMsg;
      if (onProgress) {
        try {
          onProgress(progressState);
        } catch (e) {
          console.warn('[PROGRESS] Callback error:', e);
        }
      }
    }
  }

  result.totalProcessed = processedCount;
  const endTime = performance.now();
  result.duration = Math.round(endTime - startTime);

  // Final progress state
  progressState.status = result.failedChunks.length > 0 ? 'error' : 'completed';
  progressState.uploadedRows = processedCount;  // Use row count, not record count
  if (onProgress) {
    try {
      onProgress(progressState);
    } catch (e) {
      console.warn('[PROGRESS] Callback error:', e);
    }
  }

  console.log(`
[UPLOAD COMPLETE]
  - Success: ${result.successCount}
  - Failures: ${result.failureCount}
  - Total Processed: ${result.totalProcessed}
  - Failed Chunks: ${result.failedChunks.length}
  - Duration: ${result.duration}ms
  - Payload Size: ${result.payloadSizeKB} KB
  `);

  return result;
}

/** ============================================================================
 * LEGACY COMPATIBILITY
 * ============================================================================ */

/**
 * Wrapper for backward compatibility with existing AttendanceUpload component.
 * Maps to new uploadAttendanceData function.
 */
export async function uploadAttendanceBatch(
  uploadableRows: any[],
  trainingType: string,
  mode: 'replace' | 'append',
  onProgress?: (count: number) => void
): Promise<{ attCount: number; scoreCount: number; skippedCount: number }> {
  try {
    const result = await uploadAttendanceData(uploadableRows, trainingType, mode, (state) => {
      if (onProgress) {
        onProgress(state.uploadedRows);
      }
    });

    return {
      attCount: result.successCount,
      scoreCount: 0, // Included in successCount
      skippedCount: result.failureCount
    };
  } catch (error: any) {
    console.error('[UPLOAD ERROR]', error);
    throw error;
  }
}
