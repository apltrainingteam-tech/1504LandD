import { useState, useMemo, useEffect } from 'react';
import { getCollection } from '../../../core/engines/apiClient';
import { computeGapAnalysis } from '../../../core/engines/gapEngine';
import { applyEligibilityRules } from '../../../core/engines/eligibilityRulesEngine';
import { GlobalFilters } from '../../../core/context/filterContext';
import { Employee } from '../../../types/employee';
import { Attendance, TrainingNomination, TrainingType } from '../../../types/attendance';
import { Team } from '../../../core/context/MasterDataContext';

export const useGapAnalysisData = (
  tab: TrainingType | string,
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[],
  masterTeams: Team[],
  pageFilters: GlobalFilters,
  zoneFilter: string
) => {
  const [dbRules, setDbRules] = useState<Record<string, any>>({});
  const isActiveNomination = (n: TrainingNomination) =>
    (n as any).isCancelled !== true &&
    (n as any).isVoided !== true &&
    (n as any).finalStatus !== 'VOID';

  useEffect(() => {
    getCollection('eligibility_rules')
      .then(rows => {
        const map: Record<string, any> = {};
        rows.forEach((r: any) => {
          if (r.trainingType) map[r.trainingType] = r;
        });
        setDbRules(map);
      })
      .catch(err => console.warn('[GAP] Could not load DB eligibility rules:', err.message));
  }, []);

  const convertDbRule = (raw: any): Record<string, any> | null => {
    if (!raw) return null;
    const desMode = raw.designation?.mode;
    let designations: string[] | 'ALL' = 'ALL';
    if (desMode === 'INCLUDE' && Array.isArray(raw.designation?.values) && raw.designation.values.length > 0) {
      designations = raw.designation.values.map((v: string) => v.toUpperCase());
    }
    const preTraining: string[] = [];
    const preTrainingApplicableTo: string[] = [];
    if (raw.previousTraining?.mode === 'INCLUDE' && Array.isArray(raw.previousTraining?.values)) {
      raw.previousTraining.values.forEach((v: any) => {
        const type = typeof v === 'string' ? v : v?.type;
        if (type) preTraining.push(type.toUpperCase());
        if (Array.isArray(v?.designations) && v.designations.length > 0) {
          v.designations.forEach((d: string) => {
            if (!preTrainingApplicableTo.includes(d.toUpperCase())) preTrainingApplicableTo.push(d.toUpperCase());
          });
        }
      });
    }
    const aplMode = raw.aplExperience?.mode;
    return {
      designations,
      preTraining,
      preTrainingApplicableTo: preTrainingApplicableTo.length > 0 ? preTrainingApplicableTo : 'ALL',
      minYears: aplMode === 'RANGE' ? (raw.aplExperience?.min ?? null) : null,
      maxYears: aplMode === 'RANGE' ? (raw.aplExperience?.max ?? null) : null,
      noAPInNext90Days: raw.specialConditions?.noAPInNext90Days ?? false,
      preAPOnlyIfNominated: raw.specialConditions?.preAPOnlyIfInvited ?? false,
      excludeIfAlreadyTrained: false,
    };
  };

  const { data, drilldownData } = useMemo(() => {
    const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));
    let filteredEmployees = employees;
    
    if (pageFilters.cluster) {
      filteredEmployees = filteredEmployees.filter(emp => {
        const cluster = teamMap[emp.teamId || '']?.cluster;
        return cluster === pageFilters.cluster;
      });
    }
    
    if (pageFilters.team) {
      filteredEmployees = filteredEmployees.filter(emp => emp.teamId === pageFilters.team || emp.team === pageFilters.team);
    }

    const filteredAttendance = attendance.filter(a => {
      if (a.isVoided) return false;
      if (pageFilters.trainer && a.trainerId !== pageFilters.trainer) return false;

      if (pageFilters.month) {
        const m = a.month || (a.attendanceDate || '').substring(0,7);
        if (m !== pageFilters.month) return false;
      }
      return true;
    });

    const filteredNominations = nominations.filter(n => {
      if (!isActiveNomination(n)) return false;
      if (pageFilters.month) {
        const m = n.notificationDate ? n.notificationDate.substring(0,7) : '';
        if (m !== pageFilters.month) return false;
      }
      return true;
    });

    const strictlyEligibleEmployees = applyEligibilityRules(
      tab as TrainingType,
      filteredEmployees,
      filteredAttendance,
      filteredNominations,
      convertDbRule(dbRules[tab] ?? dbRules[tab.toUpperCase()] ?? null)
    );

    return computeGapAnalysis(tab as TrainingType, strictlyEligibleEmployees, filteredAttendance, filteredNominations, masterTeams, zoneFilter);
  }, [tab, employees, attendance, nominations, zoneFilter, masterTeams, dbRules, pageFilters]);

  return { data, drilldownData };
};
