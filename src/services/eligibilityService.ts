import { Employee } from '../types/employee';
import { 
  Attendance, 
  TrainingType, 
  TrainingNomination, 
  EligibilityRule 
} from '../types/attendance';

export interface EligibilityResult {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  eligibilityStatus: boolean;
  reasonIfNotEligible?: string;
}

/**
 * Dynamics Rule Engine for Training Eligibility
 */
export const getEligibleEmployees = (
  trainingType: TrainingType,
  rule: EligibilityRule | undefined,
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[]
): EligibilityResult[] => {
  if (!rule) {
    return employees.map(e => ({
      employeeId: e.employeeId,
      name: e.name,
      team: e.team,
      cluster: '', // Cluster not in Master by default
      eligibilityStatus: true
    }));
  }

  const now = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(now.getDate() + 90);

  return employees.map(emp => {
    let isEligible = true;
    let reason = '';

    // 1. Designation Check
    const des = (emp.designation || '').toUpperCase();
    const ruleDesValues = (rule.designation?.values || []).map(v => v.toUpperCase());
    if (rule.designation?.mode === 'INCLUDE') {
      if (ruleDesValues.length > 0 && !ruleDesValues.includes(des)) {
        isEligible = false;
        reason = `Designation ${des} not in eligible list`;
      }
    } else if (rule.designation?.mode === 'EXCLUDE') {
      if (ruleDesValues.includes(des)) {
        isEligible = false;
        reason = `Designation ${des} is explicitly excluded`;
      }
    }

    // 2. Previous Training Check
    if (isEligible && rule.previousTraining?.mode === 'INCLUDE') {
      const completedTrainings = new Set(
        attendance
          .filter(a => a.employeeId === emp.id && a.attendanceStatus === 'Present')
          .map(a => a.trainingType)
      );
      
      const missing = (rule.previousTraining.values || []).filter((req: any) => {
        // If specific designations are configured for this prerequisite
        if (req.designations && req.designations.length > 0) {
           if (!req.designations.includes(emp.designation || '')) return false; 
        }
        return !completedTrainings.has(req.type);
      });
      
      if (missing.length > 0) {
        isEligible = false;
        reason = `Missing required trainings: ${missing.map((m: any) => m.type).join(', ')}`;
      }
    }

    // 3. APL Experience (Tenure) Check
    if (isEligible && rule.aplExperience?.mode === 'RANGE') {
      if (emp.aplExperience === undefined) {
        isEligible = false;
        reason = 'APL Experience missing';
      } else {
        if (emp.aplExperience < (rule.aplExperience.min ?? 0) || emp.aplExperience > (rule.aplExperience.max ?? 999)) {
          isEligible = false;
          reason = `Experience (${emp.aplExperience} years) outside range ${rule.aplExperience.min}-${rule.aplExperience.max}`;
        }
      }
    }

    // 4. Special Rules
    if (isEligible && rule.specialConditions) {
      // Capsule Logic
      if (rule.specialConditions.noAPInNext90Days) {
        const hasFutureAP = attendance.some(a => {
          if (a.employeeId !== emp.id || a.trainingType !== 'AP') return false;
          const aDate = new Date(a.attendanceDate);
          return aDate >= now && aDate <= ninetyDaysFromNow;
        });
        if (hasFutureAP) {
          isEligible = false;
          reason = 'AP training planned within next 90 days';
        }
      }

      // Pre-AP Logic
      if (isEligible && rule.specialConditions.preAPOnlyIfInvited) {
        const isNominated = nominations.some(n => n.employeeId === emp.id && n.trainingType === 'AP');
        if (!isNominated) {
          isEligible = false;
          reason = 'Only invited candidates (nominated for AP) are eligible';
        }
      }
    }

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      team: emp.team,
      cluster: '',
      eligibilityStatus: isEligible,
      reasonIfNotEligible: reason
    };
  });
};
