/**
 * Eligibility Engine
 * ⚠️ DO NOT IMPORT IN COMPONENTS — USE HOOKS ONLY
 */
import { Employee } from '../../types/employee';
import { 
  Attendance, 
  TrainingType, 
  TrainingNomination, 
  EligibilityRule 
} from '../../types/attendance';
import { ELIGIBILITY_RULES } from '../constants/eligibilityRules';
import { standardizeDesignation } from '../utils/designationMapper';

// Utility function for normalizing strings for comparison
const normalize = (val?: string) => val?.toLowerCase().trim();

export interface EligibilityResult {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  eligibilityStatus: boolean;
  reasonIfNotEligible?: string;
}

// Simple ID normalization function
const normalizeId = (id: string | number | undefined | null): string => {
  if (id === null || id === undefined) return '';

  return String(id)
    .trim()
    .replace(/\.0+$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
};

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
          .filter(a => normalizeId(a.employeeId) === normalizeId(emp.employeeId) && normalize(a.attendanceStatus) === 'present')
          .map(a => normalize(a.trainingType))
      );
      
      const missing = (rule.previousTraining.values || []).filter((req: any) => {
        // If specific designations are configured for this prerequisite
        if (req.designations && req.designations.length > 0) {
           if (!req.designations.includes(emp.designation || '')) return false; 
        }
        const reqType = typeof req === 'string' ? req : req.type;
        return !completedTrainings.has(normalize(reqType));
      });
      
      if (missing.length > 0) {
        isEligible = false;
        reason = `Missing required trainings: ${missing.map((m: any) => typeof m === 'string' ? m : m.type).join(', ')}`;
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
          if (normalizeId(a.employeeId) !== normalizeId(emp.employeeId) || a.trainingType !== 'AP') return false;
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
        const isNominated = nominations.some(n => normalizeId(n.employeeId) === normalizeId(emp.employeeId) && n.trainingType === 'AP');
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

// Helper to calculate experience years from DOJ
const getExperienceYears = (doj?: string): number => {
  if (!doj) return 0;
  const joiningDate = new Date(doj);
  const today = new Date();
  const diffTime = today.getTime() - joiningDate.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365);
};

/**
 * Hardcoded eligibility check based on fixed rules
 * @param ignoreTrainingStatus - If true, skip excludeIfAlreadyTrained and nomination-based rules (for gap analysis)
 */
export const isEligibleHardcoded = (
  employee: Employee,
  trainingType: TrainingType,
  attendance: Attendance[],
  nominations: TrainingNomination[],
  ignoreTrainingStatus: boolean = false
): boolean => {
  const rule = ELIGIBILITY_RULES[trainingType as keyof typeof ELIGIBILITY_RULES];
  if (!rule) return true; // If no rule, assume eligible

  const now = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(now.getDate() + 90);

  // 1. Designation check
  if (rule.designations !== "ALL" && Array.isArray(rule.designations)) {
    const empDesignation = standardizeDesignation(employee.designation);
    const allowedDesignations = rule.designations.map(d => d.toUpperCase());
    if (!allowedDesignations.includes(empDesignation)) {
      return false;
    }
  }

  // 2. Experience check (using DOJ)
  if (rule.minYears !== null || rule.maxYears !== null) {
    const years = getExperienceYears(employee.doj);
    if (rule.minYears !== null && years < rule.minYears) return false;
    if (rule.maxYears !== null && years > rule.maxYears) return false;
  }

  // 3. Pre-training check (skip for gap analysis)
  if (!ignoreTrainingStatus && rule.preTraining.length > 0) {
    const completedTrainings = new Set(
      attendance
        .filter(a => normalizeId(a.employeeId) === normalizeId(employee.employeeId) && normalize(a.attendanceStatus) === 'present')
        .map(a => normalize(a.trainingType))
    );

    // Check if pre-training applies to this employee's designation
    let appliesToEmployee = false;
    if (rule.preTrainingApplicableTo === "ALL") {
      appliesToEmployee = true;
    } else if (Array.isArray(rule.preTrainingApplicableTo)) {
      const empDesignation = standardizeDesignation(employee.designation);
      appliesToEmployee = rule.preTrainingApplicableTo.some(d => d.toUpperCase() === empDesignation);
    }

    if (appliesToEmployee) {
      for (const req of rule.preTraining) {
        if (!completedTrainings.has(normalize(req))) {
          return false;
        }
      }
    }
  }

  // 4. Exclude if already trained (skip for gap analysis)
  if (!ignoreTrainingStatus && rule.excludeIfAlreadyTrained) {
    const hasAttended = attendance.some(a => 
      normalizeId(a.employeeId) === normalizeId(employee.employeeId) && 
      normalize(a.trainingType) === normalize(trainingType) && 
      normalize(a.attendanceStatus) === 'present'
    );
    if (hasAttended) return false;
  }

  // 5. Capsule rule (noAPInNext90Days) - skip for gap analysis
  if (!ignoreTrainingStatus && rule.noAPInNext90Days) {
    const hasAPNomination = nominations.some(n => 
      normalizeId(n.employeeId) === normalizeId(employee.employeeId) && 
      n.trainingType === 'AP' && 
      new Date(n.notificationDate) >= now && 
      new Date(n.notificationDate) <= ninetyDaysFromNow
    );
    if (hasAPNomination) return false;
  }

  // 6. Pre-AP rule (preAPOnlyIfNominated) - skip for gap analysis
  if (!ignoreTrainingStatus && rule.preAPOnlyIfNominated) {
    const isNominatedForAP = nominations.some(n => 
      normalizeId(n.employeeId) === normalizeId(employee.employeeId) && 
      n.trainingType === 'AP'
    );
    if (!isNominatedForAP) return false;
  }

  return true;
};






