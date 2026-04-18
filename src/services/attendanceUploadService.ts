import { writeBatch, doc } from 'firebase/firestore';
import { db } from './firestoreService';

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
 * FIRESTORE FIELD MAPPER
 * ============================================================================ */

/**
 * CRITICAL: Maps parsed row to ONLY required Firestore fields.
 * Strips warnings, errors, UI flags, nested objects, and undefined values.
 */
export function mapToFirestore(row: any): Record<string, any> {
  const d = row.data || row;

  // Whitelist ONLY these fields
  const firestorePayload: Record<string, any> = {};

  // String fields
  if (d.aadhaarNumber) firestorePayload.aadhaarNumber = String(d.aadhaarNumber).trim();
  if (d.mobileNumber) firestorePayload.mobileNumber = String(d.mobileNumber).trim();
  if (d.cluster) firestorePayload.cluster = String(d.cluster).trim();
  if (d.designation) firestorePayload.designation = String(d.designation).trim();
  if (d.employeeId) firestorePayload.employeeId = String(d.employeeId).trim();
  if (d.hq) firestorePayload.hq = String(d.hq).trim();
  if (d.attendanceStatus) firestorePayload.attendanceStatus = String(d.attendanceStatus).trim();
  if (d.attendanceDate) firestorePayload.attendanceDate = String(d.attendanceDate).trim();
  if (d.month) firestorePayload.month = String(d.month).trim();

  // ID field (required)
  if (d.id) firestorePayload.id = String(d.id);

  // ✅ EXCLUDED (never sent):
  // - _matchQuality, _hasScores, _scores, status, warnings, errors, flags
  // - name, trainerId, team, state (not in required list)
  // - Any nested objects or arrays

  return firestorePayload;
}

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

  const batch = writeBatch(db);

  for (const row of rows) {
    const cleanData = mapToFirestore(row);

    // Skip if critical fields missing
    if (!cleanData.employeeId || !cleanData.attendanceDate) {
      console.warn(`[BATCH] Skipping row in chunk ${chunkIndex}: missing employeeId or date`, cleanData);
      continue;
    }

    // Generate deterministic ID for deduplication in append mode
    const attId = `${cleanData.employeeId}_${trainingType}_${cleanData.attendanceDate}`;

    // Add attendance record
    const attRef = doc(db, 'attendance', attId);
    const attPayload = {
      id: attId,
      trainingType,
      ...cleanData
    };

    batch.set(attRef, attPayload, { merge: true });
    attCount++;

    // Add training scores if present
    const d = row.data || row;
    if (d._hasScores && d._scores) {
      const scoreId = `${cleanData.employeeId}_${trainingType}_${cleanData.attendanceDate}`;
      const scoreRef = doc(db, 'training_scores', scoreId);

      const scorePayload = {
        id: scoreId,
        employeeId: cleanData.employeeId,
        trainingType,
        dateStr: cleanData.attendanceDate,
        scores: d._scores
      };

      batch.set(scoreRef, scorePayload, { merge: true });
      scoreCount++;
    }
  }

  // Commit with retry (1 retry, exponential backoff)
  await retryWithBackoff(
    () => batch.commit(),
    2, // maxRetries
    100 // initialDelayMs
  );

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

  // Calculate payload size BEFORE upload
  const cleanData = rows.map(r => mapToFirestore(r));
  const payloadInfo = calculatePayloadSize(cleanData);
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

  if (onProgress) onProgress(progressState);

  let processedCount = 0;

  // Process each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, totalRows);
    const chunk = rows.slice(start, end);

    console.log(`[CHUNK ${chunkIndex + 1}/${totalChunks}] Processing ${chunk.length} records...`);

    try {
      const { attCount, scoreCount } = await processBatchChunk(chunk, trainingType, chunkIndex);

      result.successCount += attCount;
      scoreCount > 0 && (result.successCount += scoreCount);
      processedCount += chunk.length;

      // Update progress
      progressState.uploadedRows = processedCount;
      progressState.currentChunk = chunkIndex + 1;
      if (onProgress) onProgress(progressState);

      console.log(
        `[CHUNK ${chunkIndex + 1}/${totalChunks}] ✓ Uploaded ${attCount} attendance + ${scoreCount} score records`
      );

      // Delay between batches (reduce Firestore load)
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
      if (onProgress) onProgress(progressState);
    }
  }

  result.totalProcessed = processedCount;
  const endTime = performance.now();
  result.duration = Math.round(endTime - startTime);

  // Final progress state
  progressState.status = result.failedChunks.length > 0 ? 'error' : 'completed';
  progressState.uploadedRows = result.successCount;
  if (onProgress) onProgress(progressState);

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
}
