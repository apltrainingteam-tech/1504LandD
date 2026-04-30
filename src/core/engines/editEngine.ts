/**
 * Edit Engine - Handles bulk edits and change set preparation for the Training Data module.
 * 
 * Rules:
 * - Pure functions only (do not mutate original data)
 * - Returns updated buffer objects
 */

import { CandidateRecord, BatchAttStatus } from '../../types/attendance';
import { DataEdit } from '../contracts/edit.contract';



export interface EditChange {
  attendance?: BatchAttStatus;
  score?: string;
  isVoided?: boolean;
  voidedAt?: string;
}


export type EditBuffer = Record<string, EditChange>;

/**
 * Apply bulk edit to a set of selected rows.
 * Returns a new buffer object with the changes applied.
 */
export function applyBulkEdit(
  selectedIds: Set<string> | string[],

  field: 'attendance' | 'score' | 'isVoided' | 'voidedAt',
  value: any,
  currentBuffer: EditBuffer
): EditBuffer {

  const nextBuffer = { ...currentBuffer };

  selectedIds.forEach(id => {
    const existing = nextBuffer[id] || {};
    nextBuffer[id] = {
      ...existing,
      [field]: value
    };
  });

  return nextBuffer;
}

/**
 * Validate an edit change.
 * Returns true if valid, or an error message if invalid.
 */
export function validateEdit(change: EditChange): boolean | string {
  if (change.score !== undefined) {
    const score = parseFloat(change.score);
    if (isNaN(score)) return "Score must be a number";
    if (score < 0 || score > 100) return "Score must be between 0 and 100";
  }
  return true;
}

/**
 * Compare buffer with original data to build a set of ACTUAL changes.
 * Useful for summarizing what will be saved.
 */
export function buildChangeSet(
  buffer: EditBuffer,
  allBatches: any[]
): EditBuffer {
  const changeSet: EditBuffer = {};

  // Flatten original candidates for easy lookup
  const originalMap: Record<string, { attendance: string; score: string; isVoided: boolean }> = {};
  allBatches.forEach(batch => {
    batch.candidates.forEach((c: any) => {
      originalMap[`${batch.id}::${c.empId}`] = {
        attendance: c.attendance,
        score: c.score,
        isVoided: c.isVoided ?? false
      };
    });
  });


  Object.entries(buffer).forEach(([key, change]) => {
    const original = originalMap[key];
    if (!original) return;

    const actualChange: EditChange = {};
    let hasActualChange = false;

    if (change.attendance !== undefined && change.attendance !== original.attendance) {
      actualChange.attendance = change.attendance;
      hasActualChange = true;
    }

    if (change.score !== undefined && change.score !== original.score) {
      actualChange.score = change.score;
      hasActualChange = true;
    }

    if (change.isVoided !== undefined && change.isVoided !== original.isVoided) {
      actualChange.isVoided = change.isVoided;
      hasActualChange = true;
    }


    if (hasActualChange) {
      changeSet[key] = actualChange;
    }
  });

  return changeSet;
}

/**
 * Prepares the payload for the bulk-overwrite API.
 * Converts internal buffer keys and field names to the expected API format.
 */
export function prepareBulkSavePayload(buffer: EditBuffer, allBatches: any[]): any[] {
  const updates: any[] = [];
  
  // Create a lookup for original data to get old values
  const originalMap: Record<string, any> = {};
  allBatches.forEach(batch => {
    batch.candidates.forEach((c: any) => {
      originalMap[`${batch.id}::${c.empId}`] = c;
    });
  });

  Object.entries(buffer).forEach(([key, changes]) => {
    const [trainingId, employeeId] = key.split('::');
    const original = originalMap[key] || {};
    
    // Handle isVoided specially to include meta and oldValue
    if (changes.isVoided !== undefined) {
      updates.push({
        trainingId,
        employeeId,
        field: 'isVoided',
        oldValue: original.isVoided ?? false,
        newValue: changes.isVoided,
        meta: {
          voidedAt: changes.voidedAt || new Date().toISOString(),
          voidReason: (changes as any).voidReason || ''
        }
      });
    }

    // Handle other fields
    Object.entries(changes).forEach(([field, newValue]) => {
      if (field === 'isVoided' || field === 'voidedAt' || field === 'voidReason') return;

      const dbField = field === 'attendance' ? 'attendanceStatus' : field;
      const originalValue = field === 'attendance' ? original.attendance : original[field];

      updates.push({
        trainingId,
        employeeId,
        field: dbField,
        oldValue: originalValue ?? '',
        newValue
      });
    });
  });
  
  return updates;
}



/**
 * Applies a list of DataEdits to a dataset.
 * Used by MasterDataContext to derive "finalData" from "baseData".
 */
export function applyEdits(data: any[], edits: DataEdit[], module: string): any[] {
  const moduleEdits = edits.filter(e => e.module === module);
  if (moduleEdits.length === 0) return data;

  // Group edits by recordId for efficiency
  const editsByRecord = moduleEdits.reduce((acc, edit) => {
    if (!acc[edit.recordId]) acc[edit.recordId] = [];
    acc[edit.recordId].push(edit);
    return acc;
  }, {} as Record<string, DataEdit[]>);

  return data.map(item => {
    // Try to find the unique identifier for the item
    // In this system, it's usually 'id' or 'employeeId' (for employees)
    const recordId = item.id || item._id || (module === 'employee' ? item.employeeId : null);
    
    if (!recordId || !editsByRecord[recordId]) return item;

    // Apply all edits for this record, sorted by timestamp
    const recordEdits = editsByRecord[recordId].sort((a, b) => a.timestamp - b.timestamp);
    
    let newItem = { ...item };
    recordEdits.forEach(edit => {
      newItem[edit.field] = edit.newValue;
    });
    
    return newItem;
  });
}
/**
 * Helper to create a new DataEdit object for an update.
 */
export function createUpdateEdit(
  module: "trainingData" | "nomination" | "employee",
  recordId: string,
  changes: Record<string, any>
): DataEdit {
  const field = Object.keys(changes)[0];
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    module,
    recordId,
    field,
    newValue: changes[field],
    timestamp: Date.now(),
    status: 'applied'
  };
}
