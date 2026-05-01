import { useMemo } from 'react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { TrainingPlan, TrainingPlanStatus, NotificationRecord, NominationDraft } from '../../types/attendance';
import { isWithinFY, parseFiscalYear } from '../../core/utils/fiscalYear';
import { match } from '../../core/engines/normalizationEngine';

const CHECKLIST_RULES: Record<string, string[]> = {
  IP: ["Database", "Bill"],
  Capsule: ["Database"],
  "Pre-AP": ["Database"],
  AP: ["Booking", "Notice", "Database", "Bill"],
  MIP: ["Booking", "Notice", "Database", "Bill"],
  Refresher: ["Booking", "Notice", "Database", "Bill"]
};

/**
 * useCalendarData
 * 🎯 PHASE 3 — Data Integration
 */

export const useCalendarData = () => {
  const { filters } = useGlobalFilters();
  const { masterTeams } = useMasterData();
  const { notificationRecords, drafts } = usePlanningFlow();

  const plans = useMemo(() => {
    const plansMap = new Map<string, any>();

    const processEntry = (
      trainingId: string,
      teamId: string,
      teamName: string,
      type: string,
      trainer: string,
      start: string,
      end: string,
      status: TrainingPlanStatus = 'Planned'
    ) => {
      // Apply Global Filters before adding to map
      if (filters.trainingType !== 'ALL' && !match(type, filters.trainingType)) return;
      if (filters.trainer !== 'ALL' && trainer !== filters.trainer) return;
      if (!isWithinFY(start, filters.fiscalYear)) return;

      if (!plansMap.has(trainingId)) {
        plansMap.set(trainingId, {
          id: trainingId,
          trainingType: type,
          status,
          trainer,
          startDate: start,
          endDate: end,
          teams: [],
          checklist: (CHECKLIST_RULES[type] || []).map(name => ({ name, completed: false }))
        });
      }
      const plan = plansMap.get(trainingId)!;
      if (!plan.teams.some((t: any) => t.teamId === teamId)) {
        plan.teams.push({
          trainingId,
          teamId,
          teamName,
          status: 'OPEN'
        });
      }
    };

    notificationRecords.forEach((r: NotificationRecord) => {
      if (r.trainingId) {
        const status = (r.finalStatus === 'VOID' || (r as any).isVoided) ? 'Cancelled' : 'Notified';
        processEntry(r.trainingId, r.teamId || '', r.team, r.trainingType, r.trainerId, r.notificationDate, r.notificationDate, status);
      }
    });

    drafts.forEach((d: NominationDraft) => {
      processEntry(
        d.trainingId,
        d.teamId,
        d.team,
        d.trainingType,
        d.trainer || '',
        d.startDate || '',
        d.endDate || '',
        d.isCancelled
          ? 'Cancelled'
          : d.status === 'NOTIFIED'
          ? 'Notified'
          : d.status === 'COMPLETED'
          ? 'Completed'
          : 'Planned'
      );
    });

    return Array.from(plansMap.values());
  }, [notificationRecords, drafts, filters]);

  return {
    plans
  };
};
