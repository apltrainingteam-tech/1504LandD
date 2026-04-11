import { upsertDoc } from './firestoreService';

export const uploadAttendanceBatch = async (
  uploadableRows: any[], 
  trainingType: string,
  onProgress?: (count: number) => void
) => {
  let attCount = 0;
  let scoreCount = 0;

  for (const row of uploadableRows) {
    const d = row.data;
    const attId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}_${Date.now()}`;
    
    await upsertDoc('attendance', attId, {
      id: attId,
      employeeId: d.employeeId,
      aadhaarNumber: d.aadhaarNumber,
      mobileNumber: d.mobileNumber,
      name: d.name,
      trainingType,
      attendanceDate: d.attendanceDate,
      attendanceStatus: d.attendanceStatus,
      month: d.month || '',
      trainerId: d.trainerId,
      team: d.team,
      designation: d.designation,
      cluster: d.cluster,
      hq: d.hq,
      state: d.state
    });
    
    attCount++;

    if (d._hasScores && d.attendanceDate) {
      const scoreId = `${d.employeeId || 'UNK'}_${trainingType}_${d.attendanceDate}`;
      await upsertDoc('training_scores', scoreId, {
        id: scoreId,
        employeeId: d.employeeId,
        trainingType,
        dateStr: d.attendanceDate,
        scores: d._scores
      });
      scoreCount++;
    }

    if (onProgress) onProgress(attCount);
  }

  return { attCount, scoreCount };
};
