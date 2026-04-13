import { upsertDoc, clearCollection, getCollection } from './firestoreService';

/** Strip undefined fields — Firestore rejects documents with undefined values. */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

export const uploadAttendanceBatch = async (
  uploadableRows: any[], 
  trainingType: string,
  mode: 'replace' | 'append',
  onProgress?: (count: number) => void
) => {
  let attCount = 0;
  let scoreCount = 0;
  let skippedCount = 0;

  if (mode === 'replace') {
    await clearCollection('attendance');
    await clearCollection('training_scores');
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

  // To display accurate progress relative to the processed list
  let processedCount = 0;

  for (const row of uploadableRows) {
    const d = row.data;
    
    if (mode === 'append') {
      const key = `${d.employeeId}_${d.attendanceDate}_${trainingType}`;
      if (existingKeys.has(key)) {
        skippedCount++;
        processedCount++;
        if (onProgress) onProgress(processedCount);
        continue;
      }
    }

    const attId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}_${Date.now()}`;
    
    await upsertDoc('attendance', attId, stripUndefined({
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
    }));
    
    attCount++;

    if (d._hasScores && d.attendanceDate) {
      const scoreId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}`;
      await upsertDoc('training_scores', scoreId, stripUndefined({
        id: scoreId,
        employeeId: d.employeeId,
        trainingType,
        dateStr: d.attendanceDate,
        scores: d._scores
      }));
      scoreCount++;
    }

    processedCount++;
    if (onProgress) onProgress(processedCount);
  }

  return { attCount, scoreCount, skippedCount };
};
