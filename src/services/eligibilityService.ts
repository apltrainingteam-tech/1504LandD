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
      name: e.employeeName,
      team: e.team,
      cluster: e.cluster,
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
    const ruleDesValues = rule.designation.values.map(v => v.toUpperCase());
    if (rule.designation.mode === 'INCLUDE') {
      if (!ruleDesValues.includes(des)) {
        isEligible = false;
        reason = `Designation ${des} not in eligible list`;
      }
    } else if (rule.designation.mode === 'EXCLUDE') {
      if (ruleDesValues.includes(des)) {
        isEligible = false;
        reason = `Designation ${des} is explicitly excluded`;
      }
    }

    // 2. Previous Training Check
    if (isEligible && rule.previousTraining.mode === 'INCLUDE') {
      const completedTrainings = new Set(
        attendance
          .filter(a => a.employeeId === emp.id && a.attendanceStatus === 'Present')
          .map(a => a.trainingType)
      );
      const missing = rule.previousTraining.values.filter(t => !completedTrainings.has(t));
      if (missing.length > 0) {
        isEligible = false;
        reason = `Missing required trainings: ${missing.join(', ')}`;
      }
    }

    // 3. APL Experience (Tenure) Check
    if (isEligible && rule.aplExperience.mode === 'RANGE') {
      if (!emp.joiningDate) {
        isEligible = false;
        reason = 'Joining date missing';
      } else {
        const joinDate = new Date(emp.joiningDate);
        const diffTime = Math.abs(now.getTime() - joinDate.getTime());
        const expYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
        if (expYears < rule.aplExperience.min || expYears > rule.aplExperience.max) {
          isEligible = false;
          reason = `Experience (${expYears.toFixed(1)} years) outside range ${rule.aplExperience.min}-${rule.aplExperience.max}`;
        }
      }
    }

    // 4. Special Rules
    if (isEligible) {
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
      name: emp.employeeName,
      team: emp.team,
      cluster: emp.cluster,
      eligibilityStatus: isEligible,
      reasonIfNotEligible: reason
    };
  });
};
