import { ValidationError } from '../contracts/validation.contract';
import { getSchema } from '../constants/trainingSchemas';
// NOTE: getClosestMatches removed from validation loop — was causing O(n×m) freeze.
// Suggestions are now computed on-demand when user clicks an error, not during validation.
import { traceEngine } from '../debug/traceEngine';

export interface ValidationMasterData {
  employeeIds: Set<string>;
  teamNames: Set<string>;
  trainerIds: Set<string>;
  rawMasterTeams: string[]; // Add this for suggestions
}

export const validateTrainingData = traceEngine("validateTrainingData", (data: any[], masterData: ValidationMasterData): ValidationError[] => {
  const errors: ValidationError[] = [];
  data.forEach((row, index) => {
    const type = row.trainingType || 'UNKNOWN';
    const schema = getSchema(type);
    const recordId = row.id || row._id || `row-${index}`;

    // Required fields check
    schema.required.forEach(field => {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        errors.push({
          id: `${recordId}-${field}-missing`,
          module: 'trainingData',
          rowIndex: index,
          recordId,
          field,
          column: field,
          value: row[field],
          errorType: 'MISSING_FIELD',
          message: `Field '${field}' is required for ${type} training.`
        });
      }
    });

    // Employee existence check
    if (row.employeeId && !masterData.employeeIds.has(String(row.employeeId))) {
      errors.push({
        id: `${recordId}-employeeId-unknown`,
        module: 'trainingData',
        rowIndex: index,
        recordId,
        field: 'employeeId',
        column: 'Employee ID',
        value: row.employeeId,
        errorType: 'UNKNOWN_VALUE',
        message: `Employee ID '${row.employeeId}' not found in Master Roster.`
      });
    }

    // Team existence check (if present)
    if (row.team && !masterData.teamNames.has(row.team.toUpperCase())) {
       errors.push({
         id: `${recordId}-team-unknown`,
         module: 'trainingData',
         rowIndex: index,
         recordId,
         field: 'team',
         column: 'Team',
         value: row.team,
         errorType: 'MAPPING_ERROR',
         message: `Team '${row.team}' not found in Team Master.`
       });
    }


    // Score numeric check
    schema.scoreFields.forEach(field => {
      const val = row[field];
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (isNaN(num) || num < 0 || num > 100) {
          errors.push({
            id: `${recordId}-${field}-invalid`,
            module: 'trainingData',
            rowIndex: index,
            recordId,
            field,
            value: val,
            errorType: 'INVALID_FORMAT',
            message: `Score '${val}' must be a number between 0 and 100.`
          });
        }
      }
    });
  });
  return errors;
});

export const validateNominationData = traceEngine("validateNominationData", (data: any[], masterData: ValidationMasterData): ValidationError[] => {
  const errors: ValidationError[] = [];
  data.forEach((row, index) => {
    const recordId = row.id || row._id || `nom-${index}`;

    if (!row.employeeId) {
      errors.push({
        id: `${recordId}-employeeId-missing`,
        module: 'nomination',
        rowIndex: index,
        recordId,
        field: 'employeeId',
        value: null,
        errorType: 'MISSING_FIELD',
        message: 'Nomination missing Employee ID.'
      });
    } else if (!masterData.employeeIds.has(String(row.employeeId))) {
      errors.push({
        id: `${recordId}-employeeId-unknown`,
        module: 'nomination',
        rowIndex: index,
        recordId,
        field: 'employeeId',
        value: row.employeeId,
        errorType: 'UNKNOWN_VALUE',
        message: `Employee ID '${row.employeeId}' not found in Master Roster.`
      });
    }

    if (!row.trainingType) {
      errors.push({
        id: `${recordId}-trainingType-missing`,
        module: 'nomination',
        rowIndex: index,
        recordId,
        field: 'trainingType',
        value: null,
        errorType: 'MISSING_FIELD',
        message: 'Nomination missing Training Type.'
      });
    }
  });
  return errors;
});

export const validateEmployeeData = traceEngine("validateEmployeeData", (data: any[], masterData: ValidationMasterData): ValidationError[] => {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  data.forEach((row, index) => {
    const recordId = row.id || row._id || `emp-${index}`;
    const empId = String(row.employeeId || '');

    if (!empId) {
      errors.push({
        id: `${recordId}-employeeId-missing`,
        module: 'employee',
        rowIndex: index,
        recordId,
        field: 'employeeId',
        value: null,
        errorType: 'MISSING_FIELD',
        message: 'Employee ID is required.'
      });
    } else {
      if (seenIds.has(empId)) {
        errors.push({
          id: `${recordId}-employeeId-duplicate`,
          module: 'employee',
          rowIndex: index,
          recordId,
          field: 'employeeId',
          value: empId,
          errorType: 'INVALID_FORMAT',
          message: `Duplicate Employee ID '${empId}' found in upload.`
        });
      }
      seenIds.add(empId);
    }

    ['name', 'designation', 'team', 'state'].forEach(field => {
      if (!row[field]) {
        errors.push({
          id: `${recordId}-${field}-missing`,
          module: 'employee',
          rowIndex: index,
          recordId,
          field,
          value: null,
          errorType: 'MISSING_FIELD',
          message: `Field '${field}' is required for employee master.`
        });
      }
    });

    if (row.team && !masterData.teamNames.has(String(row.team).toUpperCase())) {
      errors.push({
        id: `${recordId}-team-unknown`,
        module: 'employee',
        rowIndex: index,
        recordId,
        field: 'team',
        value: row.team,
        errorType: 'MAPPING_ERROR',
        message: `Team '${row.team}' not mapped in Master Data.`
      });
    }
  });
  return errors;
});
