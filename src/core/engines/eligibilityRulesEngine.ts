import { Employee } from '../../types/employee';
import { Attendance, TrainingNomination } from '../../types/attendance';
import { ELIGIBILITY_RULES } from '../constants/eligibilityRules';
import { standardizeDesignation } from '../utils/designationMapper';
import { parseAnyDate } from '../utils/dateParser';

export const applyEligibilityRules = (
  trainingType: string,
  employees: Employee[],
  attendance: Attendance[],
  nominations: TrainingNomination[],
  overrideRule?: Record<string, any> | null
): Employee[] => {
  // Use overrideRule from DB if provided, otherwise fall back to static config
  const rule = overrideRule
    ?? (ELIGIBILITY_RULES as any)[trainingType]
    ?? (ELIGIBILITY_RULES as any)[trainingType.toUpperCase()];
  
  // Fail-safe: If no rule exists, assume everyone is eligible but let Gap Analysis handle trained filtering
  if (!rule) {
    console.warn(`No eligibility rule found for trainingType: ${trainingType}`);
    return employees;
  }


  // Pre-indexed optimized lookups
  const attendanceByEmp = new Map<string, Set<string>>();
  attendance.forEach(a => {
    if (a.attendanceStatus?.toLowerCase() === 'present') {
      const empId = String(a.employeeId).trim().replace(/\.0+$/, '').toLowerCase();
      const tType = (a.trainingType || '').toUpperCase();
      if (!attendanceByEmp.has(empId)) attendanceByEmp.set(empId, new Set());
      attendanceByEmp.get(empId)!.add(tType);
    }
  });

  const apNext90 = new Set<string>();
  const anyNomination = new Set<string>();
  const today = new Date();

  nominations.forEach(n => {
    const empId = String(n.employeeId).trim().replace(/\.0+$/, '').toLowerCase();
    anyNomination.add(empId);

    const tType = (n.trainingType || '').toUpperCase();
    if (tType === 'AP' && n.notificationDate) {
      const tDate = new Date(n.notificationDate);
      const days = (tDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
      if (days >= 0 && days <= 90) {
        apNext90.add(empId);
      }
    }
  });

  const normalizedTrainingType = trainingType.toUpperCase();

  return employees.filter(employee => {
    const empId = String(employee.employeeId).trim().replace(/\.0+$/, '').toLowerCase();
    const des = standardizeDesignation(employee.designation);

    // STEP 1: Designation Filter
    if (rule.designations !== "ALL") {
      if (!Array.isArray(rule.designations) || !rule.designations.includes(des)) {
        return false;
      }
    }

    // STEP 2: Pre-training dependency
    if (rule.preTraining && rule.preTraining.length > 0) {
      let checkPreTraining = false;
      if (rule.preTrainingApplicableTo === "ALL") {
        checkPreTraining = true;
      } else if (Array.isArray(rule.preTrainingApplicableTo)) {
        if (rule.preTrainingApplicableTo.includes(des)) {
          checkPreTraining = true;
        }
      }

      if (checkPreTraining) {
        const empAttended = attendanceByEmp.get(empId) || new Set();
        // must have completed ALL preTraining
        for (const req of rule.preTraining) {
          if (!empAttended.has(req.toUpperCase())) {
            return false;
          }
        }
      }
    }

    // STEP 3: Tenure filter — use parseAnyDate to handle DD/MM/YYYY, Excel serials, etc.
    if (rule.minYears != null || rule.maxYears != null) {
      const parsedDoj = parseAnyDate(employee.doj);
      if (!parsedDoj) return false; // no DOJ → ineligible when tenure rule applies
      const dojDate = new Date(parsedDoj);
      if (isNaN(dojDate.getTime())) return false;
      
      const years = (today.getTime() - dojDate.getTime()) / (1000 * 3600 * 24 * 365.25);
      if (rule.minYears != null && years < Number(rule.minYears)) return false;
      if (rule.maxYears != null && years > Number(rule.maxYears)) return false;
    }

    // STEP 4: Special Rule — noAPInNext90Days
    if (rule.noAPInNext90Days === true) {
      if (apNext90.has(empId)) return false;
    }

    // STEP 5: Special Rule — preAPOnlyIfNominated
    if (rule.preAPOnlyIfNominated === true) {
      if (!anyNomination.has(empId)) return false;
    }

    // STEP 6: Already trained filter
    if (rule.excludeIfAlreadyTrained === true) {
      const empAttended = attendanceByEmp.get(empId) || new Set();
      if (empAttended.has(normalizedTrainingType)) return false;
    }

    return true;
  });
};






