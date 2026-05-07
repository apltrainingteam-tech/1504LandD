import { useMemo } from 'react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Attendance, TrainingBatch, NotificationRecord, NominationDraft, TrainingScore } from '../../types/attendance';
import { Employee } from '../../types/employee';
import { isWithinFY } from '../../core/utils/fiscalYear';
import { normalizeTrainingType, match, formatDisplayText } from '../../core/engines/normalizationEngine';

/**
 * useTrainingData
 * 🎯 PHASE 3 — Data Integration
 * 
 * Objective: Centralize training data derivation and filtering.
 */

export const useTrainingData = (
  employees: Employee[], 
  attendance: Attendance[],
  notificationRecords: NotificationRecord[],
  drafts: NominationDraft[],
  scores: TrainingScore[] = []
) => {
  const { filters } = useGlobalFilters();

  const deriveUploadBatches = (data: Attendance[]): TrainingBatch[] => {
    const map = new Map<string, { rows: Attendance[] }>();
    data.forEach(a => {
      if (!a.trainingType) return;
      const date = a.attendanceDate || a.month || '';
      const key = `${a.trainingType}::${date}`;
      if (!map.has(key)) map.set(key, { rows: [] });
      map.get(key)!.rows.push(a);
    });

    const batches: TrainingBatch[] = [];
    map.forEach((val, key) => {
      // ... existing code inside map.forEach ...
      // (I'll keep the logic I wrote earlier but ensure it's correct)
      const { rows } = val;
      const first = rows[0];
      const dates = rows.map(r => r.attendanceDate).filter(Boolean).sort();
      const startDate = dates[0] || first.month || '';
      const endDate = dates[dates.length - 1] || startDate;

      batches.push({
        id: `upload::${key}`,
        trainingId: `upload::${key}`,
        draftId: `upload::${key}`,
        source: 'UPLOAD' as const,
        trainingType: normalizeTrainingType(String(first.trainingType)),
        team: (() => {
          const uniqueTeams = [...new Set(rows.map(r => r.team || r.teamId).filter(Boolean))];
          return uniqueTeams.length === 1 ? formatDisplayText(String(uniqueTeams[0])) : `${uniqueTeams.length} ${formatDisplayText("Teams")}`;
        })(),
        teamId: '', 
        trainer: first.trainerId || '',
        startDate,
        endDate,
        committedAt: startDate,
        isVoided: false,
        candidates: rows.map(r => {
          const rawStatus = (r.attendanceStatus || '').toLowerCase().trim();
          const attStatus: import('../../types/attendance').BatchAttStatus =
            rawStatus === 'present' ? 'present'
            : rawStatus === 'absent' ? 'absent'
            : 'pending';
          
          // Match Score
          const matchScore = scores.find(s => 
            String(s.employeeId) === String(r.employeeId) && 
            normalizeTrainingType(s.trainingType) === normalizeTrainingType(r.trainingType) &&
            (s.dateStr === r.attendanceDate || s.dateStr === r.month)
          );

          return {
            empId: String(r.employeeId),
            attendance: attStatus,
            score: '', 
            scores: matchScore?.scores || {},
            isVoided: r.isVoided ?? false,
          };
        })
      });
    });

    // Sort batches: Most recent first
    return batches.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });
  };

  const filteredUploadBatches = useMemo(() => {
    const filteredRaw = attendance.filter(a => {
      if (filters.trainingType !== 'ALL' && normalizeTrainingType(a.trainingType) !== normalizeTrainingType(filters.trainingType)) return false;
      if (filters.trainer !== 'ALL' && a.trainerId !== filters.trainer) return false;
      if (!isWithinFY(a.attendanceDate, filters.fiscalYear)) return false;
      return true;
    });
    return deriveUploadBatches(filteredRaw);
  }, [attendance, filters, scores]);

  const filteredNotificationBatches = useMemo(() => {
    const batchesMap = new Map<string, TrainingBatch>();
    
    const process = (trainingId: string, teamId: string, teamName: string, type: string, trainer: string, start: string, end: string, source: 'NOTIFICATION', isVoided: boolean) => {
      if (filters.trainingType !== 'ALL' && !match(type, filters.trainingType)) return;
      if (filters.trainer !== 'ALL' && trainer !== filters.trainer) return;
      if (!isWithinFY(start, filters.fiscalYear)) return;

      if (!batchesMap.has(trainingId)) {
        batchesMap.set(trainingId, {
          id: trainingId,
          trainingId,
          draftId: trainingId,
          source,
          trainingType: type,
          team: teamName,
          teamId,
          trainer,
          startDate: start,
          endDate: end,
          committedAt: start,
          isVoided,
          candidates: []
        });
      }
    };

    notificationRecords.forEach(r => {
      if (r.trainingId) {
        process(r.trainingId, r.teamId || '', r.team, r.trainingType, r.trainerId, r.notificationDate, r.notificationDate, 'NOTIFICATION', !!((r as any).isVoided || r.finalStatus === 'VOID'));
        const batch = batchesMap.get(r.trainingId);
        if (batch) {
          const matchScore = scores.find(s => 
            String(s.employeeId) === String(r.empId || (r as any).employeeId) && 
            normalizeTrainingType(s.trainingType) === normalizeTrainingType(r.trainingType) &&
            (s.dateStr === r.notificationDate || s.dateStr === (r as any).month)
          );
          batch.candidates.push({
            empId: String(r.empId || (r as any).employeeId),
            attendance: r.attended ? 'present' : 'pending',
            score: '',
            scores: matchScore?.scores || (r as any).scores || {},
            isVoided: r.finalStatus === 'VOID' || r.isVoided || false
          });
        }
      }
    });

    drafts.forEach(d => {
      process(d.trainingId, d.teamId, d.team, d.trainingType, d.trainer || '', d.startDate || '', d.endDate || '', 'NOTIFICATION', d.isVoided);
      // Candidates are mapped from notificationRecords above. For raw drafts, they usually map directly to records.
    });

    return Array.from(batchesMap.values());
  }, [notificationRecords, drafts, filters, scores]);

  const allBatches = useMemo(() => {
    const seen = new Set<string>();
    return [...filteredNotificationBatches, ...filteredUploadBatches].filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [filteredNotificationBatches, filteredUploadBatches]);

  return {
    batches: allBatches,
    uploadBatches: filteredUploadBatches,
    notificationBatches: filteredNotificationBatches
  };
};

