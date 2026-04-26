import { useState, useMemo, useEffect } from 'react';
import { getCollection } from '../../../core/engines/apiClient';
import { applyEligibilityRules } from '../../../core/engines/eligibilityRulesEngine';
import { Employee } from '../../../types/employee';
import { Attendance, TrainingNomination, TrainingType } from '../../../types/attendance';

export const useNominationsData = (
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[],
  sessionType: string | undefined,
  activeTeamId: string,
  sessionTeamIds: string[]
) => {
  const [dbRules, setDbRules] = useState<Record<string, any>>({});

  useEffect(() => {
    getCollection('eligibility_rules').then(rows => {
      const map: Record<string, any> = {};
      rows.forEach((r: any) => { if (r.trainingType) map[r.trainingType] = r; });
      setDbRules(map);
    }).catch(console.error);
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
        if (Array.isArray(v?.designations)) {
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
      minYears: aplMode === 'RANGE' ? raw.aplExperience?.min : null,
      maxYears: aplMode === 'RANGE' ? raw.aplExperience?.max : null,
      noAPInNext90Days: raw.specialConditions?.noAPInNext90Days ?? false,
      preAPOnlyIfNominated: raw.specialConditions?.preAPOnlyIfInvited ?? false,
      excludeIfAlreadyTrained: true,
    };
  };

  const teamEmps = useMemo(() => {
    const allTeamEmps = employees.filter(e => e.teamId === (activeTeamId || sessionTeamIds[0]));
    if (!sessionType) return allTeamEmps;
    const ruleOverride = convertDbRule(dbRules[sessionType] ?? dbRules[sessionType.toUpperCase()] ?? null);
    return applyEligibilityRules(sessionType as TrainingType, allTeamEmps, attendance, nominations, ruleOverride);
  }, [employees, activeTeamId, sessionTeamIds, sessionType, attendance, nominations, dbRules]);

  return { teamEmps };
};
