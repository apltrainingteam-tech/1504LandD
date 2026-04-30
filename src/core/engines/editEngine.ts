/**
 * Edit Engine - Handles bulk edits and change set preparation for the Training Data module.
 * 
 * Rules:
 * - Pure functions only (do not mutate original data)
 * - Returns updated buffer objects
 */

import { CandidateRecord, BatchAttStatus } from '../context/PlanningFlowContext';

export interface EditChange {
  attendance?: BatchAttStatus;
  score?: string;
}

export type EditBuffer = Record<string, EditChange>;

/**
 * Apply bulk edit to a set of selected rows.
 * Returns a new buffer object with the changes applied.
 */
export function applyBulkEdit(
  selectedIds: Set<string>,
  field: 'attendance' | 'score',
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
  const originalMap: Record<string, { attendance: string; score: string }> = {};
  allBatches.forEach(batch => {
    batch.candidates.forEach((c: any) => {
      originalMap[`${batch.id}::${c.empId}`] = {
        attendance: c.attendance,
        score: c.score
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
export function prepareBulkSavePayload(buffer: EditBuffer): any[] {
  const updates: any[] = [];
  
  Object.entries(buffer).forEach(([key, changes]) => {
    const [trainingId, employeeId] = key.split('::');
    
    Object.entries(changes).forEach(([field, newValue]) => {
      updates.push({
        trainingId,
        employeeId,
        field: field === 'attendance' ? 'attendanceStatus' : field, // Map to DB field name
        newValue
      });
    });
  });
  
  return updates;
}
