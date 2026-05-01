import { useMemo } from 'react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Attendance, TrainingBatch, NotificationRecord, NominationDraft } from '../../types/attendance';
import { Employee } from '../../types/employee';
import { isWithinFY } from '../../core/utils/fiscalYear';
import { normalizeTrainingType, match } from '../../core/engines/normalizationEngine';

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
  drafts: NominationDraft[]
) => {
  const { filters } = useGlobalFilters();

  const deriveUploadBatches = (data: Attendance[]): TrainingBatch[] => {
    const map = new Map<string, { rows: Attendance[] }>();
    data.forEach(a => {
      if (!a.trainingType || !a.teamId) return;
      const month = (a.month || a.attendanceDate?.substring(0, 7) || '');
      const key = `${a.trainingType}::${a.teamId}::${month}`;
      if (!map.has(key)) map.set(key, { rows: [] });
      map.get(key)!.rows.push(a);
    });

    const batches: TrainingBatch[] = [];
    map.forEach((val, key) => {
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
        trainingType: String(first.trainingType),
        team: first.team || first.teamId || '',
        teamId: first.teamId || '',
        trainer: first.trainerId || '',
        startDate,
        endDate,
        committedAt: startDate,
        isVoided: false,            // required by TrainingBatch
        candidates: rows.map(r => {
          const rawStatus = (r.attendanceStatus || '').toLowerCase().trim();
          const attendance: import('../../types/attendance').BatchAttStatus =
            rawStatus === 'present' ? 'present'
            : rawStatus === 'absent' ? 'absent'
            : 'pending';
          return {
            empId: String(r.employeeId),
            attendance,
            score: '',              // score lives in TrainingScore, not Attendance
            isVoided: r.isVoided ?? false,
          };
        })
      });
    });
    return batches;
  };

  const filteredUploadBatches = useMemo(() => {
    const filteredRaw = attendance.filter(a => {
      if (filters.trainingType !== 'ALL' && normalizeTrainingType(a.trainingType) !== normalizeTrainingType(filters.trainingType)) return false;
      if (filters.trainer !== 'ALL' && a.trainerId !== filters.trainer) return false;
      if (!isWithinFY(a.attendanceDate, filters.fiscalYear)) return false;
      return true;
    });
    return deriveUploadBatches(filteredRaw);
  }, [attendance, filters]);

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
      if (r.trainingId) process(r.trainingId, r.teamId || '', r.team, r.trainingType, r.trainerId, r.notificationDate, r.notificationDate, 'NOTIFICATION', !!((r as any).isVoided || r.finalStatus === 'VOID'));
    });

    drafts.forEach(d => {
      process(d.trainingId, d.teamId, d.team, d.trainingType, d.trainer || '', d.startDate || '', d.endDate || '', 'NOTIFICATION', d.isVoided);
    });

    return Array.from(batchesMap.values());
  }, [notificationRecords, drafts, filters]);

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

