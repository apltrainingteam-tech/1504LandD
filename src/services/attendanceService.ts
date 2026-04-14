import { upsertDoc, clearCollectionByField, getCollection } from './firestoreService';

/** Strip undefined fields — Firestore rejects documents with undefined values. */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

// 🔹 RETRY HELPER WITH EXPONENTIAL BACKOFF
const retryWithBackoff = async (fn: () => Promise<void>, maxRetries = 5): Promise<void> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 32000); // Exponential backoff, max 32s
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
};

// 🔹 PROCESS RECORDS IN BATCHES TO PREVENT QUOTA EXHAUSTION
const processBatch = async (
  batch: any[],
  trainingType: string
): Promise<{ attCount: number; scoreCount: number }> => {
  let attCount = 0;
  let scoreCount = 0;

  for (const row of batch) {
    const d = row.data;
    const attId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}_${Date.now()}`;

    // Retry write with exponential backoff
    await retryWithBackoff(() =>
      upsertDoc('attendance', attId, stripUndefined({
        id: attId,
        employeeId: d.employeeId,
        aadhaarNumber: d.aadhaarNumber || '',
        mobileNumber: d.mobileNumber || '',
        name: d.name || '',
        trainingType,
        attendanceDate: d.attendanceDate,
        attendanceStatus: d.attendanceStatus,
        month: d.month || '',
        trainerId: d.trainerId || '',
        team: d.team || '',
        designation: d.designation || '',
        cluster: d.cluster || '',
        hq: d.hq || '',
        state: d.state || ''
      }))
    );

    attCount++;

    if (d._hasScores && d.attendanceDate) {
      const scoreId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}`;
      await retryWithBackoff(() =>
        upsertDoc('training_scores', scoreId, stripUndefined({
          id: scoreId,
          employeeId: d.employeeId,
          trainingType,
          dateStr: d.attendanceDate,
          scores: d._scores
        }))
      );
      scoreCount++;
    }

    // Add small delay between individual writes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { attCount, scoreCount };
};

export const uploadAttendanceBatch = async (
  uploadableRows: any[], 
  trainingType: string,
  mode: 'replace' | 'append',
  onProgress?: (count: number) => void,
  chunkSize: number = 25  // Process 25 records per chunk
) => {
  let attCount = 0;
  let scoreCount = 0;
  let skippedCount = 0;

  if (mode === 'replace') {
    console.log(`Replace mode selected for trainingType=${trainingType}. Clearing only matching records.`);
    await clearCollectionByField('attendance', 'trainingType', trainingType);
    await clearCollectionByField('training_scores', 'trainingType', trainingType);
  }

  const existingKeys = new Set<string>();
  if (mode === 'append') {
    const existingAtt = await getCollection('attendance');
    existingAtt.forEach(a => {
      if (a.employeeId && a.attendanceDate && a.trainingType) {
        existingKeys.add(`${a.employeeId}_${a.attendanceDate}_${a.trainingType}`);
      }
    });
  }

  // Filter out duplicates in append mode
  const rowsToProcess = uploadableRows.filter(row => {
    if (mode === 'append') {
      const key = `${row.data.employeeId}_${row.data.attendanceDate}_${trainingType}`;
      if (existingKeys.has(key)) {
        skippedCount++;
        return false;
      }
    }
    return true;
  });

  // Process in chunks to prevent quota exhaustion
  const totalChunks = Math.ceil(rowsToProcess.length / chunkSize);
  console.log(`Processing ${rowsToProcess.length} records in ${totalChunks} chunks of ${chunkSize}`);

  let processedCount = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, rowsToProcess.length);
    const chunk = rowsToProcess.slice(start, end);

    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} records)`);

    try {
      const { attCount: chunkAttCount, scoreCount: chunkScoreCount } = await processBatch(chunk, trainingType);
      attCount += chunkAttCount;
      scoreCount += chunkScoreCount;
    } catch (error) {
      console.error(`Error processing chunk ${chunkIndex + 1}:`, error);
      throw error;
    }

    processedCount += chunk.length;
    if (onProgress) onProgress(processedCount);

    // Add delay between chunks to prevent quota issues
    if (chunkIndex < totalChunks - 1) {
      const chunkDelayMs = 2000; // 2 second pause between chunks
      console.log(`Waiting ${chunkDelayMs}ms before next chunk...`);
      await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
    }
  }

  return { attCount, scoreCount, skippedCount };
};
